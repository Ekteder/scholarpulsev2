'use client';

import confetti from 'canvas-confetti';
import { WorkspaceData } from '@/types';

export interface RankInfo {
  level: number;
  rankTitle: string;
  minXp: number;
  maxXp: number;
  icon: string;
  badgeColor: string;
}

export const RANKS: RankInfo[] = [
  { level: 1, rankTitle: 'Novice Scholar', minXp: 0, maxXp: 100, icon: '🌱', badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  { level: 2, rankTitle: 'Apprentice Scholar', minXp: 100, maxXp: 300, icon: '📖', badgeColor: 'bg-sky-500/10 text-sky-600 border-sky-500/20' },
  { level: 3, rankTitle: 'Junior Scholar', minXp: 300, maxXp: 600, icon: '✍️', badgeColor: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  { level: 4, rankTitle: 'Dedicated Scholar', minXp: 600, maxXp: 1000, icon: '🔥', badgeColor: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  { level: 5, rankTitle: 'Senior Scholar', minXp: 1000, maxXp: 2000, icon: '⚡', badgeColor: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
  { level: 6, rankTitle: 'Master Scholar', minXp: 2000, maxXp: 3500, icon: '💎', badgeColor: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  { level: 7, rankTitle: 'High Academician', minXp: 3500, maxXp: 6000, icon: '👑', badgeColor: 'bg-rose-500/10 text-rose-600 border-rose-500/20' },
  { level: 8, rankTitle: 'Grand Scholar', minXp: 6000, maxXp: 10000, icon: '🌟', badgeColor: 'bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20' },
  { level: 9, rankTitle: 'Academic Sage', minXp: 10000, maxXp: 25000, icon: '🧙‍♂️', badgeColor: 'bg-gradient-to-r from-amber-500 to-indigo-500 text-white border-transparent' },
];

export function getRankForXp(xp: number): RankInfo {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (xp >= RANKS[i].minXp) {
      return RANKS[i];
    }
  }
  return RANKS[0];
}

export function calculateGamification(data: WorkspaceData | null) {
  if (!data) {
    const defaultRank = RANKS[0];
    return {
      totalXp: 0,
      rank: defaultRank,
      progressPct: 0,
      xpInCurrentLevel: 0,
      xpNeededForNextLevel: 100,
    };
  }

  // 1. Study sessions: 10 XP per 15 minutes (900 seconds)
  const sessionSeconds = data.studySessions.reduce((acc, s) => acc + s.durationSeconds, 0);
  const sessionXp = Math.floor(sessionSeconds / 900) * 10;

  // 2. Completed tasks: 25 XP each
  const completedTasks = data.tasks.filter((t) => t.status === 'completed').length;
  const taskXp = completedTasks * 25;

  // 3. Unlocked achievements: 50 XP each
  const achievementXp = (data.userAchievements || []).length * 50;

  // 4. Flashcard reviews: 5 XP per completed review repetition
  const flashcardXp = (data.flashcards || []).reduce((acc, f) => acc + (f.repetitions * 5), 0);

  // 5. Explicitly stored bonus XP
  const profileBonusXp = data.profile?.gamificationXp || 0;

  const totalXp = sessionXp + taskXp + achievementXp + flashcardXp + profileBonusXp;
  const currentRank = getRankForXp(totalXp);

  const range = currentRank.maxXp - currentRank.minXp;
  const xpInCurrentLevel = Math.max(0, totalXp - currentRank.minXp);
  const progressPct = Math.min(100, Math.round((xpInCurrentLevel / range) * 100));
  const xpNeededForNextLevel = Math.max(0, currentRank.maxXp - totalXp);

  return {
    totalXp,
    rank: currentRank,
    progressPct,
    xpInCurrentLevel,
    xpNeededForNextLevel,
  };
}

/**
 * Triggers a multi-stage celebratory confetti explosion
 */
export function triggerCelebrationConfetti() {
  if (typeof window === 'undefined') return;

  try {
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
    };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
      colors: ['#2563EB', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'],
    });

    fire(0.2, {
      spread: 60,
      colors: ['#3B82F6', '#6366F1', '#EC4899'],
    });

    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });
  } catch (err) {
    console.error('Confetti trigger failed:', err);
  }
}
