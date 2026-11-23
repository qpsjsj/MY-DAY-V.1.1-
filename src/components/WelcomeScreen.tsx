import React, { useState } from 'react';
import { ArrowRight, CalendarDays, LogIn, LogOut, RefreshCw } from 'lucide-react';
import type { User } from 'firebase/auth';
import { SiteFooter } from './SiteFooter';

interface WelcomeScreenProps {
  hasExistingPlanner: boolean;
  activePlannerName?: string;
  user?: User | null;
  authReady?: boolean;
  onContinueExisting: () => void;
  onStartOnboarding: () => void;
  onCreateBlankPlanner: () => void;
  onOpenAuth?: (mode: 'login' | 'signup', reason?: string) => void;
  onLogout?: () => void;
}

const HEALING_SCENES = [
  {
    src: '/src/assets/images/healing_forest_morning_1795414089309.jpg',
    alt: '아침 햇살이 부드럽게 스며드는 고요한 숲길 풍경',
  },
  {
    src: '/src/assets/images/healing_ocean_sunset_1795414089701.jpg',
    alt: '잔잔한 노을빛이 물드는 평온한 바닷가 풍경',
  },
  {
    src: '/src/assets/images/healing_meadow_breeze_1795414089321.jpg',
    alt: '들꽃과 푸른 언덕이 어우러진 맑은 아침 초원',
  },
  {
    src: '/src/assets/images/healing_tea_window_1795414088996.jpg',
    alt: '비 내리는 정원이 보이는 창가의 따뜻한 차 한 잔',
  },
];

const UPLIFTING_QUOTES: Array<{ text: string; author: string }> = [
  {
    text: '오늘의 작은 한 걸음이 내일의 너를 가장 든든하게 지탱해 줄 거야.',
    author: 'MY DAY 오늘의 응원',
  },
  {
    text: '잠시 멈춰 숨을 고르는 시간도 앞으로 나아가는 길의 소중한 일부입니다.',
    author: '인생의 쉼표',
  },
  {
    text: '흔들리지 않고 피는 꽃은 없듯, 지금의 고민도 결국 단단한 뿌리가 됩니다.',
    author: '도종환 시 구절에서',
  },
  {
    text: '완벽한 하루보다 내 마음에 남는 다정한 하루를 스스로에게 선물해 보세요.',
    author: 'MY DAY 오늘의 응원',
  },
  {
    text: '속도보다 방향이 중요합니다. 당신의 속도로 걸어가도 충분히 잘하고 있어요.',
    author: '삶의 나침반',
  },
  {
    text: '비 온 뒤에 하늘이 더 맑듯, 고단했던 어제도 오늘의 빛을 위한 밑거름입니다.',
    author: 'MY DAY 오늘의 응원',
  },
  {
    text: '어제보다 조금 더 나은 내가 되겠다는 마음만으로도 오늘은 이미 빛납니다.',
    author: '하루의 문장',
  },
  {
    text: '사소한 기쁨을 알아보는 눈이 하루를 가장 풍요롭게 만듭니다.',
    author: '생활의 지혜',
  },
  {
    text: '지치지 말고, 조급해하지 말고, 오늘 할 수 있는 가장 작은 일부터 시작해요.',
    author: 'MY DAY 오늘의 응원',
  },
  {
    text: '당신이 진심으로 아끼고 가꾼 하루가 모여 결국 빛나는 인생이 됩니다.',
    author: '하루의 문장',
  },
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  hasExistingPlanner,
  activePlannerName,
  user = null,
  authReady = true,
  onContinueExisting,
  onStartOnboarding,
  onCreateBlankPlanner,
  onOpenAuth,
  onLogout,
}) => {
  const [sceneIdx, setSceneIdx] = useState<number>(() =>
    Math.floor(Math.random() * HEALING_SCENES.length)
  );
  const [quoteIdx, setQuoteIdx] = useState<number>(() =>
    Math.floor(Math.random() * UPLIFTING_QUOTES.length)
  );
  const [imgError, setImgError] = useState(false);

  const currentScene = HEALING_SCENES[sceneIdx];
  const currentQuote = UPLIFTING_QUOTES[quoteIdx];

  const handleShuffleHealing = () => {
    setImgError(false);
    setSceneIdx((prev) => {
      if (HEALING_SCENES.length <= 1) return 0;
      let next = Math.floor(Math.random() * HEALING_SCENES.length);
      if (next === prev) next = (prev + 1) % HEALING_SCENES.length;
      return next;
    });
    setQuoteIdx((prev) => {
      if (UPLIFTING_QUOTES.length <= 1) return 0;
      let next = Math.floor(Math.random() * UPLIFTING_QUOTES.length);
      if (next === prev) next = (prev + 1) % UPLIFTING_QUOTES.length;
      return next;
    });
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Clean Top Bar */}
      <header className="w-full max-w-[1280px] mx-auto px-6 md:px-10 py-6 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-hairline)]">
        <div className="flex items-baseline gap-3 whitespace-nowrap shrink-0">
          <span className="text-xl font-bold tracking-tight">MY DAY</span>
        </div>
        <span className="hidden md:inline text-sm text-[var(--text-secondary)] whitespace-nowrap">
          당신의 하루를 당신답게
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {authReady && onOpenAuth && !user && (
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors whitespace-nowrap cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>로그인 · 회원가입</span>
            </button>
          )}
          {authReady && user && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-xs">
              <span className="font-medium truncate max-w-[140px]">
                {user.displayName?.trim() || user.email}
              </span>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  title="로그아웃"
                  className="inline-flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">로그아웃</span>
                </button>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={onContinueExisting}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {hasExistingPlanner
              ? `${activePlannerName ? `${activePlannerName} 이어하기` : '기존 플래너 이어하기'}`
              : '바로 시작하기'}
          </button>
        </div>
      </header>

      {/* Main Hero Split */}
      <main className="flex-1 w-full max-w-[1280px] mx-auto px-6 md:px-10 py-10 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        <div className="lg:col-span-6 space-y-7">
          <p className="text-sm font-medium text-[var(--accent-primary)] tracking-wide">
            MY DAY · AI 맞춤형 라이프 플래너
          </p>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.2] text-balance">
            당신의 하루를 더 쉽게
            <br />
            <span className="text-[var(--text-secondary)] font-semibold">
              나에게 맞는 플래너를 만들어 보세요.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed max-w-xl">
            달력과 일정 관리부터 할 일, 습관, D-day, 지출 기록까지 내 생활 패턴에 맞게 자유롭게 구성할 수 있습니다.
            원하는 기능을 자연어로 말하면 AI가 플래너를 함께 맞춰 줍니다.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onStartOnboarding}
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-base font-semibold transition-transform active:scale-[0.99] whitespace-nowrap cursor-pointer"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-contrast)',
              }}
            >
              <span>나만의 플래너 만들기</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onCreateBlankPlanner}
              className="px-5 py-3.5 rounded-xl text-sm font-semibold border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors whitespace-nowrap cursor-pointer"
            >
              빈 플래너 만들기
            </button>

            {hasExistingPlanner && (
              <button
                type="button"
                onClick={onContinueExisting}
                className="px-4 py-3.5 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors whitespace-nowrap cursor-pointer"
              >
                기존 플래너 열기
              </button>
            )}
          </div>

          {authReady && !user && onOpenAuth && (
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              내 플래너를 여러 기기에서 안전하게 보관하려면{' '}
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="text-[var(--accent-primary)] font-semibold hover:underline cursor-pointer"
              >
                로그인
              </button>{' '}
              또는{' '}
              <button
                type="button"
                onClick={() => onOpenAuth('signup')}
                className="text-[var(--accent-primary)] font-semibold hover:underline cursor-pointer"
              >
                회원가입
              </button>
              을 이용해 보세요.
            </p>
          )}

          <div className="pt-6 border-t border-[var(--border-hairline)] grid grid-cols-3 gap-6 max-w-lg">
            <div>
              <p className="text-sm font-semibold">자유로운 구성</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                필요한 위젯만 골라 배치
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold">자연어 AI 요청</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                말로 일정 정리와 위젯 추가
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold">즉시 테마 반영</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                크림·세이지·다크 등 7종
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Random Healing Photo + Calligraphy Quote Underneath */}
        <div className="lg:col-span-6 space-y-5">
          <div className="rounded-2xl overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-surface)] aspect-[4/3]">
            {!imgError ? (
              <img
                src={currentScene.src}
                alt={currentScene.alt}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-10 bg-[var(--bg-subtle)] text-center gap-3">
                <CalendarDays className="w-10 h-10 text-[var(--accent-primary)]" />
                <p className="text-base font-semibold">MY DAY</p>
                <p className="text-sm text-[var(--text-secondary)]">당신의 하루를 당신답게</p>
              </div>
            )}
          </div>

          <div className="px-2 pt-1 text-center space-y-2.5">
            <blockquote className="font-calligraphy text-2xl sm:text-3xl leading-snug text-[var(--text-primary)] text-balance">
              “{currentQuote.text}”
            </blockquote>
            <div className="flex items-center justify-center gap-3 text-xs text-[var(--text-muted)]">
              <span>{currentQuote.author}</span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={handleShuffleHealing}
                className="inline-flex items-center gap-1 text-[var(--accent-primary)] hover:underline cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>다른 힐링 문구 보기</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter maxWidthClass="max-w-[1280px]" />
    </div>
  );
};
