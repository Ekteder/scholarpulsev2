'use client';

import React, { useState } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  calculateGamification,
  RANKS,
  triggerCelebrationConfetti,
} from '@/lib/gamification';
import { Sparkles, Trophy, Zap, ChevronRight, X } from 'lucide-react';

export function GamificationBadge() {
  const { data } = useWorkspace();
  const [modalOpen, setModalOpen] = useState(false);

  const gamification = calculateGamification(data);
  const { rank, totalXp, progressPct, xpNeededForNextLevel } = gamification;

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs hover:border-blue-400 dark:hover:border-blue-500 shadow-xs transition-all text-left group"
        title="View Scholar Rank & XP Progress"
      >
        <span className="text-base select-none">{rank.icon}</span>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              Lv.{rank.level} {rank.rankTitle}
            </span>
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded-full">
              {totalXp} XP
            </span>
          </div>
          <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-0.5">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </button>

      {/* Rank Ladder Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{rank.icon}</span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Scholar Rank: {rank.rankTitle}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Level {rank.level} • {totalXp} Total XP Accumulated
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
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
                onClick={() => triggerCelebrationConfetti()}
                className="mt-2 w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all"
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
              onClick={() => setModalOpen(false)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
