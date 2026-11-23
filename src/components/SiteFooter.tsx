import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronUp, ExternalLink } from 'lucide-react';

interface SiteFooterProps {
  maxWidthClass?: string;
}

const FAMILY_SITES = [
  {
    name: '원클릭에이아이',
    href: 'https://oneclickai.co.kr',
  },
  {
    name: '친구 사이트',
    href: 'https://service-10-1630.ai.studio/',
  },
];

export const SiteFooter: React.FC<SiteFooterProps> = ({
  maxWidthClass = 'max-w-[1280px]',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <footer className="w-full border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)]">
      <div
        className={`${maxWidthClass} mx-auto px-6 md:px-10 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6`}
      >
        {/* Left: Corporate-style site & maker info */}
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-base font-bold tracking-tight text-[var(--text-primary)]">
              MY DAY
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              당신의 하루를 당신답게
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[var(--text-secondary)]">
            <span>만든 사람 박상준</span>
            <span aria-hidden="true" className="text-[var(--text-muted)]">
              ·
            </span>
            <span>2026 웹페이지 만들기 수업</span>
          </div>

          <p className="text-xs text-[var(--text-muted)]">© 2026 박상준</p>
        </div>

        {/* Right: FAMILY SITE drop-up (links always remain in DOM/HTML even when collapsed) */}
        <div ref={containerRef} className="relative self-start sm:self-center shrink-0">
          <div
            id={listId}
            aria-hidden={!open}
            className={`absolute bottom-full right-0 left-0 sm:left-auto min-w-[210px] mb-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-md overflow-hidden transition-all duration-150 z-40 ${
              open
                ? 'opacity-100 visible translate-y-0 pointer-events-auto'
                : 'opacity-0 invisible translate-y-1 pointer-events-none'
            }`}
          >
            <ul className="divide-y divide-[var(--border-hairline)]">
              {FAMILY_SITES.map((site) => (
                <li key={site.href}>
                  <a
                    href={site.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    tabIndex={open ? 0 : -1}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors whitespace-nowrap"
                  >
                    <span>{site.name}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-controls={listId}
            className="min-w-[180px] inline-flex items-center justify-between gap-4 px-4 py-2.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-subtle)] text-xs font-semibold tracking-wide text-[var(--text-primary)] transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>FAMILY SITE</span>
            <ChevronUp
              className={`w-4 h-4 text-[var(--text-muted)] transition-transform duration-150 ${
                open ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      </div>
    </footer>
  );
};
