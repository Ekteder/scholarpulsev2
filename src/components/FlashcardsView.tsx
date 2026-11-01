'use client';

import React, { useState, useMemo } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { FlashcardItem } from '@/types';
import { MathRenderer, MathCheatSheetPopover } from './MathRenderer';
import { triggerCelebrationConfetti } from '@/lib/gamification';
import {
  Layers,
  RotateCw,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Sparkles,
  BookOpen,
  Filter,
  X,
  Play,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';

export function FlashcardsView() {
  const { data, createFlashcard, updateFlashcard, deleteFlashcard, reviewFlashcard } = useWorkspace();
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<FlashcardItem | null>(null);

  // Form state
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formFront, setFormFront] = useState('');
  const [formBack, setFormBack] = useState('');
  const [saving, setSaving] = useState(false);

  // Active study review session
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const subjects = data?.subjects || [];
  const allCards = data?.flashcards || [];

  // Filtered cards for management list
  const filteredCards = useMemo(() => {
    if (selectedSubjectFilter === 'all') return allCards;
    return allCards.filter((c) => c.subjectId === selectedSubjectFilter);
  }, [allCards, selectedSubjectFilter]);

  // Review Queue (cards where nextReviewDate <= today)
  const dueCards = useMemo(() => {
    let pool = allCards.filter((c) => c.nextReviewDate <= todayStr);
    if (selectedSubjectFilter !== 'all') {
      pool = pool.filter((c) => c.subjectId === selectedSubjectFilter);
    }
    return pool;
  }, [allCards, selectedSubjectFilter, todayStr]);

  const activeCard = isReviewing && dueCards.length > 0 ? dueCards[reviewIndex] : null;

  // Keyboard shortcut listener during active study
  React.useEffect(() => {
    if (!isReviewing || !activeCard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        setCardFlipped((prev) => !prev);
      } else if (cardFlipped) {
        if (e.key === '1') handleRateCard(1);
        else if (e.key === '2') handleRateCard(2);
        else if (e.key === '3') handleRateCard(3);
        else if (e.key === '4') handleRateCard(4);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReviewing, activeCard, cardFlipped]);

  const handleStartReview = () => {
    if (dueCards.length === 0) return;
    setReviewIndex(0);
    setCardFlipped(false);
    setIsReviewing(true);
  };

  const handleRateCard = async (grade: 1 | 2 | 3 | 4) => {
    if (!activeCard) return;

    await reviewFlashcard(activeCard.id, grade);

    if (reviewIndex + 1 < dueCards.length) {
      setCardFlipped(false);
      setReviewIndex((prev) => prev + 1);
    } else {
      // Completed the session!
      triggerCelebrationConfetti();
      setIsReviewing(false);
      setCardFlipped(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingCard(null);
    setFormSubjectId(subjects[0]?.id || '');
    setFormFront('');
    setFormBack('');
    setCreateModalOpen(true);
  };

  const handleOpenEdit = (card: FlashcardItem) => {
    setEditingCard(card);
    setFormSubjectId(card.subjectId);
    setFormFront(card.front);
    setFormBack(card.back);
    setCreateModalOpen(true);
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSubjectId || !formFront.trim() || !formBack.trim()) return;

    setSaving(true);
    try {
      if (editingCard) {
        await updateFlashcard(editingCard.id, {
          subjectId: formSubjectId,
          front: formFront.trim(),
          back: formBack.trim(),
        });
      } else {
        await createFlashcard({
          subjectId: formSubjectId,
          front: formFront.trim(),
          back: formBack.trim(),
        });
      }
      setCreateModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>Spaced Repetition Flashcards</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            SuperMemo SM-2 mathematical spaced repetition • Math & KaTeX equations supported
          </p>
        </div>

        <div className="flex items-center gap-2">
          {dueCards.length > 0 && !isReviewing && (
            <button
              onClick={handleStartReview}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-blue-500/20 transition-all transform active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Review Due Cards ({dueCards.length})</span>
            </button>
          )}

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 shadow-xs transition-all"
          >
            <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Add Card</span>
          </button>
        </div>
      </div>

      {/* ACTIVE REVIEW SESSION MODE */}
      {isReviewing && activeCard && (
        <div className="rounded-3xl border border-blue-200 dark:border-blue-900/60 bg-gradient-to-b from-blue-50/50 to-white dark:from-slate-900 dark:to-slate-950 p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                Card {reviewIndex + 1} of {dueCards.length}
              </span>
              <span className="text-xs font-medium text-slate-500">
                {subjects.find((s) => s.id === activeCard.subjectId)?.name || 'Subject'}
              </span>
            </div>

            <button
              onClick={() => setIsReviewing(false)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 px-2 py-1"
            >
              <X className="w-4 h-4" />
              <span>Exit Study</span>
            </button>
          </div>

          {/* 3D Flip Card Container */}
          <div
            onClick={() => setCardFlipped(!cardFlipped)}
            className="w-full min-h-[260px] sm:min-h-[320px] rounded-2xl cursor-pointer perspective-[1000px] select-none"
          >
            <div
              className={`w-full h-full min-h-[260px] sm:min-h-[320px] transition-transform duration-500 rounded-2xl border ${
                cardFlipped
                  ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
              } p-6 sm:p-8 flex flex-col justify-between shadow-lg relative`}
              style={{
                transformStyle: 'preserve-3d',
                transform: cardFlipped ? 'rotateY(180deg)' : 'none',
              }}
            >
              {/* Card Label */}
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span className="uppercase tracking-wider">
                  {cardFlipped ? '💡 Solution / Back' : '❓ Prompt / Front'}
                </span>
                <span className="text-[11px] font-normal flex items-center gap-1 text-slate-400">
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Click or press Space to flip</span>
                </span>
              </div>

              {/* Card Main Content with KaTeX */}
              <div
                className="my-auto py-4 text-center text-slate-900 dark:text-slate-100 text-lg sm:text-xl font-medium"
                style={{
                  transform: cardFlipped ? 'rotateY(180deg)' : 'none',
                }}
              >
                <MathRenderer
                  content={cardFlipped ? activeCard.back : activeCard.front}
                  block
                />
              </div>

              {/* Card Footer Hint */}
              <div
                className="text-center text-[11px] text-slate-400"
                style={{
                  transform: cardFlipped ? 'rotateY(180deg)' : 'none',
                }}
              >
                {!cardFlipped
                  ? 'Think of the answer, then flip to check'
                  : 'Rate how easily you recalled this information'}
              </div>
            </div>
          </div>

          {/* SM-2 Recall Rating Buttons */}
          {cardFlipped ? (
            <div className="space-y-2 pt-2 animate-in fade-in">
              <div className="text-center text-xs font-semibold text-slate-500">
                Rate Recall Difficulty (Keyboard shortcuts 1, 2, 3, 4):
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  onClick={() => handleRateCard(1)}
                  className="p-3 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 flex flex-col items-center gap-1 transition-all"
                >
                  <span className="font-bold text-sm">1. Again</span>
                  <span className="text-[10px] opacity-75">Review in &lt;1 day</span>
                </button>
                <button
                  onClick={() => handleRateCard(2)}
                  className="p-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 flex flex-col items-center gap-1 transition-all"
                >
                  <span className="font-bold text-sm">2. Hard</span>
                  <span className="text-[10px] opacity-75">Review in 1-2 days</span>
                </button>
                <button
                  onClick={() => handleRateCard(3)}
                  className="p-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 flex flex-col items-center gap-1 transition-all"
                >
                  <span className="font-bold text-sm">3. Good</span>
                  <span className="text-[10px] opacity-75">Review in 3-6 days</span>
                </button>
                <button
                  onClick={() => handleRateCard(4)}
                  className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex flex-col items-center gap-1 transition-all"
                >
                  <span className="font-bold text-sm">4. Easy</span>
                  <span className="text-[10px] opacity-75">Review in 7-14+ days</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={() => setCardFlipped(true)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs sm:text-sm font-semibold hover:opacity-90 transition-all shadow-md"
              >
                Reveal Answer (Space)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Overview Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold font-display text-slate-900 dark:text-slate-100">
              {allCards.length}
            </div>
            <div className="text-xs text-slate-500 font-medium">Total Flashcards</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold font-display text-rose-600 dark:text-rose-400">
              {dueCards.length}
            </div>
            <div className="text-xs text-slate-500 font-medium">Due for Review Today</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
            <RotateCw className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400">
              {allCards.filter((c) => c.repetitions >= 3).length}
            </div>
            <div className="text-xs text-slate-500 font-medium">Mastered Cards (3+ reps)</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Deck Listing */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Filter by Subject:
            </span>
            <select
              value={selectedSubjectFilter}
              onChange={(e) => setSelectedSubjectFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="all">All Subjects ({allCards.length})</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name} ({allCards.filter((c) => c.subjectId === sub.id).length})
                </option>
              ))}
            </select>
          </div>

          <MathCheatSheetPopover />
        </div>

        {/* Cards Grid */}
        {filteredCards.length === 0 ? (
          <div className="p-10 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-2">
            <Layers className="w-8 h-8 text-slate-400 mx-auto opacity-50" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No flashcards found in this category
            </p>
            <p className="text-xs text-slate-400">
              Add formulas, definitions, and recall questions with KaTeX support!
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Flashcard</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCards.map((card) => {
              const sub = subjects.find((s) => s.id === card.subjectId);
              const isDue = card.nextReviewDate <= todayStr;
              return (
                <div
                  key={card.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: sub?.color || '#2563EB' }}
                      >
                        {sub?.name || 'Subject'}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isDue
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {isDue ? 'Due Today' : `Review ${card.nextReviewDate}`}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 border-l-2 border-blue-500 pl-2">
                      <MathRenderer content={card.front} />
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/50 p-2 rounded-xl">
                      <MathRenderer content={card.back} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-400">
                    <span>
                      Reps: {card.repetitions} • Interval: {card.intervalDays}d
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(card)}
                        className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                        title="Edit Card"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteFlashcard(card.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                        title="Delete Card"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <form
            onSubmit={handleSaveCard}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {editingCard ? 'Edit Flashcard' : 'Create New Flashcard'}
              </h3>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Subject
                </label>
                <select
                  value={formSubjectId}
                  onChange={(e) => setFormSubjectId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Front Side (Question / Prompt)
                  </label>
                  <span className="text-[10px] text-slate-400">KaTeX formulas e.g. $E = mc^2$</span>
                </div>
                <textarea
                  value={formFront}
                  onChange={(e) => setFormFront(e.target.value)}
                  placeholder="e.g. State Bernoulli's equation for fluid dynamics: or $\nabla \cdot \vec{B} = 0$"
                  rows={3}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-2 focus:ring-blue-500"
                />
                {formFront && (
                  <div className="mt-1 p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Live Preview:</span>
                    <MathRenderer content={formFront} />
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Back Side (Answer / Solution)
                  </label>
                  <span className="text-[10px] text-slate-400">{'Block math e.g. $$P + \\frac{1}{2}\\rho v^2 = C$$'}</span>
                </div>
                <textarea
                  value={formBack}
                  onChange={(e) => setFormBack(e.target.value)}
                  placeholder="e.g. $$P + \frac{1}{2}\rho v^2 + \rho gh = \text{constant}$$"
                  rows={4}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-2 focus:ring-blue-500"
                />
                {formBack && (
                  <div className="mt-1 p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Live Preview:</span>
                    <MathRenderer content={formBack} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                {saving ? 'Saving...' : editingCard ? 'Update Card' : 'Save Flashcard'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
