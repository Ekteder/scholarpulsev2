'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Edit,
  Flame,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Target,
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
  getAdminGoalTemplatesAction,
  saveAdminGoalTemplateAction,
  deleteAdminGoalTemplateAction,
} from '@/actions/admin';
import type { GoalTemplateRecord } from '@/lib/db/schema';

export function AdminGoalsView() {
  const [templates, setTemplates] = useState<GoalTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<GoalTemplateRecord | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetType, setTargetType] = useState('daily');
  const [targetValue, setTargetValue] = useState<number>(120);
  const [period, setPeriod] = useState('daily');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<GoalTemplateRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await getAdminGoalTemplatesAction();
      if (res.success) {
        setTemplates(res.templates);
      }
    } catch (err) {
      console.error('Failed to load goal templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const q = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        t.targetType.toLowerCase().includes(q)
    );
  }, [templates, searchQuery]);

  const openNewTemplate = () => {
    setEditingTemplate(null);
    setTitle('');
    setDescription('');
    setTargetType('daily');
    setTargetValue(120);
    setPeriod('daily');
    setIsActive(true);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEditTemplate = (tmpl: GoalTemplateRecord) => {
    setEditingTemplate(tmpl);
    setTitle(tmpl.title);
    setDescription(tmpl.description || '');
    setTargetType(tmpl.targetType);
    setTargetValue(tmpl.targetValue);
    setPeriod(tmpl.period);
    setIsActive(tmpl.isActive ?? true);
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError('Goal title is required');
      return;
    }
    if (Number(targetValue) <= 0) {
      setFormError('Target value must be greater than 0');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const res = await saveAdminGoalTemplateAction({
        id: editingTemplate?.id,
        title: cleanTitle,
        description: description.trim(),
        targetType,
        targetValue: Number(targetValue),
        period,
        isActive,
      });

      if (res.success) {
        setDialogOpen(false);
        await loadTemplates();
      }
    } catch (err: any) {
      console.error('Failed to save goal template:', err);
      setFormError(err.message || 'Error saving goal template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAdminGoalTemplateAction(deleteTarget.id);
      await loadTemplates();
    } catch (err) {
      console.error('Failed to delete goal template:', err);
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
            <Target className="w-6 h-6 text-emerald-600" />
            Study Goal Templates & Target Presets
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Configure preset study goals (Daily Focus, Weekly Hours, Revision Milestones) for students to adopt.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={openNewTemplate}
            className="gap-1.5 text-xs shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Goal Template
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadTemplates}
            disabled={loading}
            className="h-8 gap-1 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search goal templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs h-9 bg-card"
          />
        </div>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Goal Presets Catalog</CardTitle>
              <CardDescription className="text-xs">
                Templates shown to students during onboarding and in the Goals module.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="font-mono text-xs">
              {filteredTemplates.length} Goals
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Goal Title</TableHead>
                <TableHead>Target Type</TableHead>
                <TableHead>Target Value</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                    No goal templates found. Click &quot;Add Goal Template&quot; to configure presets.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTemplates.map((tmpl) => (
                  <TableRow key={tmpl.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div>
                        <p className="font-semibold text-xs sm:text-sm text-foreground">{tmpl.title}</p>
                        {tmpl.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1">{tmpl.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs capitalize">
                        {tmpl.targetType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold">
                      {tmpl.targetValue}{' '}
                      <span className="text-muted-foreground font-normal">
                        {tmpl.targetType === 'daily' || tmpl.targetType === 'weekly' ? 'mins' : 'units'}
                      </span>
                    </TableCell>
                    <TableCell className="capitalize text-xs text-muted-foreground font-mono">
                      {tmpl.period}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={tmpl.isActive ? 'default' : 'secondary'} className="text-[10px]">
                        {tmpl.isActive ? 'Active' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditTemplate(tmpl)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="Edit Goal"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(tmpl)}
                          className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Delete Goal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog: Add/Edit Goal Template */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Goal Template' : 'Add Goal Template'}</DialogTitle>
            <DialogDescription className="text-xs">
              Configure standard study target benchmarks and suggested durations.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Goal Title <span className="text-destructive">*</span>
              </label>
              <Input
                name="title"
                required
                placeholder="e.g. Daily Deep Focus (2 Hours)"
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

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Description</label>
              <Input
                name="description"
                placeholder="Guidance or tips for the student..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Target Type</label>
                <select
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-card px-3 text-foreground"
                >
                  <option value="daily">Daily Minutes</option>
                  <option value="weekly">Weekly Minutes</option>
                  <option value="monthly">Monthly Minutes</option>
                  <option value="streak">Streak Days</option>
                  <option value="sessions">Session Count</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Target Value <span className="text-destructive">*</span>
                </label>
                <Input
                  type="number"
                  min="1"
                  required
                  value={targetValue}
                  onChange={(e) => setTargetValue(parseInt(e.target.value) || 0)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Evaluation Period</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full text-xs h-9 rounded-md border border-input bg-card px-3 text-foreground"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
              <div>
                <p className="text-xs font-semibold text-foreground">Recommended Status</p>
                <p className="text-[11px] text-muted-foreground">Offer to students as a 1-click preset</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSaving}>
                {isSaving ? 'Saving...' : editingTemplate ? 'Update Goal' : 'Save Goal'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Goal Deletion</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete goal preset &quot;{deleteTarget?.title}&quot;?
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
