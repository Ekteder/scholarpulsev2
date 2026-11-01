'use client';

import React from 'react';
import { Sparkles, ExternalLink } from 'lucide-react';

export const CREATOR_FACEBOOK_URL = 'https://www.facebook.com/ekteder.sanglap';

interface CreatorAttributionProps {
  variant?:
    | 'login-brand'
    | 'login-banner'
    | 'sidebar'
    | 'dashboard-top'
    | 'dashboard-footer';
  className?: string;
}

export const CreatorAttribution: React.FC<CreatorAttributionProps> = ({
  variant = 'sidebar',
  className = '',
}) => {
  const tooltipText = "Visit EKTEDER's official Facebook profile (opens in a new tab)";

  if (variant === 'login-brand') {
    return (
      <a
        href={CREATOR_FACEBOOK_URL}
        target="_blank"
        rel="noopener noreferrer"
        title={tooltipText}
        className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50/90 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/70 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-100/80 dark:hover:bg-blue-900/60 transition-all duration-200 cursor-pointer ${className}`}
      >
        <Sparkles className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0 group-hover:scale-110 transition-transform" />
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          Created by
        </span>
        <span className="font-display text-xs font-extrabold tracking-wider text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300">
          EKTEDER
        </span>
        <ExternalLink className="w-2.5 h-2.5 text-blue-500/70 dark:text-blue-400/70 opacity-75 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
      </a>
    );
  }

  if (variant === 'login-banner') {
    return (
      <a
        href={CREATOR_FACEBOOK_URL}
        target="_blank"
        rel="noopener noreferrer"
        title={tooltipText}
        className={`group inline-flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-blue-200/90 dark:border-blue-800/70 hover:border-blue-500 dark:hover:border-blue-400 shadow-xs hover:shadow-md hover:shadow-blue-600/10 transition-all duration-200 cursor-pointer ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600/10 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-none">
              Created by
            </span>
            <span className="font-display text-base sm:text-lg font-extrabold tracking-wide text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 leading-tight mt-0.5">
              EKTEDER
            </span>
          </div>
        </div>
        <div className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
          <span className="hidden sm:inline">Connect</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </div>
      </a>
    );
  }

  if (variant === 'dashboard-top') {
    return (
      <a
        href={CREATOR_FACEBOOK_URL}
        target="_blank"
        rel="noopener noreferrer"
        title={tooltipText}
        className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50/90 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/70 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-100/80 dark:hover:bg-blue-900/60 transition-all duration-200 cursor-pointer ${className}`}
      >
        <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 group-hover:rotate-12 transition-transform" />
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Created by
        </span>
        <span className="font-display text-sm font-extrabold tracking-wide text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300">
          EKTEDER
        </span>
        <ExternalLink className="w-3 h-3 text-blue-500/80 dark:text-blue-400/80 group-hover:translate-x-0.5 transition-transform" />
      </a>
    );
  }

  if (variant === 'dashboard-footer') {
    return (
      <div
        className={`w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-display font-bold text-xs shrink-0 shadow-xs">
            SP
          </div>
          <div>
            <p className="font-display text-xs font-bold text-slate-900 dark:text-white">
              ScholarPulse — Modern Daily Study Tracker
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Designed for measurable, structured, and consistent academic progress.
            </p>
          </div>
        </div>

        <a
          href={CREATOR_FACEBOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          title={tooltipText}
          className="group inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-blue-50/90 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/70 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-100/70 dark:hover:bg-blue-900/50 transition-all duration-200 cursor-pointer shrink-0 shadow-xs"
        >
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Created by
          </span>
          <span className="font-display text-base font-extrabold tracking-wide text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300">
            EKTEDER
          </span>
          <ExternalLink className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform" />
        </a>
      </div>
    );
  }

  // Default: 'sidebar' variant
  return (
    <a
      href={CREATOR_FACEBOOK_URL}
      target="_blank"
      rel="noopener noreferrer"
      title={tooltipText}
      className={`group flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50/80 dark:hover:bg-blue-950/50 border border-slate-200/80 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200 cursor-pointer ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-blue-600/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col min-w-0 leading-tight">
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Created by
          </span>
          <span className="font-display text-sm font-extrabold tracking-wide text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 truncate">
            EKTEDER
          </span>
        </div>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0" />
    </a>
  );
};

export default CreatorAttribution;
