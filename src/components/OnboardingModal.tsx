'use client';

import React, { useState } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { SUPPORTED_TIMEZONES } from '@/lib/timezone';
import {
  BookOpen,
  Check,
  Clock,
  Globe,
  Plus,
  Sparkles,
  User as UserIcon,
  X,
} from 'lucide-react';

const SUGGESTED_SUBJECTS = [
  { name: 'Physics', color: '#2563EB', description: 'Mechanics, Electromagnetism & Modern Physics', dailyTargetMinutes: 90, weeklyTargetMinutes: 450 },
  { name: 'Chemistry', color: '#0891B2', description: 'Organic, Inorganic & Physical Chemistry', dailyTargetMinutes: 60, weeklyTargetMinutes: 360 },
  { name: 'Biology', color: '#16A34A', description: 'Cell Biology, Genetics & Physiology', dailyTargetMinutes: 60, weeklyTargetMinutes: 300 },
  { name: 'Mathematics', color: '#9333EA', description: 'Calculus, Algebra & Trigonometry', dailyTargetMinutes: 90, weeklyTargetMinutes: 450 },
  { name: 'ICT', color: '#2563EB', description: 'Programming, Networking & Digital Logic', dailyTargetMinutes: 45, weeklyTargetMinutes: 240 },
  { name: 'English', color: '#D97706', description: 'Academic Writing, Grammar & Literature', dailyTargetMinutes: 45, weeklyTargetMinutes: 240 },
];

const SUBJECT_COLORS = [
  '#2563EB',
  '#2563EB',
  '#0891B2',
  '#16A34A',
  '#D97706',
  '#DC2626',
  '#9333EA',
  '#DB2777',
];

export function OnboardingModal() {
  const { data, user, completeOnboarding } = useWorkspace();
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState(
    data?.profile?.fullName && data.profile.fullName !== 'Student Scholar'
      ? data.profile.fullName
      : user?.name || ''
  );
  const [avatarUrl, setAvatarUrl] = useState(
    data?.profile?.avatarUrl || user?.avatarUrl || ''
  );
  const [dailyTargetHours, setDailyTargetHours] = useState(6);
  const [preferredStudyTime, setPreferredStudyTime] = useState('evening');
  const [timezone, setTimezone] = useState(data?.profile?.timezone || 'Asia/Dhaka');

  const [selectedSubjects, setSelectedSubjects] = useState<
    Array<{
      name: string;
      description: string;
      color: string;
      icon: string;
      dailyTargetMinutes: number;
      weeklyTargetMinutes: number;
    }>
  >([
    { ...SUGGESTED_SUBJECTS[0], icon: 'BookOpen' },
    { ...SUGGESTED_SUBJECTS[1], icon: 'BookOpen' },
    { ...SUGGESTED_SUBJECTS[3], icon: 'BookOpen' },
  ]);

  const [customSubjectName, setCustomSubjectName] = useState('');
  const [customSubjectColor, setCustomSubjectColor] = useState('#2563EB');
  const [submitting, setSubmitting] = useState(false);

  const toggleSuggestedSubject = (subj: (typeof SUGGESTED_SUBJECTS)[0]) => {
    const exists = selectedSubjects.some(
      (s) => s.name.toLowerCase() === subj.name.toLowerCase()
    );
    if (exists) {
      setSelectedSubjects((prev) =>
        prev.filter((s) => s.name.toLowerCase() !== subj.name.toLowerCase())
      );
    } else {
      setSelectedSubjects((prev) => [
        ...prev,
        { ...subj, icon: 'BookOpen' },
      ]);
    }
  };

  const handleAddCustomSubject = () => {
    const trimmed = customSubjectName.trim();
    if (!trimmed) return;
    if (selectedSubjects.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setCustomSubjectName('');
      return;
    }
    setSelectedSubjects((prev) => [
      ...prev,
      {
        name: trimmed,
        description: 'Custom academic subject',
        color: customSubjectColor,
        icon: 'BookOpen',
        dailyTargetMinutes: 60,
        weeklyTargetMinutes: 300,
      },
    ]);
    setCustomSubjectName('');
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await completeOnboarding({
        fullName: fullName.trim() || 'Student Scholar',
        avatarUrl: avatarUrl.trim(),
        dailyStudyTargetMinutes: Math.max(30, Math.round(dailyTargetHours * 60)),
        preferredStudyTime,
        timezone: timezone || 'Asia/Dhaka',
        initialSubjects: selectedSubjects,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-xl space-y-6 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Set Up Your Study Workspace
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Step {step} of 2 · Configure your study routine and initial subjects
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-8 h-1.5 rounded-full ${
                step >= 1 ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-800'
              }`}
            />
            <span
              className={`w-8 h-1.5 rounded-full ${
                step === 2 ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-800'
              }`}
            />
          </div>
        </div>

        <form onSubmit={handleFinish} className="space-y-6">
          {step === 1 ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Your Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Profile Picture URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Daily Study Target (Hours)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max="14"
                      step="0.5"
                      value={dailyTargetHours}
                      onChange={(e) => setDailyTargetHours(Number(e.target.value))}
                      className="flex-1 accent-blue-600"
                    />
                    <span className="font-mono tabular-nums text-sm font-semibold text-blue-600 dark:text-blue-400 w-16 text-right">
                      {dailyTargetHours} hrs
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Preferred Study Window
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <select
                      value={preferredStudyTime}
                      onChange={(e) => setPreferredStudyTime(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="morning">Morning (5:00 AM – 12:00 PM)</option>
                      <option value="afternoon">Afternoon (12:00 PM – 5:00 PM)</option>
                      <option value="evening">Evening (5:00 PM – 10:00 PM)</option>
                      <option value="night">Late Night (10:00 PM – 3:00 AM)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Your Time Zone (Used for Daily Goals & Streaks)
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    {SUPPORTED_TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors cursor-pointer"
                >
                  Next: Choose Subjects
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Quick-Select Suggested Subjects (Optional — Click to Toggle)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {SUGGESTED_SUBJECTS.map((subj) => {
                    const isSelected = selectedSubjects.some(
                      (s) => s.name.toLowerCase() === subj.name.toLowerCase()
                    );
                    return (
                      <button
                        key={subj.name}
                        type="button"
                        onClick={() => toggleSuggestedSubject(subj)}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-slate-900 dark:text-white'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: subj.color }}
                          />
                          <span className="text-xs font-semibold truncate">
                            {subj.name}
                          </span>
                        </div>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add Custom Subject */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Add a Custom Subject
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={customSubjectName}
                    onChange={(e) => setCustomSubjectName(e.target.value)}
                    placeholder="e.g., Economics, Computer Science, History..."
                    className="flex-1 min-w-[180px] px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-1">
                    {SUBJECT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCustomSubjectColor(c)}
                        className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                          customSubjectColor === c ? 'scale-110 ring-2 ring-offset-1 ring-slate-400' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCustomSubject}
                    className="px-3 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Selected Subjects Preview */}
              {selectedSubjects.length > 0 && (
                <div className="space-y-2">
                  <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Your Selected Subjects ({selectedSubjects.length})
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {selectedSubjects.map((s) => (
                      <div
                        key={s.name}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        <span>{s.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedSubjects((prev) =>
                              prev.filter((item) => item.name !== s.name)
                            )
                          }
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>{submitting ? 'Setting up workspace...' : 'Launch Dashboard'}</span>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
