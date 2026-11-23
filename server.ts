import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
app.use(express.json({ limit: '512kb' }));

const GEMINI_MODEL = 'gemini-4-hydrogen';

let aiClient: GoogleGenAI | null = null;
let cachedApiKey = '';

function getConfiguredApiKey(): string | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return apiKey;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = getConfiguredApiKey();
  if (!apiKey) {
    aiClient = null;
    cachedApiKey = '';
    return null;
  }
  if (!aiClient || cachedApiKey !== apiKey) {
    cachedApiKey = apiKey;
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

function redactSecrets(input: string): string {
  return input
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, '[REDACTED_API_KEY]')
    .replace(/([?&]key=)[^&\s"']+/gi, '$1[REDACTED]')
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED]');
}

type AiErrorCategory =
  | 'rate_limit_transient'
  | 'quota_daily_or_plan'
  | 'billing_required'
  | 'auth_or_key_config'
  | 'model_not_found'
  | 'bad_request'
  | 'upstream_unavailable'
  | 'validation_error';

type QuotaDimension = 'RPM' | 'TPM' | 'RPD' | 'TPD' | 'ZERO_QUOTA' | 'UNKNOWN';

function getKeyFingerprintId(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
}

interface ClassifiedAiError {
  httpStatus: number;
  category: AiErrorCategory;
  geminiStatus: string;
  quotaDimension?: QuotaDimension;
  quotaMetric?: string;
  quotaId?: string;
  retryAfterSeconds?: number;
  resetAtIso?: string;
  resetAtKst?: string;
  retryable: boolean;
  userMessage: string;
  diagnosticDetail: string;
  projectHint: string | null;
}

interface LastAiAttemptDiag {
  timestamp: string;
  ok: boolean;
  httpStatus: number;
  category?: AiErrorCategory;
  geminiStatus?: string;
  quotaDimension?: QuotaDimension;
  quotaMetric?: string;
  quotaId?: string;
  retryAfterSeconds?: number;
  resetAtIso?: string;
  resetAtKst?: string;
  durationMs: number;
  attempts: number;
  model: string;
  projectHint?: string | null;
  diagnosticDetail?: string;
}

interface RpdCooldownEntry {
  untilMs: number;
  quotaDimension: QuotaDimension;
  quotaMetric?: string;
  quotaId?: string;
  projectHint: string | null;
  diagnosticDetail: string;
}

let lastAiAttemptDiag: LastAiAttemptDiag | null = null;
const rpdCooldownByKeyHash = new Map<string, RpdCooldownEntry>();

function formatKstDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')} (KST)`;
}

function computeResetInfo(retryAfterSeconds?: number): {
  resetAtIso?: string;
  resetAtKst?: string;
} {
  if (!retryAfterSeconds || retryAfterSeconds <= 0) {
    return {};
  }
  const resetDate = new Date(Date.now() + retryAfterSeconds * 1000);
  return {
    resetAtIso: resetDate.toISOString(),
    resetAtKst: formatKstDateTime(resetDate),
  };
}

function parseRetrySeconds(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.ceil(raw);
  }
  if (typeof raw !== 'string') return undefined;
  const secMatch = /(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?/i.exec(raw.trim());
  if (secMatch) {
    const val = Number(secMatch[1]);
    if (Number.isFinite(val) && val > 0) return Math.ceil(val);
  }
  const numOnly = Number(raw.trim());
  if (Number.isFinite(numOnly) && numOnly > 0) return Math.ceil(numOnly);
  return undefined;
}

function extractEmbeddedJson(message: string): Record<string, unknown> | null {
  const firstBrace = message.indexOf('{');
  const lastBrace = message.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace <= firstBrace) return null;
  const candidate = message.slice(firstBrace, lastBrace + 1);
  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function extractQuotaMeta(
  text: string,
  details: Array<Record<string, unknown>>
): { quotaDimension: QuotaDimension; quotaMetric?: string; quotaId?: string } {
  const combinedParts = [text];
  let quotaMetric: string | undefined;
  let quotaId: string | undefined;

  for (const d of details) {
    try {
      combinedParts.push(JSON.stringify(d));
    } catch {
      // ignore
    }
    const violations = Array.isArray(d.violations) ? d.violations : [];
    for (const v of violations) {
      if (v && typeof v === 'object') {
        const vo = v as Record<string, unknown>;
        if (!quotaMetric && typeof vo.quotaMetric === 'string') {
          quotaMetric = vo.quotaMetric;
        }
        if (!quotaId && typeof vo.quotaId === 'string') {
          quotaId = vo.quotaId;
        }
      }
    }
  }

  const combined = combinedParts.join(' ');
  if (!quotaMetric) {
    const metricMatch = /(?:Quota exceeded for metric|quotaMetric['":\s]+)\s*([a-zA-Z0-9_./-]+)/i.exec(
      combined
    );
    if (metricMatch) {
      quotaMetric = metricMatch[1];
    }
  }
  if (!quotaId) {
    const idMatch = /(?:Quota exceeded for quota_id|quotaId['":\s]+)\s*([a-zA-Z0-9_./-]+)/i.exec(
      combined
    );
    if (idMatch) {
      quotaId = idMatch[1];
    }
  }

  let quotaDimension: QuotaDimension = 'UNKNOWN';
  if (/limit\s*[:=]\s*0\b|"quota_limit_value"\s*:\s*"0"|free_tier.*limit:\s*0/i.test(combined)) {
    quotaDimension = 'ZERO_QUOTA';
  } else if (/TokensPerDay|TPD\b|tokens_per_day/i.test(combined)) {
    quotaDimension = 'TPD';
  } else if (/RequestsPerDay|PerDay|RPD\b|requests_per_day|daily/i.test(combined)) {
    quotaDimension = 'RPD';
  } else if (/TokensPerMinute|InputTokensPerMinute|OutputTokensPerMinute|TPM\b|tokens_per_minute/i.test(combined)) {
    quotaDimension = 'TPM';
  } else if (/RequestsPerMinute|PerMinute|RPM\b|requests_per_minute/i.test(combined)) {
    quotaDimension = 'RPM';
  }

  return { quotaDimension, quotaMetric, quotaId };
}

function classifyGeminiError(err: unknown): ClassifiedAiError {
  const errObj = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
  const rawMessage = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  const embedded = extractEmbeddedJson(rawMessage);
  const embeddedError =
    embedded?.error && typeof embedded.error === 'object' && !Array.isArray(embedded.error)
      ? (embedded.error as Record<string, unknown>)
      : embedded;

  const rawStatusNum =
    typeof errObj.status === 'number'
      ? errObj.status
      : typeof errObj.statusCode === 'number'
      ? errObj.statusCode
      : typeof embeddedError?.code === 'number'
      ? embeddedError.code
      : undefined;

  const geminiStatus =
    typeof embeddedError?.status === 'string'
      ? embeddedError.status.trim()
      : typeof errObj.code === 'string'
      ? errObj.code.trim()
      : '';

  const geminiMessage = redactSecrets(
    typeof embeddedError?.message === 'string' && embeddedError.message.trim()
      ? embeddedError.message.trim()
      : rawMessage
  );

  const details: Array<Record<string, unknown>> = Array.isArray(embeddedError?.details)
    ? embeddedError.details.filter(
        (d): d is Record<string, unknown> => Boolean(d && typeof d === 'object' && !Array.isArray(d))
      )
    : Array.isArray(errObj.details)
    ? (errObj.details as unknown[]).filter(
        (d): d is Record<string, unknown> => Boolean(d && typeof d === 'object' && !Array.isArray(d))
      )
    : [];

  let retryAfterSeconds: number | undefined;
  for (const detail of details) {
    if (detail.retryDelay !== undefined) {
      retryAfterSeconds = parseRetrySeconds(detail.retryDelay);
      if (retryAfterSeconds) break;
    }
  }
  if (!retryAfterSeconds) {
    const inMsg = /retry\s+(?:in|after)\s+(\d+(?:\.\d+)?)\s*s/i.exec(geminiMessage);
    if (inMsg) retryAfterSeconds = parseRetrySeconds(`${inMsg[1]}s`);
  }

  const projectMatch =
    /projects\/([a-zA-Z0-9_-]+)|project\s+([0-9]{5,}|[a-z][a-z0-9-]{4,})/i.exec(geminiMessage);
  const projectHint = projectMatch ? projectMatch[1] || projectMatch[2] || null : null;

  const upperMsg = geminiMessage.toUpperCase();
  const upperStatus = geminiStatus.toUpperCase();

  // 1. Check 429 / RESOURCE_EXHAUSTED BEFORE billing keyword matching,
  // because Gemini 429 messages commonly contain "check your plan and billing details".
  if (
    rawStatusNum === 429 ||
    upperStatus === 'RESOURCE_EXHAUSTED' ||
    upperMsg.includes('RESOURCE_EXHAUSTED') ||
    upperMsg.includes('TOO MANY REQUESTS') ||
    upperMsg.includes('QUOTA EXCEEDED')
  ) {
    const { quotaDimension, quotaMetric, quotaId } = extractQuotaMeta(geminiMessage, details);
    const isDailyOrPlanZero =
      quotaDimension === 'RPD' || quotaDimension === 'TPD' || quotaDimension === 'ZERO_QUOTA';

    if (isDailyOrPlanZero) {
      const { resetAtIso, resetAtKst } = computeResetInfo(retryAfterSeconds);
      const dimLabel =
        quotaDimension === 'ZERO_QUOTA'
          ? '현재 요금제/무료 등급 허용량 0 (Free tier limit: 0)'
          : quotaDimension === 'TPD'
          ? '일일 토큰 한도(TPD)'
          : '일일 요청 한도(RPD)';
      const resetGuidance =
        quotaDimension === 'ZERO_QUOTA'
          ? '현재 API 키의 무료 등급 허용량이 0으로 제한되어 있습니다. Google AI Studio / Google Cloud 사용량 대시보드에서 요금제와 결제 설정을 확인해 주세요.'
          : resetAtKst
          ? `다음 일일 한도 초기화 예정 시각(${resetAtKst}) 이후에 다시 시도해 주세요.`
          : '일일 한도가 초기화된 뒤(태평양 표준시 자정 · 한국 시간 오후 4~5시경)에 다시 시도해 주세요.';
      return {
        httpStatus: 429,
        category: 'quota_daily_or_plan',
        geminiStatus: upperStatus || 'RESOURCE_EXHAUSTED',
        quotaDimension,
        quotaMetric,
        quotaId,
        retryAfterSeconds,
        resetAtIso,
        resetAtKst,
        retryable: false,
        userMessage:
          `${dimLabel}를 초과하여 AI 요청을 실행할 수 없습니다. 자동 재시도를 중단했습니다. ${resetGuidance} 기존 달력·일정·플래너 데이터는 모두 그대로 유지됩니다.`,
        diagnosticDetail: geminiMessage.slice(0, 420),
        projectHint,
      };
    }

    const waitHint = retryAfterSeconds
      ? `약 ${retryAfterSeconds}초 후`
      : '잠시(약 1분) 후';
    const dimLabel =
      quotaDimension === 'RPM'
        ? '분당 요청 수(RPM)'
        : quotaDimension === 'TPM'
        ? '분당 토큰 수(TPM)'
        : '단기 요청 한도(429)';
    return {
      httpStatus: 429,
      category: 'rate_limit_transient',
      geminiStatus: upperStatus || 'RESOURCE_EXHAUSTED',
      quotaDimension,
      quotaMetric,
      quotaId,
      retryAfterSeconds,
      retryable: true,
      userMessage:
        `일시적인 AI ${dimLabel} 제한에 도달했습니다. ${waitHint} 다시 시도해 주세요. 기본 달력·일정 기능은 계속 사용하실 수 있습니다.`,
      diagnosticDetail: geminiMessage.slice(0, 420),
      projectHint,
    };
  }

  // 2. Check explicit billing/payment errors (402 or 403/400 billing disabled)
  const isBillingError =
    rawStatusNum === 402 ||
    /PAYMENT_REQUIRED|DELINQUENT|ACCOUNT_DISABLED|BILLING_NOT_ENABLED|ENABLE BILLING|BILLING ACCOUNT/i.test(
      geminiMessage
    );

  if (isBillingError) {
    const httpStatus = rawStatusNum === 403 ? 403 : 402;
    return {
      httpStatus,
      category: 'billing_required',
      geminiStatus: upperStatus || 'BILLING_OR_PAYMENT',
      retryable: false,
      userMessage:
        '프로젝트 결제 또는 요금제 설정으로 인해 AI 요청이 제한되었습니다. 관리자에게 Google Cloud 결제 계정 및 AI Studio 요금제 상태를 확인해 달라고 요청해 주세요. 기존 일정과 플래너 데이터는 그대로 유지됩니다.',
      diagnosticDetail: geminiMessage.slice(0, 320),
      projectHint,
    };
  }

  // 3. Auth / API key / Permission errors (401, 403, 400 API_KEY_INVALID)
  if (
    rawStatusNum === 401 ||
    rawStatusNum === 403 ||
    upperStatus === 'UNAUTHENTICATED' ||
    upperStatus === 'PERMISSION_DENIED' ||
    upperMsg.includes('API_KEY_INVALID') ||
    upperMsg.includes('API KEY NOT VALID') ||
    upperMsg.includes('PERMISSION_DENIED') ||
    upperMsg.includes('UNAUTHENTICATED')
  ) {
    const httpStatus =
      rawStatusNum === 400 || rawStatusNum === 401 || rawStatusNum === 403
        ? rawStatusNum
        : upperStatus === 'PERMISSION_DENIED' || upperMsg.includes('PERMISSION_DENIED')
        ? 403
        : 401;
    return {
      httpStatus,
      category: 'auth_or_key_config',
      geminiStatus: upperStatus || (httpStatus === 403 ? 'PERMISSION_DENIED' : 'API_KEY_INVALID'),
      retryable: false,
      userMessage:
        `API 키 또는 Google Cloud 프로젝트 권한 설정 오류(HTTP ${httpStatus})로 AI를 호출할 수 없습니다. 관리자에게 배포 환경의 GEMINI_API_KEY 및 연결된 프로젝트 권한을 확인해 달라고 요청해 주세요. 기존 달력·일정 기능은 정상 작동합니다.`,
      diagnosticDetail: geminiMessage.slice(0, 320),
      projectHint,
    };
  }

  // 4. Model not found (404)
  if (rawStatusNum === 404 || upperStatus === 'NOT_FOUND' || upperMsg.includes('NOT_FOUND')) {
    return {
      httpStatus: 404,
      category: 'model_not_found',
      geminiStatus: upperStatus || 'NOT_FOUND',
      retryable: false,
      userMessage:
        `요청한 AI 모델(${GEMINI_MODEL})을 찾을 수 없거나 현재 프로젝트에서 사용할 수 없습니다(HTTP 404). 관리자에게 모델명 및 프로젝트 설정 확인을 요청해 주세요.`,
      diagnosticDetail: geminiMessage.slice(0, 320),
      projectHint,
    };
  }

  // 5. Bad request (400)
  if (rawStatusNum === 400 || upperStatus === 'INVALID_ARGUMENT') {
    return {
      httpStatus: 400,
      category: 'bad_request',
      geminiStatus: upperStatus || 'INVALID_ARGUMENT',
      retryable: false,
      userMessage:
        '요청 형식이나 입력 값이 올바르지 않아 AI가 처리하지 못했습니다(HTTP 400). 문장을 조금 더 간결하게 입력해 주세요.',
      diagnosticDetail: geminiMessage.slice(0, 320),
      projectHint,
    };
  }

  // 6. Upstream transient server errors (500, 502, 503, 504)
  if (
    rawStatusNum === 500 ||
    rawStatusNum === 502 ||
    rawStatusNum === 503 ||
    rawStatusNum === 504 ||
    upperStatus === 'UNAVAILABLE' ||
    upperStatus === 'INTERNAL' ||
    upperStatus === 'DEADLINE_EXCEEDED' ||
    /ECONNRESET|ETIMEDOUT|ENOTFOUND|FETCH FAILED|UNAVAILABLE/i.test(geminiMessage)
  ) {
    const httpStatus =
      rawStatusNum && rawStatusNum >= 500 && rawStatusNum <= 504 ? rawStatusNum : 503;
    return {
      httpStatus,
      category: 'upstream_unavailable',
      geminiStatus: upperStatus || 'UNAVAILABLE',
      retryable: true,
      userMessage:
        `AI 서버가 일시적으로 혼잡하거나 응답하지 않습니다(HTTP ${httpStatus}). 잠시 후 다시 시도해 주세요. 기존 일정과 플래너 데이터는 그대로 유지됩니다.`,
      diagnosticDetail: geminiMessage.slice(0, 320),
      projectHint,
    };
  }

  const fallbackStatus =
    rawStatusNum && rawStatusNum >= 400 && rawStatusNum < 600 ? rawStatusNum : 500;
  return {
    httpStatus: fallbackStatus,
    category: 'upstream_unavailable',
    geminiStatus: upperStatus || 'UNKNOWN_ERROR',
    retryable: fallbackStatus >= 500,
    userMessage:
      `AI 요청 처리 중 오류가 발생했습니다(HTTP ${fallbackStatus}). 잠시 후 다시 시도해 주시고, 문제가 계속되면 관리자에게 문의해 주세요.`,
    diagnosticDetail: geminiMessage.slice(0, 320),
    projectHint,
  };
}

const inFlightAiRequests = new Map<string, Promise<Record<string, unknown>>>();

const VALID_INTENTS = [
  'schedule_action',
  'todo_action',
  'design_change',
  'widget_config',
  'widget_create',
  'schedule_analysis',
  'unsupported',
] as const;

const VALID_OPS = [
  'add_schedule',
  'update_schedule',
  'delete_schedule',
  'add_todo',
  'split_todo',
  'delete_todo',
  'move_unfinished_todos',
  'toggle_todo',
  'update_design',
  'toggle_widget',
  'create_custom_widget',
  'add_dday',
  'add_expense',
  'add_habit',
  'add_note',
] as const;

const aiResponseSchema = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      enum: [...VALID_INTENTS],
      description:
        'Must be one of: schedule_action, todo_action, design_change, widget_config, widget_create, schedule_analysis, unsupported',
    },
    intentLabel: {
      type: Type.STRING,
      description:
        'Korean label such as 일정 추가 또는 수정, 할 일 관리, 디자인 변경, 위젯 설정, 새 위젯 생성, 일정 분석 및 추천, 지원하지 않는 요청',
    },
    requiresConfirmation: {
      type: Type.BOOLEAN,
      description:
        'True if deleting items, modifying multiple schedules, creating a multi-day study plan, or adding a brand new custom widget that changes dashboard layout significantly.',
    },
    explanation: {
      type: Type.STRING,
      description:
        'Concise Korean explanation of the proposed or pending action using future/present phrasing (e.g., "... 일정을 등록합니다", not "... 등록했습니다"). Never claim unimplemented features were done.',
    },
    previewSummary: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Bullet list of concrete actions or suggestions in Korean.',
    },
    operations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          op: {
            type: Type.STRING,
            enum: [...VALID_OPS],
            description:
              'One of: add_schedule, update_schedule, delete_schedule, add_todo, split_todo, delete_todo, move_unfinished_todos, toggle_todo, update_design, toggle_widget, create_custom_widget, add_dday, add_expense, add_habit, add_note',
          },
          payload: {
            type: Type.OBJECT,
            propertyOrdering: [
              'id',
              'targetTitle',
              'sourceTitle',
              'title',
              'date',
              'targetDate',
              'startTime',
              'endTime',
              'memo',
              'category',
              'importance',
              'repeat',
              'weekdays',
              'subtasks',
              'theme',
              'accent',
              'font',
              'defaultView',
              'layout',
              'widgetId',
              'visible',
              'widgetTitle',
              'widgetDescription',
              'widgetKind',
              'items',
              'amount',
              'targetPerWeek',
              'content',
            ],
            properties: {
              id: { type: Type.STRING },
              targetTitle: {
                type: Type.STRING,
                description: 'Existing schedule title when updating or deleting by title',
              },
              sourceTitle: {
                type: Type.STRING,
                description: 'Existing todo title to split into subtasks',
              },
              title: {
                type: Type.STRING,
                description: 'Schedule, todo, dday, habit, expense, or note title (required for add_schedule)',
              },
              date: {
                type: Type.STRING,
                description: 'YYYY-MM-DD in KST (REQUIRED for add_schedule, computed from context.todayKst)',
              },
              targetDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
              startTime: {
                type: Type.STRING,
                description:
                  '24-hour HH:mm start time (e.g. 15:00). MUST be empty string "" when the user did not mention any time.',
              },
              endTime: {
                type: Type.STRING,
                description:
                  '24-hour HH:mm end time (e.g. 16:00). MUST be empty string "" when the user did not mention any time. If only startTime is given, set +1 hour.',
              },
              memo: { type: Type.STRING, description: 'Optional note/memo text for the schedule' },
              category: { type: Type.STRING, description: 'Category such as 업무, 운동, 학습, 약속, 생활, 기타' },
              importance: { type: Type.STRING, description: 'high | medium | low' },
              repeat: { type: Type.STRING, description: 'none | daily | weekly | monthly' },
              weekdays: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: '0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat',
              },
              subtasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    date: { type: Type.STRING, description: 'YYYY-MM-DD' },
                    importance: { type: Type.STRING, description: 'high | medium | low' },
                    category: { type: Type.STRING },
                  },
                },
                description: 'Subtasks for split_todo',
              },
              theme: {
                type: Type.STRING,
                description: 'cream | white | sage | lavender | pastel | monotone | dark',
              },
              accent: {
                type: Type.STRING,
                description: 'sage | lavender | charcoal | ocean | coral | forest',
              },
              font: {
                type: Type.STRING,
                description: 'sans | rounded | serif | mono',
              },
              defaultView: {
                type: Type.STRING,
                description: 'month | week | day',
              },
              layout: {
                type: Type.STRING,
                description: 'simple | diary | timetable',
              },
              widgetId: {
                type: Type.STRING,
                description:
                  'ONLY for toggle_widget: todos | dday | habits | focus | expenses | notes | routines | checklists | ai_recommend. Do NOT set on add_schedule.',
              },
              visible: { type: Type.BOOLEAN },
              widgetTitle: {
                type: Type.STRING,
                description: 'ONLY for create_custom_widget. Do NOT set on add_schedule.',
              },
              widgetDescription: { type: Type.STRING },
              widgetKind: {
                type: Type.STRING,
                description: 'checklist | counter | note_list | exam_study',
              },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    detail: { type: Type.STRING },
                    date: { type: Type.STRING },
                    target: { type: Type.INTEGER },
                  },
                },
              },
              amount: { type: Type.NUMBER },
              targetPerWeek: { type: Type.INTEGER },
              content: { type: Type.STRING },
            },
          },
        },
        required: ['op', 'payload'],
      },
    },
  },
  required: [
    'intent',
    'intentLabel',
    'requiresConfirmation',
    'explanation',
    'previewSummary',
    'operations',
  ],
};

function isValidYmd(ymd: unknown): ymd is string {
  if (typeof ymd !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

function isValidHhmm(hhmm: unknown): hhmm is string {
  return typeof hhmm === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm.trim());
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.trim().split(':').map(Number);
  return h * 60 + m;
}

function validateAndNormalizeProposal(
  raw: unknown
): { ok: true; proposal: Record<string, unknown> } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'AI 응답 구조가 올바르지 않습니다.' };
  }
  const obj = raw as Record<string, unknown>;
  const intent = typeof obj.intent === 'string' ? obj.intent.trim() : '';
  if (!VALID_INTENTS.includes(intent as (typeof VALID_INTENTS)[number])) {
    return { ok: false, error: 'AI 응답의 요청 분류(intent)가 올바르지 않습니다.' };
  }

  const rawOps = Array.isArray(obj.operations) ? obj.operations : [];
  const explanation =
    typeof obj.explanation === 'string' && obj.explanation.trim()
      ? obj.explanation.trim()
      : '요청을 확인했습니다.';

  if (intent === 'unsupported') {
    return {
      ok: true,
      proposal: {
        intent,
        intentLabel:
          typeof obj.intentLabel === 'string' && obj.intentLabel.trim()
            ? obj.intentLabel.trim()
            : '지원하지 않는 요청',
        requiresConfirmation: false,
        explanation,
        previewSummary: Array.isArray(obj.previewSummary)
          ? obj.previewSummary.filter((s): s is string => typeof s === 'string')
          : [],
        operations: [],
      },
    };
  }

  const actionIntents = new Set([
    'schedule_action',
    'todo_action',
    'design_change',
    'widget_config',
    'widget_create',
  ]);

  if (actionIntents.has(intent) && rawOps.length === 0) {
    return {
      ok: false,
      error:
        '요청에서 실행 가능한 작업(제목·날짜 등)을 확인하지 못해 등록되지 않았습니다. 날짜와 내용을 구체적으로 입력해 주세요.',
    };
  }

  const normalizedOps: Array<{ op: string; payload: Record<string, unknown> }> = [];

  for (const item of rawOps) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'AI 작업 항목 형식이 올바르지 않습니다.' };
    }
    const opObj = item as Record<string, unknown>;
    const op = typeof opObj.op === 'string' ? opObj.op.trim() : '';
    if (!VALID_OPS.includes(op as (typeof VALID_OPS)[number])) {
      return { ok: false, error: `지원하지 않는 작업 유형(${op || 'unknown'})이 반환되었습니다.` };
    }
    const payload =
      opObj.payload && typeof opObj.payload === 'object' && !Array.isArray(opObj.payload)
        ? { ...(opObj.payload as Record<string, unknown>) }
        : {};

    if (op === 'add_schedule') {
      const title = typeof payload.title === 'string' ? payload.title.trim() : '';
      if (!title) {
        return { ok: false, error: '일정 제목을 확인할 수 없어 일정을 등록하지 않았습니다.' };
      }
      if (!isValidYmd(payload.date)) {
        return {
          ok: false,
          error: `유효하지 않은 일정 날짜(${String(payload.date ?? '미지정')})여서 일정을 등록하지 않았습니다.`,
        };
      }

      const startRaw = typeof payload.startTime === 'string' ? payload.startTime.trim() : '';
      const endRaw = typeof payload.endTime === 'string' ? payload.endTime.trim() : '';

      if (!startRaw && !endRaw) {
        payload.startTime = '';
        payload.endTime = '';
      } else if (!startRaw && endRaw) {
        return {
          ok: false,
          error: '종료 시간만 있고 시작 시간이 없어 일정을 등록하지 않았습니다.',
        };
      } else {
        if (!isValidHhmm(startRaw)) {
          return {
            ok: false,
            error: `올바르지 않은 시작 시간("${startRaw}")이어서 일정을 등록하지 않았습니다.`,
          };
        }
        payload.startTime = startRaw;
        if (!endRaw) {
          const sMin = hhmmToMinutes(startRaw);
          if (sMin >= 23 * 60 + 59) {
            return {
              ok: false,
              error: '23:59 시작 일정은 종료 시간을 지정해 주세요.',
            };
          }
          const eMin = Math.min(23 * 60 + 59, sMin + 60);
          payload.endTime = `${String(Math.floor(eMin / 60)).padStart(2, '0')}:${String(
            eMin % 60
          ).padStart(2, '0')}`;
        } else {
          if (!isValidHhmm(endRaw)) {
            return {
              ok: false,
              error: `올바르지 않은 종료 시간("${endRaw}")이어서 일정을 등록하지 않았습니다.`,
            };
          }
          if (hhmmToMinutes(endRaw) <= hhmmToMinutes(startRaw)) {
            return {
              ok: false,
              error: '종료 시간이 시작 시간보다 빠르거나 같아 일정을 등록하지 않았습니다.',
            };
          }
          payload.endTime = endRaw;
        }
      }

      delete payload.widgetId;
      delete payload.widgetTitle;
      payload.title = title;
      payload.date = payload.date.trim();
    } else if (op === 'update_schedule') {
      if (payload.date !== undefined && String(payload.date).trim() !== '' && !isValidYmd(payload.date)) {
        return {
          ok: false,
          error: `유효하지 않은 수정 날짜("${String(payload.date)}")여서 일정을 수정하지 않았습니다.`,
        };
      }
      const startRaw = typeof payload.startTime === 'string' ? payload.startTime.trim() : '';
      const endRaw = typeof payload.endTime === 'string' ? payload.endTime.trim() : '';
      if (startRaw && !isValidHhmm(startRaw)) {
        return {
          ok: false,
          error: `올바르지 않은 시작 시간("${startRaw}")이어서 일정을 수정하지 않았습니다.`,
        };
      }
      if (endRaw && !isValidHhmm(endRaw)) {
        return {
          ok: false,
          error: `올바르지 않은 종료 시간("${endRaw}")이어서 일정을 수정하지 않았습니다.`,
        };
      }
      if (startRaw && endRaw && hhmmToMinutes(endRaw) <= hhmmToMinutes(startRaw)) {
        return {
          ok: false,
          error: '종료 시간은 시작 시간보다 늦어야 합니다.',
        };
      }
    }

    normalizedOps.push({ op, payload });
  }

  return {
    ok: true,
    proposal: {
      intent,
      intentLabel:
        typeof obj.intentLabel === 'string' && obj.intentLabel.trim()
          ? obj.intentLabel.trim()
          : '요청 처리',
      requiresConfirmation: Boolean(obj.requiresConfirmation),
      explanation,
      previewSummary: Array.isArray(obj.previewSummary)
        ? obj.previewSummary.filter((s): s is string => typeof s === 'string')
        : [],
      operations: normalizedOps,
    },
  };
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(getConfiguredApiKey()),
    model: GEMINI_MODEL,
  });
});

app.get('/api/ai/status', (_req, res) => {
  const apiKey = getConfiguredApiKey();
  const configuredProjectEnv =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    null;

  let rpdCooldown: {
    active: boolean;
    remainingSeconds: number;
    resetAtIso?: string;
    resetAtKst?: string;
    quotaDimension: QuotaDimension;
    quotaMetric?: string;
    quotaId?: string;
  } | null = null;

  if (apiKey) {
    const keyHash = getKeyFingerprintId(apiKey);
    const entry = rpdCooldownByKeyHash.get(keyHash);
    if (entry) {
      const remainingMs = entry.untilMs - Date.now();
      if (remainingMs > 0) {
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        const { resetAtIso, resetAtKst } = computeResetInfo(remainingSeconds);
        rpdCooldown = {
          active: true,
          remainingSeconds,
          resetAtIso,
          resetAtKst,
          quotaDimension: entry.quotaDimension,
          quotaMetric: entry.quotaMetric,
          quotaId: entry.quotaId,
        };
      } else {
        rpdCooldownByKeyHash.delete(keyHash);
      }
    }
  }

  res.json({
    model: GEMINI_MODEL,
    apiKeyConfigured: Boolean(apiKey),
    runtimeEnvironment: process.env.K_SERVICE ? 'cloud-run' : 'local-or-container',
    cloudRunService: process.env.K_SERVICE || null,
    cloudRunRevision: process.env.K_REVISION || null,
    configuredProjectEnv,
    rpdCooldown,
    lastAiAttempt: lastAiAttemptDiag,
  });
});

app.post('/api/ai/plan', async (req, res) => {
  const startedAt = Date.now();
  try {
    const body = req.body as {
      prompt?: unknown;
      context?: unknown;
    };

    if (!body || typeof body.prompt !== 'string') {
      res.status(400).json({
        error: '요청 문장을 올바르게 입력해 주세요.',
        errorInfo: {
          category: 'bad_request',
          httpStatus: 400,
          durationMs: Date.now() - startedAt,
          attempts: 0,
          model: GEMINI_MODEL,
        },
      });
      return;
    }

    const userPrompt = body.prompt.trim();
    if (!userPrompt || userPrompt.length > 1000) {
      res.status(400).json({
        error: '요청은 1자 이상 1,000자 이하로 입력해 주세요.',
        errorInfo: {
          category: 'bad_request',
          httpStatus: 400,
          durationMs: Date.now() - startedAt,
          attempts: 0,
          model: GEMINI_MODEL,
        },
      });
      return;
    }

    const ai = getGeminiClient();
    const activeApiKey = getConfiguredApiKey();
    if (!ai || !activeApiKey) {
      const durationMs = Date.now() - startedAt;
      lastAiAttemptDiag = {
        timestamp: new Date().toISOString(),
        ok: false,
        httpStatus: 503,
        category: 'auth_or_key_config',
        geminiStatus: 'MISSING_API_KEY',
        durationMs,
        attempts: 0,
        model: GEMINI_MODEL,
      };
      res.status(503).json({
        error:
          '서버에 GEMINI_API_KEY가 설정되어 있지 않아 AI 기능을 사용할 수 없습니다. 관리자에게 환경 변수 또는 Cloud Run Secret 설정을 확인해 달라고 요청해 주세요. 기본 달력·일정 기능은 계속 정상 동작합니다.',
        errorInfo: {
          category: 'auth_or_key_config',
          httpStatus: 503,
          geminiStatus: 'MISSING_API_KEY',
          durationMs,
          attempts: 0,
          model: GEMINI_MODEL,
        },
      });
      return;
    }

    // RPD / TPD circuit breaker: if daily quota is already known to be exhausted
    // for the current API key, do not fire redundant upstream Gemini calls until reset.
    const activeKeyHash = getKeyFingerprintId(activeApiKey);
    const activeRpdCooldown = rpdCooldownByKeyHash.get(activeKeyHash);
    if (activeRpdCooldown) {
      const remainingMs = activeRpdCooldown.untilMs - Date.now();
      if (remainingMs > 0) {
        const retryAfterSeconds = Math.ceil(remainingMs / 1000);
        const { resetAtIso, resetAtKst } = computeResetInfo(retryAfterSeconds);
        const durationMs = Date.now() - startedAt;
        const dimLabel =
          activeRpdCooldown.quotaDimension === 'TPD'
            ? '일일 토큰 한도(TPD)'
            : '일일 요청 한도(RPD)';
        res.status(429).json({
          error:
            `${dimLabel} 초과 상태가 유지 중이어서 불필요한 API 재호출을 중단했습니다. ${
              resetAtKst
                ? `다음 초기화 예정 시각(${resetAtKst}) 이후에 다시 시도해 주세요.`
                : '한도 초기화 이후에 다시 시도해 주세요.'
            } 기존 달력·일정·플래너 데이터는 모두 유지됩니다.`,
          errorInfo: {
            category: 'quota_daily_or_plan',
            httpStatus: 429,
            geminiStatus: 'RESOURCE_EXHAUSTED',
            quotaDimension: activeRpdCooldown.quotaDimension,
            quotaMetric: activeRpdCooldown.quotaMetric,
            quotaId: activeRpdCooldown.quotaId,
            retryAfterSeconds,
            resetAtIso,
            resetAtKst,
            cooldownActive: true,
            durationMs,
            attempts: 0,
            model: GEMINI_MODEL,
            projectHint: activeRpdCooldown.projectHint,
          },
        });
        return;
      }
      rpdCooldownByKeyHash.delete(activeKeyHash);
    }

    const ctxObj =
      typeof body.context === 'object' && body.context !== null
        ? (body.context as Record<string, unknown>)
        : {};
    const contextSummary = JSON.stringify(ctxObj).slice(0, 12000);
    const dedupKey = `${activeKeyHash}::${userPrompt}::${String(ctxObj.todayKst ?? '')}::${String(ctxObj.selectedDate ?? '')}::${contextSummary.length}`;

    const systemInstruction = `
당신은 한국어 개인 맞춤형 라이프 플래너 서비스 "MY DAY" (슬로건: 당신의 하루를 당신답게)의 AI 플래너 엔진입니다.
사용자의 자연어 요청을 정확히 분석하여 아래 7가지 intent 중 하나로 분류하고 실행 가능한 JSON 응답을 반환하세요.

[intent 분류]
1. schedule_action: 일정 추가(add_schedule), 수정(update_schedule), 삭제(delete_schedule), 반복 일정 등록
2. todo_action: 할 일 추가(add_todo), 완료 처리(toggle_todo), 할 일 삭제(delete_todo), 할 일 분리(split_todo), 미완료 이동(move_unfinished_todos)
3. design_change: 테마/배경색/강조색/글꼴/달력 보기/레이아웃 변경(update_design)
4. widget_config: 기존 기본 위젯(todos, dday, habits, focus, expenses, notes, routines, checklists, ai_recommend) 표시·숨김(toggle_widget)
5. widget_create: 새 커스텀 위젯 생성(create_custom_widget)
6. schedule_analysis: 시험공부 계획 짜기, 일정 충돌/여유 시간 분석 및 일정 제안
7. unsupported: 외부 결제, 실제 병원/식당 예약, 문자/전화 발송, 또는 존재하지 않는 날짜(예: 2월 30일)·잘못된 시간(예: 25시) 등 실행 불가능한 요청. 이 경우 operations는 반드시 []로 두고 정직하게 사유를 안내하세요.

[일정 등록(add_schedule) 및 수정(update_schedule) payload 필수 규칙 — 매우 중요]
- add_schedule의 payload에는 반드시 title, date(YYYY-MM-DD), startTime, endTime, memo, category, importance, repeat를 채우세요.
- add_schedule에 절대 widgetId나 widgetTitle을 넣지 마세요.
- 날짜는 context.todayKst(YYYY-MM-DD)를 기준으로 한국 시간(KST)으로 정확히 계산하세요.
  예: todayKst가 "2026-11-23"일 때 "오늘" = "2026-11-23", "내일" = "2026-11-24", "모레" = "2026-11-25".
- 시간 처리 규칙:
  1) 사용자가 시작과 종료 시간을 말한 경우(예: "오후 3시부터 4시까지") -> 24시간제 "15:00", "16:00"으로 startTime, endTime을 설정하세요.
  2) 사용자가 시작 시간만 말한 경우(예: "오후 2시 치과") -> startTime: "14:00", endTime: "15:00".
  3) 사용자가 시간을 전혀 말하지 않은 경우(예: "내일 독서 일정을 추가해 줘") -> 절대로 임의의 시간을 지어내지 말고 반드시 startTime: "", endTime: "" (빈 문자열)로 두세요!
- update_schedule 또는 delete_schedule 시에는 context.schedules의 id 또는 targetTitle을 정확히 지정하세요.
- explanation은 앱이 실제로 검증·저장한 뒤에 최종 확정하므로 "등록했습니다/추가했습니다" 대신 "2026-11-24 15:00~16:00 '운동' 일정을 등록합니다"처럼 실행 예정 문장으로 작성하세요.

[응답 예시]
예시 1) todayKst="2026-11-23", 요청="내일 오후 3시부터 4시까지 운동 일정을 추가해 줘."
{
  "intent": "schedule_action",
  "intentLabel": "일정 추가",
  "requiresConfirmation": false,
  "explanation": "내일(2026-11-24) 15:00~16:00 '운동' 일정을 등록합니다.",
  "previewSummary": ["2026-11-24 15:00~16:00 운동"],
  "operations": [
    {
      "op": "add_schedule",
      "payload": {
        "title": "운동",
        "date": "2026-11-24",
        "startTime": "15:00",
        "endTime": "16:00",
        "memo": "",
        "category": "운동",
        "importance": "medium",
        "repeat": "none"
      }
    }
  ]
}

예시 2) todayKst="2026-11-23", 요청="내일 독서 일정을 추가해 줘." (시간 언급 없음)
{
  "intent": "schedule_action",
  "intentLabel": "일정 추가",
  "requiresConfirmation": false,
  "explanation": "내일(2026-11-24) 시간 미정으로 '독서' 일정을 등록합니다.",
  "previewSummary": ["2026-11-24 (시간 미정) 독서"],
  "operations": [
    {
      "op": "add_schedule",
      "payload": {
        "title": "독서",
        "date": "2026-11-24",
        "startTime": "",
        "endTime": "",
        "memo": "",
        "category": "학습",
        "importance": "medium",
        "repeat": "none"
      }
    }
  ]
}

[일반 원칙]
- 일정 삭제(delete_schedule), 할 일 삭제(delete_todo), 2건 이상의 일정 변경/추가, 할 일 분리(split_todo), 미완료 일괄 이동(move_unfinished_todos), 여러 날 공부 계획 생성, 새 위젯 생성은 requiresConfirmation: true로 설정하세요.
- 기존 기본 위젯으로 해결 가능한 요청(예: D-day, 지출 기록)은 toggle_widget을 우선 사용하세요.
- 잘못된 날짜(예: 2026-02-30), 24시 초과 시간, 외부 예약/결제/문자 발송/실시간 날씨·뉴스 조회 등 플래너에서 수행할 수 없는 요청은 임의로 처리하지 말고 intent: "unsupported", operations: []로 설정해 "이 기능은 지원하지 않아 실행할 수 없습니다"라고 솔직하게 안내하세요.
- 모든 응답 문장은 친절하고 간결한 한국어로 작성하세요.
`.trim();

    const runGeminiWithBoundedRetry = async (): Promise<Record<string, unknown>> => {
      const MAX_ATTEMPTS = 2;
      let attempts = 0;
      let response;
      let lastClassified: ClassifiedAiError | null = null;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        attempts = attempt + 1;
        try {
          response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: `현재 플래너 상태 요약:\n${contextSummary}\n\n사용자 요청:\n"${userPrompt}"`,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: aiResponseSchema,
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
          });
          break;
        } catch (err) {
          const classified = classifyGeminiError(err);
          lastClassified = classified;

          const canRetry429 =
            classified.httpStatus === 429 &&
            classified.retryable &&
            (classified.retryAfterSeconds === undefined || classified.retryAfterSeconds <= 3);
          const canRetryServer =
            classified.httpStatus >= 500 && classified.retryable;

          const shouldRetry = attempt + 1 < MAX_ATTEMPTS && (canRetry429 || canRetryServer);

          if (!shouldRetry) {
            throw Object.assign(new Error(classified.userMessage), {
              classified,
              attempts,
            });
          }

          const jitterMs = Math.floor(Math.random() * 250);
          const delayMs =
            canRetry429 && classified.retryAfterSeconds
              ? classified.retryAfterSeconds * 1000 + jitterMs
              : Math.min(3000, 900 * Math.pow(2, attempt) + jitterMs);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      if (!response) {
        throw Object.assign(
          new Error(lastClassified?.userMessage || 'Empty Gemini response'),
          { classified: lastClassified, attempts }
        );
      }

      const rawText = response.text;
      if (!rawText) {
        return {
          status: 502,
          body: {
            error: 'AI 응답을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.',
            errorInfo: {
              category: 'upstream_unavailable',
              httpStatus: 502,
              durationMs: Date.now() - startedAt,
              attempts,
              model: GEMINI_MODEL,
            },
          },
        };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        return {
          status: 502,
          body: {
            error: 'AI 응답 JSON 형식을 해석할 수 없습니다. 다시 시도해 주세요.',
            errorInfo: {
              category: 'upstream_unavailable',
              httpStatus: 502,
              durationMs: Date.now() - startedAt,
              attempts,
              model: GEMINI_MODEL,
            },
          },
        };
      }

      const validated = validateAndNormalizeProposal(parsed);
      if (!validated.ok) {
        return {
          status: 422,
          body: {
            error: validated.error,
            errorInfo: {
              category: 'validation_error',
              httpStatus: 422,
              durationMs: Date.now() - startedAt,
              attempts,
              model: GEMINI_MODEL,
            },
          },
        };
      }

      const durationMs = Date.now() - startedAt;
      lastAiAttemptDiag = {
        timestamp: new Date().toISOString(),
        ok: true,
        httpStatus: 200,
        durationMs,
        attempts,
        model: GEMINI_MODEL,
      };
      console.info(
        `[AI] ok status=200 durationMs=${durationMs} attempts=${attempts} model=${GEMINI_MODEL}`
      );

      return {
        status: 200,
        body: {
          proposal: validated.proposal,
          meta: {
            model: GEMINI_MODEL,
            durationMs,
            attempts,
          },
        },
      };
    };

    let sharedPromise = inFlightAiRequests.get(dedupKey);
    if (!sharedPromise) {
      sharedPromise = runGeminiWithBoundedRetry().finally(() => {
        inFlightAiRequests.delete(dedupKey);
      });
      inFlightAiRequests.set(dedupKey, sharedPromise);
    }

    const result = (await sharedPromise) as {
      status: number;
      body: Record<string, unknown>;
    };
    res.status(result.status).json(result.body);
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const errWithMeta = err as { classified?: ClassifiedAiError; attempts?: number };
    const classified = errWithMeta.classified ?? classifyGeminiError(err);
    const attempts = errWithMeta.attempts ?? 1;

    const activeKeyForDiag = getConfiguredApiKey();
    if (
      activeKeyForDiag &&
      (classified.quotaDimension === 'RPD' || classified.quotaDimension === 'TPD')
    ) {
      const keyHash = getKeyFingerprintId(activeKeyForDiag);
      const cooldownMs = classified.retryAfterSeconds
        ? Math.min(classified.retryAfterSeconds * 1000, 24 * 60 * 60 * 1000)
        : 60 * 1000;
      rpdCooldownByKeyHash.set(keyHash, {
        untilMs: Date.now() + cooldownMs,
        quotaDimension: classified.quotaDimension,
        quotaMetric: classified.quotaMetric,
        quotaId: classified.quotaId,
        projectHint: classified.projectHint,
        diagnosticDetail: classified.diagnosticDetail,
      });
    }

    lastAiAttemptDiag = {
      timestamp: new Date().toISOString(),
      ok: false,
      httpStatus: classified.httpStatus,
      category: classified.category,
      geminiStatus: classified.geminiStatus,
      quotaDimension: classified.quotaDimension,
      quotaMetric: classified.quotaMetric,
      quotaId: classified.quotaId,
      retryAfterSeconds: classified.retryAfterSeconds,
      resetAtIso: classified.resetAtIso,
      resetAtKst: classified.resetAtKst,
      durationMs,
      attempts,
      model: GEMINI_MODEL,
      projectHint: classified.projectHint,
      diagnosticDetail: classified.diagnosticDetail,
    };

    console.error(
      `[AI] error httpStatus=${classified.httpStatus} category=${classified.category} geminiStatus=${classified.geminiStatus} quota=${classified.quotaDimension || 'none'} quotaId=${classified.quotaId || 'none'} metric=${classified.quotaMetric || 'none'} retryAfter=${classified.retryAfterSeconds ?? 'none'} resetAtKst=${classified.resetAtKst || 'none'} durationMs=${durationMs} attempts=${attempts} model=${GEMINI_MODEL} detail=${JSON.stringify(classified.diagnosticDetail)}`
    );

    res.status(classified.httpStatus).json({
      error: classified.userMessage,
      errorInfo: {
        category: classified.category,
        httpStatus: classified.httpStatus,
        geminiStatus: classified.geminiStatus,
        quotaDimension: classified.quotaDimension,
        quotaMetric: classified.quotaMetric,
        quotaId: classified.quotaId,
        retryAfterSeconds: classified.retryAfterSeconds,
        resetAtIso: classified.resetAtIso,
        resetAtKst: classified.resetAtKst,
        durationMs,
        attempts,
        model: GEMINI_MODEL,
        projectHint: classified.projectHint,
      },
    });
  }
});

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MY DAY server listening on http://localhost:${PORT}`);
  });
}

startServer();
