import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let displayMsg = '화면을 불러오는 중 예상치 못한 오류가 발생했습니다.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string };
      if (parsed?.error) {
        if (
          parsed.error.includes('Missing or insufficient permissions') ||
          parsed.error.includes('permission-denied')
        ) {
          displayMsg =
            '데이터 접근 권한을 확인하는 중 오류가 발생했습니다. 로그인 및 이메일 인증 상태를 확인한 뒤 다시 시도해 주세요.';
        } else {
          displayMsg = parsed.error;
        }
      }
    } catch {
      if (error.message) {
        displayMsg = error.message;
      }
    }
    return { hasError: true, message: displayMsg };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('MY DAY ErrorBoundary:', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex items-center justify-center p-6">
          <div className="max-w-md w-full planner-surface rounded-2xl p-6 space-y-4 border border-[var(--border-hairline)]">
            <div className="flex items-center gap-2.5 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h1 className="text-base font-bold">일시적인 오류가 발생했습니다</h1>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {this.state.message}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              작성하신 일정과 플래너 데이터는 안전하게 보관됩니다. 새로고침 후 다시 이용해 주세요.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-contrast)',
              }}
            >
              <RotateCcw className="w-4 h-4" />
              <span>페이지 새로고침</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
