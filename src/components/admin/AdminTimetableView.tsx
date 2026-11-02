'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Edit,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  getAdminScheduleTemplatesAction,
  saveAdminScheduleTemplateAction,
  deleteAdminScheduleTemplateAction,
  getAdminSubjectsAction,
} from '@/actions/admin';
import type { ScheduleTemplateRecord } from '@/lib/db/schema';
import type { CurriculumSubject } from '@/types/index';

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function AdminTimetableView() {
  const [schedules, setSchedules] = useState<ScheduleTemplateRecord[]>([]);
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | 'all'>('all');

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleTemplateRecord | null>(null);
  const [title, setTitle] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [subjectId, setSubjectId] = useState<string>('');
  const [activityType, setActivityType] = useState('study');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<ScheduleTemplateRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [schRes, subRes] = await Promise.all([
        getAdminScheduleTemplatesAction(),
        getAdminSubjectsAction(),
      ]);
      if (schRes.success) setSchedules(schRes.templates);
      if (subRes.success) setSubjects(subRes.subjects);
    } catch (err) {
      console.error('Failed to load schedule templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredSchedules = useMemo(() => {
    if (selectedDay === 'all') return schedules;
    return schedules.filter((s) => s.dayOfWeek === selectedDay);
  }, [schedules, selectedDay]);

  const openNewSchedule = () => {
    setEditingSchedule(null);
    setTitle('');
    setDayOfWeek(1);
    setStartTime('09:00');
    setEndTime('11:00');
    setSubjectId(subjects[0]?.id || '');
    setActivityType('study');
    setIsActive(true);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEditSchedule = (sch: ScheduleTemplateRecord) => {
    setEditingSchedule(sch);
    setTitle(sch.title);
    setDayOfWeek(sch.dayOfWeek);
    setStartTime(sch.startTime);
    setEndTime(sch.endTime);
    setSubjectId(sch.subjectId || '');
    setActivityType(sch.activityType || 'study');
    setIsActive(sch.isActive ?? true);
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError('Schedule title is required');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const res = await saveAdminScheduleTemplateAction({
        id: editingSchedule?.id,
        title: cleanTitle,
        dayOfWeek: Number(dayOfWeek),
        startTime,
        endTime,
        subjectId: subjectId || null,
        activityType,
        isActive,
      });

      if (res.success) {
        setDialogOpen(false);
        await loadData();
      }
    } catch (err: any) {
      console.error('Failed to save schedule template:', err);
      setFormError(err.message || 'Error saving timetable preset');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAdminScheduleTemplateAction(deleteTarget.id);
      await loadData();
    } catch (err) {
      console.error('Failed to delete schedule template:', err);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-foreground flex items-center gap-2">
            <Calendar className="w-6 h-6 text-amber-600" />
            Timetable Schedules & Routine Presets
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Configure preset weekly timetable slots and routine schedules that students can import.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={openNewSchedule}
            className="gap-1.5 text-xs shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Schedule Preset
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-8 gap-1 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Weekday Selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <Button
          variant={selectedDay === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedDay('all')}
          className="text-xs h-8"
        >
          All Days ({schedules.length})
        </Button>
        {WEEKDAYS.map((day, idx) => {
          const count = schedules.filter((s) => s.dayOfWeek === idx).length;
          return (
            <Button
              key={day}
              variant={selectedDay === idx ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedDay(idx)}
              className="text-xs h-8 whitespace-nowrap"
            >
              {day.slice(0, 3)} ({count})
            </Button>
          );
        })}
      </div>

      {/* Timetable Table */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Weekly Schedule Presets</CardTitle>
              <CardDescription className="text-xs">
                Time-blocked routines suggested to students for balanced syllabus coverage.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="font-mono text-xs">
              {filteredSchedules.length} Slots
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>Routine / Slot Title</TableHead>
                <TableHead>Time Window</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Activity Type</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSchedules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                    No schedule presets found. Click &quot;Add Schedule Preset&quot; to configure routine slots.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSchedules.map((sch) => {
                  const sub = subjects.find((s) => s.id === sch.subjectId);
                  return (
                    <TableRow key={sch.id} className="hover:bg-muted/50">
                      <TableCell className="font-semibold text-xs text-foreground">
                        {WEEKDAYS[sch.dayOfWeek] || `Day ${sch.dayOfWeek}`}
                      </TableCell>
                      <TableCell className="font-medium text-xs sm:text-sm text-foreground">
                        {sch.title}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {sch.startTime} – {sch.endTime}
                      </TableCell>
                      <TableCell className="text-xs">
                        {sub ? (
                          <Badge variant="outline" style={{ borderColor: sub.color || '#2563EB' }}>
                            {sub.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">General</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize text-[11px]">
                          {sch.activityType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={sch.isActive ? 'default' : 'secondary'} className="text-[10px]">
                          {sch.isActive ? 'Active' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditSchedule(sch)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(sch)}
                            className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog: Add/Edit Timetable Slot */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? 'Edit Schedule Preset' : 'Add Schedule Preset'}</DialogTitle>
            <DialogDescription className="text-xs">
              Configure weekly routine time window and suggested subject focus.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Slot Title <span className="text-destructive">*</span>
              </label>
              <Input
                required
                placeholder="e.g. Morning Deep Physics Practice"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setFormError(null);
                }}
                className="text-xs"
              />
              {formError && (
                <span data-slot="form-message" className="text-destructive text-[11px] block">
                  {formError}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Day of Week</label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(parseInt(e.target.value) || 0)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-card px-3 text-foreground"
                >
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Activity Type</label>
                <select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-card px-3 text-foreground"
                >
                  <option value="study">Study</option>
                  <option value="revision">Revision</option>
                  <option value="exam_prep">Exam Prep</option>
                  <option value="break">Break / Wellness</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Start Time</label>
                <Input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">End Time</label>
                <Input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Target Subject (Optional)</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full text-xs h-9 rounded-md border border-input bg-card px-3 text-foreground"
              >
                <option value="">None (General Study)</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
              <div>
                <p className="text-xs font-semibold text-foreground">Active Preset</p>
                <p className="text-[11px] text-muted-foreground">Available to students in routine planner</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSaving}>
                {isSaving ? 'Saving...' : editingSchedule ? 'Update Preset' : 'Save Preset'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Routine Deletion</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete routine slot &quot;{deleteTarget?.title}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs"
            >
              {isDeleting ? 'Deleting...' : 'Confirm Deletion'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
