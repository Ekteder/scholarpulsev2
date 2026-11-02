'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Award,
  CheckCircle2,
  Edit,
  Flame,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Zap,
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
import {
  getAdminAchievementsAction,
  saveAdminAchievementAction,
  deleteAdminAchievementAction,
} from '@/actions/admin';
import type { AchievementCatalogItem } from '@/types/index';

export function AdminBadgesView() {
  const [achievements, setAchievements] = useState<AchievementCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<AchievementCatalogItem | null>(null);
  const [badgeId, setBadgeId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('Sparkles');
  const [category, setCategory] = useState('milestone');
  const [requirementType, setRequirementType] = useState('sessions_count');
  const [requirementValue, setRequirementValue] = useState<number>(10);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<AchievementCatalogItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadBadges = async () => {
    setLoading(true);
    try {
      const res = await getAdminAchievementsAction();
      if (res.success) {
        setAchievements(res.achievements);
      }
    } catch (err) {
      console.error('Failed to load achievement badges:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBadges();
  }, []);

  const filteredBadges = useMemo(() => {
    if (!searchQuery.trim()) return achievements;
    const q = searchQuery.toLowerCase();
    return achievements.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q)
    );
  }, [achievements, searchQuery]);

  const openNewBadge = () => {
    setEditingBadge(null);
    setBadgeId(`badge_${Date.now()}`);
    setTitle('');
    setDescription('');
    setIcon('Sparkles');
    setCategory('milestone');
    setRequirementType('sessions_count');
    setRequirementValue(10);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEditBadge = (b: AchievementCatalogItem) => {
    setEditingBadge(b);
    setBadgeId(b.id);
    setTitle(b.title);
    setDescription(b.description);
    setIcon(b.icon || 'Sparkles');
    setCategory(b.category);
    setRequirementType(b.requirementType);
    setRequirementValue(b.requirementValue);
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const cleanTitle = title.trim();
    const cleanId = (editingBadge ? editingBadge.id : badgeId.trim().toLowerCase().replace(/\s+/g, '_')) || `badge_${Date.now()}`;

    if (!cleanTitle) {
      setFormError('Badge title is required');
      return;
    }
    if (!description.trim()) {
      setFormError('Badge description is required');
      return;
    }
    if (Number(requirementValue) <= 0) {
      setFormError('Requirement value must be positive');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const res = await saveAdminAchievementAction({
        id: cleanId,
        title: cleanTitle,
        description: description.trim(),
        icon,
        category,
        requirementType,
        requirementValue: Number(requirementValue),
      });

      if (res.success) {
        setDialogOpen(false);
        await loadBadges();
      }
    } catch (err: any) {
      console.error('Failed to save achievement badge:', err);
      setFormError(err.message || 'Error saving achievement badge');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAdminAchievementAction(deleteTarget.id);
      await loadBadges();
    } catch (err) {
      console.error('Failed to delete badge:', err);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-foreground flex items-center gap-2">
            <Award className="w-6 h-6 text-purple-600" />
            Achievement Badges & Gamification Catalog
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Configure unlockable achievement badges, focus milestones, streak milestones, and task unlocks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={openNewBadge}
            className="gap-1.5 text-xs shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Achievement Badge
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadBadges}
            disabled={loading}
            className="h-8 gap-1 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search Input */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search badges by title, id, category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs h-9 bg-card"
          />
        </div>
      </div>

      {/* Badges Table */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Active Badges Catalog</CardTitle>
              <CardDescription className="text-xs">
                Rendered across student Achievements view and profile rank unlocks.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="font-mono text-xs">
              {filteredBadges.length} Badges
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Badge ID / Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Requirement Type</TableHead>
                <TableHead className="text-center">Threshold</TableHead>
                <TableHead>Icon</TableHead>
                <TableHead className="text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBadges.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                    No achievement badges found. Click &quot;Add Achievement Badge&quot; to configure unlocks.
                  </TableCell>
                </TableRow>
              ) : (
                filteredBadges.map((badge) => (
                  <TableRow key={badge.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div>
                        <p className="font-semibold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          {badge.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{badge.description}</p>
                        <span className="text-[10px] font-mono text-muted-foreground/80">{badge.id}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs font-mono">
                        {badge.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {badge.requirementType}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs font-bold text-foreground">
                      {badge.requirementValue}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {badge.icon || 'Sparkles'}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditBadge(badge)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="Edit Badge"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(badge)}
                          className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Delete Badge"
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

      {/* Dialog: Add/Edit Badge */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle>{editingBadge ? 'Edit Achievement Badge' : 'Add Achievement Badge'}</DialogTitle>
            <DialogDescription className="text-xs">
              Configure gamification unlock criteria and student milestone rewards.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            {!editingBadge && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Badge ID</label>
                <Input
                  required
                  placeholder="e.g. deep_focus_100_hours"
                  value={badgeId}
                  onChange={(e) => setBadgeId(e.target.value)}
                  className="text-xs font-mono lowercase"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Badge Title <span className="text-destructive">*</span>
              </label>
              <Input
                required
                placeholder="e.g. Century Club: 100 Deep Hours"
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
              <label className="text-xs font-semibold text-foreground">
                Description <span className="text-destructive">*</span>
              </label>
              <Input
                required
                placeholder="e.g. Complete 100 accumulated hours of logged study."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-card px-3 text-foreground"
                >
                  <option value="milestone">Milestone</option>
                  <option value="streak">Streak</option>
                  <option value="consistency">Consistency</option>
                  <option value="tasks">Tasks</option>
                  <option value="revision">Revision</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Icon</label>
                <select
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-card px-3 text-foreground"
                >
                  <option value="Sparkles">Sparkles</option>
                  <option value="Trophy">Trophy</option>
                  <option value="Award">Award</option>
                  <option value="Flame">Flame</option>
                  <option value="Star">Star</option>
                  <option value="Zap">Zap</option>
                  <option value="Clock">Clock</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Requirement Type</label>
                <select
                  value={requirementType}
                  onChange={(e) => setRequirementType(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-card px-3 text-foreground"
                >
                  <option value="sessions_count">Session Count</option>
                  <option value="total_hours">Total Hours</option>
                  <option value="streak_days">Streak Days</option>
                  <option value="completed_tasks">Completed Tasks</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Threshold Value <span className="text-destructive">*</span>
                </label>
                <Input
                  type="number"
                  min="1"
                  required
                  value={requirementValue}
                  onChange={(e) => setRequirementValue(parseInt(e.target.value) || 1)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSaving}>
                {isSaving ? 'Saving...' : editingBadge ? 'Update Badge' : 'Save Badge'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Badge Deletion</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete badge &quot;{deleteTarget?.title}&quot;?
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
