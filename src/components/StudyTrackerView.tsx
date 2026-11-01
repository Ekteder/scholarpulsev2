'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  formatDurationHuman,
  toDateStringInTz,
  toTimeStringInTz,
} from '@/lib/timezone';
import { StudySession } from '@/types';
import {
  AlertCircle,
  Clock,
  Edit3,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const sessionFormSchema = z.object({
  subjectId: z.string().min(1, 'Please select a subject'),
  studyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date required'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time required'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time required'),
  topic: z.string().min(1, 'Study topic is required').max(180),
  notes: z.string().max(2000).optional(),
  productivityRating: z.number().min(1).max(5),
});

type SessionFormValues = z.infer<typeof sessionFormSchema>;

export function StudyTrackerView() {
  const { data, createSession, updateSession, deleteSession } = useWorkspace();
  const [editingSession, setEditingSession] = useState<StudySession | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const timezone = data?.profile?.timezone || 'Asia/Dhaka';
  const todayYmd = toDateStringInTz(new Date(), timezone);
  const activeSubjects = useMemo(
    () => (data?.subjects || []).filter((s) => !s.isArchived),
    [data?.subjects]
  );

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SessionFormValues>({
    resolver: zodResolver(sessionFormSchema),
    defaultValues: {
      subjectId: activeSubjects[0]?.id || '',
      studyDate: todayYmd,
      startTime: '09:00',
      endTime: '10:30',
      topic: '',
      notes: '',
      productivityRating: 4,
    },
  });

  useEffect(() => {
    if (!watch('subjectId') && activeSubjects.length > 0) {
      setValue('subjectId', activeSubjects[0].id);
    }
  }, [activeSubjects, setValue, watch]);

  const watchedDate = watch('studyDate');
  const watchedStart = watch('startTime');
  const watchedEnd = watch('endTime');
  const watchedRating = watch('productivityRating');

  // Automatically calculate duration from timestamps and detect overlaps
  const calculatedDurationInfo = useMemo(() => {
    if (!watchedDate || !watchedStart || !watchedEnd) {
      return { seconds: 0, valid: false, overlapping: false, message: 'Select date, start time, and end time' };
    }
    const startDt = new Date(`${watchedDate}T${watchedStart}:00`);
    const endDt = new Date(`${watchedDate}T${watchedEnd}:00`);
    const diffSec = Math.round((endDt.getTime() - startDt.getTime()) / 1000);
    if (isNaN(diffSec) || diffSec <= 0) {
      return {
        seconds: 0,
        valid: false,
        overlapping: false,
        message: 'End time must be after start time on the selected date.',
      };
    }

    // Check for overlap with existing recorded study sessions
    const overlapping = (data?.studySessions || []).find((s) => {
      if (editingSession && s.id === editingSession.id) return false;
      const sStart = new Date(s.startTime).getTime();
      const sEnd = new Date(s.endTime).getTime();
      return startDt.getTime() < sEnd && endDt.getTime() > sStart;
    });

    if (overlapping) {
      const overlapStart = toTimeStringInTz(overlapping.startTime, timezone);
      const overlapEnd = toTimeStringInTz(overlapping.endTime, timezone);
      return {
        seconds: diffSec,
        valid: false,
        overlapping: true,
        message: `Overlaps with "${overlapping.topic}" (${overlapStart} - ${overlapEnd})`,
      };
    }

    return {
      seconds: diffSec,
      valid: true,
      overlapping: false,
      message: formatDurationHuman(diffSec),
    };
  }, [watchedDate, watchedStart, watchedEnd, data?.studySessions, editingSession, timezone]);

  const handleStartEdit = (session: StudySession) => {
    setEditingSession(session);
    setServerError(null);
    setValue('subjectId', session.subjectId);
    setValue('studyDate', toDateStringInTz(session.startTime, timezone));
    setValue('startTime', toTimeStringInTz(session.startTime, timezone));
    setValue('endTime', toTimeStringInTz(session.endTime, timezone));
    setValue('topic', session.topic);
    setValue('notes', session.notes || '');
    setValue('productivityRating', session.productivityRating || 4);
  };

  const handleCancelEdit = () => {
    setEditingSession(null);
    setServerError(null);
    reset({
      subjectId: activeSubjects[0]?.id || '',
      studyDate: todayYmd,
      startTime: '09:00',
      endTime: '10:30',
      topic: '',
      notes: '',
      productivityRating: 4,
    });
  };

  const onSubmit = async (values: SessionFormValues) => {
    setServerError(null);
    const startDt = new Date(`${values.studyDate}T${values.startTime}:00`);
    const endDt = new Date(`${values.studyDate}T${values.endTime}:00`);

    if (endDt.getTime() <= startDt.getTime()) {
      setServerError('End time must be later than start time.');
      return;
    }

    if (endDt.getTime() > Date.now() + 5 * 60 * 1000) {
      setServerError('Cannot log a completed study session in the future.');
      return;
    }

    if (calculatedDurationInfo.overlapping) {
      setServerError(calculatedDurationInfo.message);
      return;
    }

    try {
      if (editingSession) {
        await updateSession(editingSession.id, {
          subjectId: values.subjectId,
          startTime: startDt.toISOString(),
          endTime: endDt.toISOString(),
          topic: values.topic,
          notes: values.notes || '',
          productivityRating: values.productivityRating,
        });
        setEditingSession(null);
      } else {
        await createSession({
          subjectId: values.subjectId,
          startTime: startDt.toISOString(),
          endTime: endDt.toISOString(),
          topic: values.topic,
          notes: values.notes || '',
          productivityRating: values.productivityRating,
          sessionType: 'manual',
        });
      }

      reset({
        subjectId: values.subjectId,
        studyDate: values.studyDate,
        startTime: values.endTime,
        endTime: values.endTime,
        topic: '',
        notes: '',
        productivityRating: 4,
      });
    } catch (err: any) {
      setServerError(err.message || 'Could not save study session.');
    }
  };

  if (!data) return null;

  const subjectMap = new Map(data.subjects.map((s) => [s.id, s]));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Manual Study Entry Form */}
      <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              {editingSession ? 'Edit Study Session' : 'Log Manual Study Session'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Duration is calculated automatically from start and end timestamps
            </p>
          </div>
          {editingSession && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel Edit</span>
            </button>
          )}
        </div>

        {serverError && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Subject
            </label>
            <select
              {...register('subjectId')}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {data.subjects
                .filter((s) => !s.isArchived || s.id === editingSession?.subjectId)
                .map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} {sub.isArchived ? '(Archived)' : ''}
                  </option>
                ))}
            </select>
            {errors.subjectId && (
              <p className="text-xs text-red-600 mt-1">{errors.subjectId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Study Date
              </label>
              <input
                type="date"
                max={todayYmd}
                {...register('studyDate')}
                className="w-full px-2.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Start Time
              </label>
              <input
                type="time"
                {...register('startTime')}
                className="w-full px-2.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                End Time
              </label>
              <input
                type="time"
                {...register('endTime')}
                className="w-full px-2.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Automatic Calculated Duration Box */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Calculated Duration:</span>
            </span>
            <span
              className={`font-mono tabular-nums font-semibold ${
                calculatedDurationInfo.valid
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {calculatedDurationInfo.message}
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Study Topic
            </label>
            <input
              type="text"
              placeholder="e.g., Wave Optics Problem Set"
              {...register('topic')}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.topic && (
              <p className="text-xs text-red-600 mt-1">{errors.topic.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description or Study Notes (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="Summarize concepts covered, page numbers, or key takeaways..."
              {...register('notes')}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Productivity Rating (Optional)
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setValue('productivityRating', r)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                    watchedRating === r
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {r} / 5
                </button>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || !calculatedDurationInfo.valid}
            className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 h-auto"
          >
            <Plus className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Saving...'
                : editingSession
                ? 'Update Study Session'
                : 'Record Study Session'}
            </span>
          </Button>
        </form>
      </div>

      {/* Right Column: Recent Recorded Study Sessions */}
      <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Recent Study Sessions
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click Edit or Delete to adjust any recorded session (analytics and goals recalculate automatically)
            </p>
          </div>
          <span className="font-mono tabular-nums text-xs text-slate-500">
            {data.studySessions.length} total logs
          </span>
        </div>

        {data.studySessions.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            No study sessions recorded yet. Use the form on the left or the Study Timer to log your first session.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.studySessions.slice(0, 12).map((sess) => {
              const subj = subjectMap.get(sess.subjectId);
              const dateStr = toDateStringInTz(sess.startTime, timezone);
              const startStr = toTimeStringInTz(sess.startTime, timezone);
              const endStr = toTimeStringInTz(sess.endTime, timezone);

              return (
                <div
                  key={sess.id}
                  className="py-3.5 flex items-start justify-between gap-4"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: subj?.color || '#2563EB' }}
                      />
                      <span className="text-xs font-semibold text-slate-900 dark:text-white">
                        {subj?.name || 'Subject'}
                      </span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                        {sess.topic}
                      </span>
                    </div>

                    {sess.notes && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {sess.notes}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      <span>{dateStr}</span>
                      <span>·</span>
                      <span>
                        {startStr} – {endStr}
                      </span>
                      <span>·</span>
                      <span className="capitalize">{sess.sessionType}</span>
                      {sess.productivityRating && (
                        <>
                          <span>·</span>
                          <span>Rating {sess.productivityRating}/5</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono tabular-nums text-xs font-bold text-blue-600 dark:text-blue-400 mr-1">
                      {formatDurationHuman(sess.durationSeconds)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(sess)}
                      title="Edit Session"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingSessionId(sess.id)}
                      title="Delete Session"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Dialog for Deleting Session */}
      {deletingSessionId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Delete Study Session?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              This will permanently remove this study log and automatically recalculate
              your subject totals, goal completion progress, and study streaks.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeletingSessionId(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer h-auto"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  const id = deletingSessionId;
                  setDeletingSessionId(null);
                  await deleteSession(id);
                }}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer h-auto"
              >
                Delete Session
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
