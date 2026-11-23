import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  Cloud,
  CloudOff,
  Loader2,
  LogIn,
  LogOut,
  MailCheck,
  RefreshCw,
  Save,
  User as UserIcon,
} from 'lucide-react';
import type { User } from 'firebase/auth';

export type CloudSaveStatus =
  | 'guest'
  | 'loading'
  | 'unverified'
  | 'pending'
  | 'saving'
  | 'saved'
  | 'error';

interface SaveStatusIndicatorProps {
  status: CloudSaveStatus;
  lastSavedAt: string | null;
  errorMsg: string | null;
  onManualSave: () => void;
  onRetrySave: () => void;
  compact?: boolean;
}

export const SaveStatusIndicator: React.FC<SaveStatusIndicatorProps> = ({
  status,
  lastSavedAt,
  errorMsg,
  onManualSave,
  onRetrySave,
  compact = false,
}) => {
  const renderLabel = () => {
    switch (status) {
      case 'guest':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <CloudOff className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
            <span>게스트 임시 저장</span>
          </span>
        );
      case 'loading':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent-primary)] shrink-0" />
            <span>불러오는 중...</span>
          </span>
        );
      case 'unverified':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
            <MailCheck className="w-3.5 h-3.5 shrink-0" />
            <span>이메일 인증 대기 (기기 임시 보관)</span>
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <Cloud className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
            <span>저장 대기 중...</span>
          </span>
        );
      case 'saving':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--accent-primary)] font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>저장 중...</span>
          </span>
        );
      case 'saved':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] tabular-nums">
            <Check className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
            <span>{lastSavedAt ? `저장 완료 · ${lastSavedAt}` : '클라우드 저장 완료'}</span>
          </span>
        );
      case 'error':
        return (
          <span
            className="inline-flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium"
            title={errorMsg || undefined}
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>저장 실패 (임시 보관됨)</span>
          </span>
        );
    }
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${
        compact ? '' : 'justify-between'
      }`}
    >
      {renderLabel()}

      {status === 'error' ? (
        <button
          type="button"
          onClick={onRetrySave}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-500/20 cursor-pointer whitespace-nowrap"
        >
          <RefreshCw className="w-3 h-3" />
          <span>재시도</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onManualSave}
          disabled={status === 'saving' || status === 'loading'}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] text-[var(--text-primary)] disabled:opacity-50 cursor-pointer whitespace-nowrap"
        >
          <Save className="w-3 h-3 text-[var(--accent-primary)]" />
          <span>{status === 'guest' ? '계정에 저장' : '저장'}</span>
        </button>
      )}
    </div>
  );
};

interface SidebarAccountCardProps {
  user: User | null;
  authReady: boolean;
  emailVerified: boolean;
  saveStatus: CloudSaveStatus;
  lastSavedAt: string | null;
  saveErrorMsg: string | null;
  onOpenAuth: (mode: 'login' | 'signup', reason?: string) => void;
  onManualSave: () => void;
  onRetrySave: () => void;
  onLogout: () => void;
  onResendVerification: () => Promise<void>;
  onRefreshVerification: () => Promise<boolean>;
}

export const SidebarAccountCard: React.FC<SidebarAccountCardProps> = ({
  user,
  authReady,
  emailVerified,
  saveStatus,
  lastSavedAt,
  saveErrorMsg,
  onOpenAuth,
  onManualSave,
  onRetrySave,
  onLogout,
  onResendVerification,
  onRefreshVerification,
}) => {
  const [verifyMsg, setVerifyMsg] = useState('');
  const [checkingVerify, setCheckingVerify] = useState(false);

  if (!authReady) {
    return (
      <div className="p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-xs text-[var(--text-muted)] flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        <span>계정 상태 확인 중...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[var(--bg-subtle)] flex items-center justify-center shrink-0">
              <UserIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">게스트 모드</p>
              <p className="text-[11px] text-[var(--text-muted)] truncate">
                로그인 후 계정에 영구 저장
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onOpenAuth('login')}
            className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-contrast)',
            }}
          >
            <LogIn className="w-3 h-3" />
            <span>로그인</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenAuth('signup')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            회원가입
          </button>
        </div>
      </div>
    );
  }

  const displayLabel = user.displayName?.trim() || user.email || '내 계정';
  const isGoogle = user.providerData.some((p) => p.providerId === 'google.com');

  return (
    <div className="p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
            style={{
              backgroundColor: 'var(--accent-soft)',
              color: 'var(--accent-primary)',
            }}
          >
            {displayLabel.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">{displayLabel}</p>
            <p className="text-[10px] text-[var(--text-muted)] truncate">
              {isGoogle ? 'Google 계정' : '이메일 계정'} · {user.email}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          title="로그아웃"
          aria-label="로그아웃"
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {!emailVerified && (
        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-1.5 text-[11px] text-amber-800 dark:text-amber-300">
          <p className="font-semibold">이메일 인증이 필요합니다</p>
          <p className="leading-snug opacity-90">
            메일함에서 인증 링크를 누른 뒤 아래 확인 버튼을 누르면 클라우드에 저장됩니다.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <button
              type="button"
              disabled={checkingVerify}
              onClick={async () => {
                setCheckingVerify(true);
                setVerifyMsg('');
                try {
                  const ok = await onRefreshVerification();
                  setVerifyMsg(
                    ok
                      ? '이메일 인증이 확인되어 동기화를 시작합니다.'
                      : '아직 인증이 완료되지 않았습니다. 메일함 링크를 확인해 주세요.'
                  );
                } catch {
                  setVerifyMsg('인증 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
                } finally {
                  setCheckingVerify(false);
                }
              }}
              className="px-2 py-1 rounded bg-amber-600 text-white font-semibold cursor-pointer disabled:opacity-50"
            >
              {checkingVerify ? '확인 중...' : '인증 완료 확인'}
            </button>
            <button
              type="button"
              onClick={async () => {
                setVerifyMsg('');
                try {
                  await onResendVerification();
                  setVerifyMsg('인증 메일을 다시 발송했습니다.');
                } catch {
                  setVerifyMsg('잠시 후 다시 인증 메일을 요청해 주세요.');
                }
              }}
              className="px-2 py-1 rounded border border-amber-600/30 bg-[var(--bg-surface)] font-medium cursor-pointer"
            >
              메일 재발송
            </button>
          </div>
          {verifyMsg && <p className="font-medium pt-0.5">{verifyMsg}</p>}
        </div>
      )}

      <div className="pt-1.5 border-t border-[var(--border-hairline)]">
        <SaveStatusIndicator
          status={saveStatus}
          lastSavedAt={lastSavedAt}
          errorMsg={saveErrorMsg}
          onManualSave={onManualSave}
          onRetrySave={onRetrySave}
        />
        {saveStatus === 'error' && saveErrorMsg && (
          <p className="text-[11px] text-red-600 dark:text-red-400 mt-1.5 leading-snug">
            {saveErrorMsg}
          </p>
        )}
      </div>
    </div>
  );
};
