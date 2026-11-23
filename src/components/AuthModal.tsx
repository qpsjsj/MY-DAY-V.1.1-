import React, { useEffect, useState } from 'react';
import { Lock, Mail, User as UserIcon, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getKoreanAuthErrorMessage } from '../firebase';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'signup';
  reasonMessage?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  reasonMessage,
  onClose,
  onSuccess,
}) => {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [providerConsoleHint, setProviderConsoleHint] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg('');
      setProviderConsoleHint(false);
      setPassword('');
      setConfirmPassword('');
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const validateEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg('');
    setProviderConsoleHint(false);

    const trimmedEmail = email.trim();
    if (!validateEmail(trimmedEmail)) {
      setErrorMsg('올바른 이메일 주소 형식을 입력해 주세요. (예: name@example.com)');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('비밀번호는 6자 이상 입력해 주세요.');
      return;
    }

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setErrorMsg('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(trimmedEmail, password);
      } else {
        await signUpWithEmail(trimmedEmail, password, displayName);
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      const parsed = getKoreanAuthErrorMessage(err);
      setErrorMsg(parsed.message);
      setProviderConsoleHint(Boolean(parsed.isProviderDisabled));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (submitting) return;
    setErrorMsg('');
    setProviderConsoleHint(false);
    setSubmitting(true);
    try {
      await signInWithGoogle();
      onSuccess?.();
      onClose();
    } catch (err) {
      const parsed = getKoreanAuthErrorMessage(err);
      setErrorMsg(parsed.message);
      setProviderConsoleHint(Boolean(parsed.isProviderDisabled));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md planner-surface rounded-2xl border border-[var(--border-hairline)] p-6 space-y-5 shadow-xl bg-[var(--bg-surface)] text-[var(--text-primary)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[var(--accent-primary)]">
              MY DAY 계정 및 클라우드 저장
            </p>
            <h2 id="auth-modal-title" className="text-xl font-bold tracking-tight mt-0.5">
              {mode === 'login' ? '로그인' : '회원가입'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="로그인 창 닫기"
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {reasonMessage && (
          <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)] leading-relaxed">
            {reasonMessage}
          </div>
        )}

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[var(--bg-subtle)]">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg('');
              setProviderConsoleHint(false);
            }}
            className={`py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              mode === 'login'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMsg('');
              setProviderConsoleHint(false);
            }}
            className={`py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              mode === 'signup'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            회원가입
          </button>
        </div>

        {/* Google Sign-In */}
        <button
          type="button"
          disabled={submitting}
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-subtle)] text-sm font-semibold disabled:opacity-50 cursor-pointer transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span>Google 계정으로 계속하기</span>
        </button>

        <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
          <div className="flex-1 h-px bg-[var(--border-hairline)]" />
          <span>또는 이메일로 {mode === 'login' ? '로그인' : '가입'}</span>
          <div className="flex-1 h-px bg-[var(--border-hairline)]" />
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-3" noValidate>
          {mode === 'signup' && (
            <div>
              <label
                htmlFor="auth-display-name"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
              >
                이름 또는 닉네임 (선택)
              </label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] focus-within:border-[var(--accent-primary)]">
                <UserIcon className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                <input
                  id="auth-display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={40}
                  placeholder="예: 홍길동"
                  className="w-full bg-transparent text-sm focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
            >
              이메일
            </label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] focus-within:border-[var(--accent-primary)]">
              <Mail className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full bg-transparent text-sm focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
            >
              비밀번호 (6자 이상)
            </label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] focus-within:border-[var(--accent-primary)]">
              <Lock className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              <input
                id="auth-password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                required
                className="w-full bg-transparent text-sm focus:outline-none"
              />
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label
                htmlFor="auth-confirm-password"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
              >
                비밀번호 확인
              </label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] focus-within:border-[var(--accent-primary)]">
                <Lock className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                <input
                  id="auth-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="비밀번호 다시 입력"
                  required
                  className="w-full bg-transparent text-sm focus:outline-none"
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-700 dark:text-red-300 space-y-1.5 leading-relaxed">
              <p className="font-medium">{errorMsg}</p>
              {providerConsoleHint && (
                <p className="opacity-90">
                  안내: Firebase Console → Authentication → Sign-in method 탭에서 ‘이메일/비밀번호’ 또는 ‘Google’ 제공업체를 사용 설정으로 저장해야 합니다.
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold disabled:opacity-50 cursor-pointer transition-opacity"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-contrast)',
            }}
          >
            {submitting
              ? mode === 'login'
                ? '로그인 중...'
                : '회원가입 처리 중...'
              : mode === 'login'
              ? '이메일로 로그인'
              : '회원가입 완료'}
          </button>
        </form>

        {mode === 'signup' && (
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
            이메일 회원가입 시 입력한 주소로 인증 메일이 발송됩니다. 이메일 인증을 완료하면 모든 기기에서 내 플래너가 자동 동기화됩니다.
          </p>
        )}
      </div>
    </div>
  );
};
