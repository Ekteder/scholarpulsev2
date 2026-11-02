'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpenCheck,
  Check,
  CheckCircle2,
  Edit,
  Layers,
  Plus,
  RefreshCw,
  Sparkles,
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
  getAdminCurriculumStagesAction,
  saveAdminCurriculumStageAction,
  deleteAdminCurriculumStageAction,
  reorderAdminCurriculumStagesAction,
} from '@/actions/admin';
import type { CurriculumStageRecord } from '@/lib/db/schema';

export function AdminChecklistView() {
  const [stages, setStages] = useState<CurriculumStageRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<CurriculumStageRecord | null>(null);
  const [stageId, setStageId] = useState('');
  const [stageName, setStageName] = useState('');
  const [stageColor, setStageColor] = useState('#3B82F6');
  const [stageBadgeText, setStageBadgeText] = useState('');
  const [stageWeight, setStageWeight] = useState(1);
  const [stageOrder, setStageOrder] = useState(0);
  const [stageIsActive, setStageIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete State
  const [deleteStage, setDeleteStage] = useState<CurriculumStageRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadStages = async () => {
    setLoading(true);
    try {
      const res = await getAdminCurriculumStagesAction();
      if (res.success) {
        setStages(res.stages.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)));
      }
    } catch (err) {
      console.error('Failed to load revision stages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStages();
  }, []);

  const openNewStage = () => {
    setEditingStage(null);
    setStageId(`stage_${Date.now()}`);
    setStageName('');
    setStageColor('#3B82F6');
    setStageBadgeText('');
    setStageWeight(1);
    setStageOrder(stages.length);
    setStageIsActive(true);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEditStage = (stg: CurriculumStageRecord) => {
    setEditingStage(stg);
    setStageId(stg.id);
    setStageName(stg.name);
    setStageColor(stg.color || '#3B82F6');
    setStageBadgeText(stg.badgeText || '');
    setStageWeight(stg.weight ?? 1);
    setStageOrder(stg.displayOrder ?? 0);
    setStageIsActive(stg.isActive ?? true);
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSaveStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const cleanName = stageName.trim();
    if (!cleanName) {
      setFormError('Stage name is required');
      return;
    }

    const cleanId = (editingStage ? editingStage.id : stageId.trim().toLowerCase().replace(/\s+/g, '_')) || `stage_${Date.now()}`;

    setIsSaving(true);
    setFormError(null);

    try {
      const res = await saveAdminCurriculumStageAction({
        id: cleanId,
        name: cleanName,
        color: stageColor || '#3B82F6',
        badgeText: stageBadgeText.trim() || cleanName.slice(0, 3).toUpperCase(),
        weight: Number(stageWeight) || 1,
        displayOrder: Number(stageOrder) || 0,
        isActive: stageIsActive,
      });

      if (res.success) {
        setDialogOpen(false);
        await loadStages();
      }
    } catch (err: any) {
      console.error('Failed to save stage:', err);
      setFormError(err.message || 'Error saving stage');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteStage) return;
    setIsDeleting(true);
    try {
      await deleteAdminCurriculumStageAction(deleteStage.id);
      await loadStages();
    } catch (err) {
      console.error('Failed to delete stage:', err);
    } finally {
      setIsDeleting(false);
      setDeleteStage(null);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const newStages = [...stages];
    const temp = newStages[index];
    newStages[index] = newStages[targetIndex];
    newStages[targetIndex] = temp;

    const stageIds = newStages.map((s) => s.id);
    setStages(newStages);

    try {
      await reorderAdminCurriculumStagesAction(stageIds);
      await loadStages();
    } catch (err) {
      console.error('Failed to reorder stages:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-foreground flex items-center gap-2">
            <BookOpenCheck className="w-6 h-6 text-indigo-600" />
            Revision Checklist Stages & Taxonomy
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Configure the structured revision stages (Class, Revision Note, Book Reading, MCQ, CQ, Test Paper) and their weights.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={openNewStage}
            className="gap-1.5 text-xs shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Revision Stage
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadStages}
            disabled={loading}
            className="h-8 gap-1 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stages Table Card */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Configured Revision Stages</CardTitle>
              <CardDescription className="text-xs">
                These stages define the columns in student revision matrices and progress bars.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="font-mono text-xs">
              {stages.length} Stages
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">Order</TableHead>
                <TableHead>Stage Name</TableHead>
                <TableHead>Short Badge</TableHead>
                <TableHead>Color Swatch</TableHead>
                <TableHead className="text-center">Weight</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right pr-4">Reorder / Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                    No custom stages in DB. Application falls back to standard 6 stages (Class, Revision Note, Book Reading, MCQ, CQ, Test Paper).
                  </TableCell>
                </TableRow>
              ) : (
                stages.map((stg, index) => (
                  <TableRow key={stg.id} className="hover:bg-muted/50">
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">
                      {stg.displayOrder ?? index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: stg.color || '#3B82F6' }}
                        />
                        <span className="font-semibold text-foreground text-xs sm:text-sm">
                          {stg.name}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground">({stg.id})</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="font-mono text-xs font-bold"
                        style={{ color: stg.color || '#3B82F6', borderColor: stg.color || '#3B82F6' }}
                      >
                        {stg.badgeText || stg.name.slice(0, 3).toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {stg.color || '#3B82F6'}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs">
                      {stg.weight ?? 1}x
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={stg.isActive ? 'default' : 'secondary'} className="text-[10px]">
                        {stg.isActive ? 'Active' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={index === 0}
                          onClick={() => handleMove(index, 'up')}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={index === stages.length - 1}
                          onClick={() => handleMove(index, 'down')}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditStage(stg)}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Edit Stage"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteStage(stg)}
                          className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Delete Stage"
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

      {/* Dialog: Add/Edit Stage */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle>{editingStage ? 'Edit Revision Stage' : 'Add Revision Stage'}</DialogTitle>
            <DialogDescription className="text-xs">
              Configure checklist stage taxonomy, color swatch, weight, and short badge.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveStage} className="space-y-4 pt-2">
            {!editingStage && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Stage Identifier (Key)</label>
                <Input
                  required
                  placeholder="e.g. test_paper_solving"
                  value={stageId}
                  onChange={(e) => setStageId(e.target.value)}
                  className="text-xs font-mono lowercase"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Stage Label / Name <span className="text-destructive">*</span>
              </label>
              <Input
                required
                placeholder="e.g. Test Paper Solving"
                value={stageName}
                onChange={(e) => {
                  setStageName(e.target.value);
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
                <label className="text-xs font-semibold text-foreground">Short Badge Text</label>
                <Input
                  placeholder="e.g. TPS"
                  maxLength={5}
                  value={stageBadgeText}
                  onChange={(e) => setStageBadgeText(e.target.value.toUpperCase())}
                  className="text-xs font-mono uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Progress Weight</label>
                <Input
                  type="number"
                  min="1"
                  value={stageWeight}
                  onChange={(e) => setStageWeight(parseInt(e.target.value) || 1)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Stage Accent Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={stageColor.startsWith('#') && stageColor.length === 7 ? stageColor : '#3B82F6'}
                  onChange={(e) => setStageColor(e.target.value)}
                  className="w-9 h-9 p-0.5 rounded border border-border cursor-pointer bg-transparent shrink-0"
                />
                <Input
                  value={stageColor}
                  onChange={(e) => setStageColor(e.target.value)}
                  className="text-xs font-mono uppercase"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
              <div>
                <p className="text-xs font-semibold text-foreground">Stage Active</p>
                <p className="text-[11px] text-muted-foreground">Visible in student revision matrices</p>
              </div>
              <Switch checked={stageIsActive} onCheckedChange={setStageIsActive} />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSaving}>
                {isSaving ? 'Saving...' : editingStage ? 'Update Stage' : 'Save Stage'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={Boolean(deleteStage)} onOpenChange={(open) => !open && setDeleteStage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Stage Deletion</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete stage &quot;{deleteStage?.name}&quot;?
              Student revision records referencing this stage will be affected.
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
