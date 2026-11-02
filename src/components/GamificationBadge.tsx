'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  calculateGamification,
  RANKS,
  triggerCelebrationConfetti,
} from '@/lib/gamification';
import { Sparkles, Trophy, Zap, ChevronRight, X } from 'lucide-react';

export function GamificationBadge({
  variant = 'header',
}: {
  variant?: 'header' | 'sidebar' | 'drawer';
}) {
  const { data } = useWorkspace();
  const [modalOpen, setModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [modalOpen]);

  const gamification = calculateGamification(data);
  const { rank, totalXp, progressPct, xpNeededForNextLevel } = gamification;

  // Sidebar / Mobile Drawer full card representation
  if (variant === 'sidebar' || variant === 'drawer') {
    return (
      <>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          data-testid={variant === 'drawer' ? 'drawer-gamification-badge' : 'sidebar-gamification-badge'}
          className="w-full p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all text-left group cursor-pointer"
          title="View Scholar Rank & XP Progress"
        >
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg select-none shrink-0">{rank.icon}</span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                Lv.{rank.level} {rank.rankTitle}
              </span>
            </div>
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-800/60 shrink-0">
              {totalXp} XP
            </span>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
            <span>Next: Level {rank.level + 1}</span>
            <span className="text-slate-700 dark:text-slate-300 font-semibold">{progressPct}%</span>
          </div>

          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </button>

        {renderLadderModal()}
      </>
    );
  }

  // Header representation: hidden on < lg to avoid mobile & tablet header crowding, visible on laptop & pc
  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        data-testid="header-gamification-badge"
        className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 sm:py-1.5 rounded-full border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs hover:border-blue-400 dark:hover:border-blue-500 shadow-xs transition-all text-left group shrink-0 cursor-pointer"
        title="View Scholar Rank & XP Progress"
      >
        <span className="text-sm sm:text-base select-none shrink-0">{rank.icon}</span>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors whitespace-nowrap">
              Lv.{rank.level} <span className="hidden xl:inline">{rank.rankTitle}</span>
            </span>
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-800/60 whitespace-nowrap">
              {totalXp} XP
            </span>
          </div>
          <div className="w-16 xl:w-20 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-0.5">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </button>

      {renderLadderModal()}
    </>
  );

  function renderLadderModal() {
    if (!modalOpen || !mounted || typeof document === 'undefined') return null;

    const modalContent = (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) setModalOpen(false);
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scholar-rank-title"
        data-testid="academic-rank-modal-backdrop"
      >
        <div
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 my-auto max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
          data-testid="academic-rank-modal"
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{rank.icon}</span>
              <div>
                <h3 id="scholar-rank-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Scholar Rank: {rank.rankTitle}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Level {rank.level} • {totalXp} Total XP Accumulated
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer transition-colors"
              aria-label="Close dialog"
              data-testid="close-academic-rank-modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current Level Progress Card */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50/60 dark:from-blue-950/40 dark:to-indigo-950/20 border border-blue-100 dark:border-blue-900/40 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Progress to Level {rank.level + 1}</span>
              <span>{progressPct}% ({xpNeededForNextLevel} XP needed)</span>
            </div>
            <div className="w-full h-2.5 bg-white/80 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => triggerCelebrationConfetti()}
              data-testid="confetti-test-btn"
              className="mt-2 w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Test Level Celebration Confetti</span>
            </button>
          </div>

          {/* XP Earning Rules */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider">
              How to Earn XP
            </h4>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
                <div className="font-bold text-blue-600 dark:text-blue-400">+10 XP</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">per 15 min studied</div>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
                <div className="font-bold text-emerald-600 dark:text-emerald-400">+25 XP</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">per completed task</div>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
                <div className="font-bold text-amber-600 dark:text-amber-400">+50 XP</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">per unlocked milestone</div>
              </div>
            </div>
          </div>

          {/* Rank Ladder */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider">
              Academic Rank Progression
            </h4>
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {RANKS.map((r) => {
                const isCurrent = r.level === rank.level;
                const isUnlocked = totalXp >= r.minXp;
                return (
                  <div
                    key={r.level}
                    className={`flex items-center justify-between p-2 rounded-xl text-xs transition-colors ${
                      isCurrent
                        ? 'bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 font-semibold text-blue-700 dark:text-blue-300'
                        : isUnlocked
                        ? 'bg-slate-50/70 dark:bg-slate-950/30 text-slate-700 dark:text-slate-300'
                        : 'opacity-40 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{r.icon}</span>
                      <span>
                        Lv.{r.level} {r.rankTitle}
                      </span>
                    </div>
                    <span className="font-mono text-[11px]">
                      {r.minXp} XP
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(false)}
            data-testid="close-academic-rank-modal-bottom"
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );

    return createPortal(modalContent, document.body);
  }
}

