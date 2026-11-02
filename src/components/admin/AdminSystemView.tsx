'use client';

import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Database,
  Edit,
  Mail,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
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
  getAdminSystemConfigsAction,
  saveAdminSystemConfigAction,
  getAdminAllowlistAction,
  addAdminAllowlistAction,
  removeAdminAllowlistAction,
} from '@/actions/admin';
import type { AdminAllowlistEntry, SystemConfigurationRecord } from '@/lib/db/schema';

export function AdminSystemView() {
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [allowlist, setAllowlist] = useState<AdminAllowlistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states for system settings
  const [targetExamName, setTargetExamName] = useState('HSC 2027');
  const [targetExamDate, setTargetExamDate] = useState('2027-06-01');
  const [pomodoroFocusMinutes, setPomodoroFocusMinutes] = useState('25');
  const [pomodoroShortBreak, setPomodoroShortBreak] = useState('5');
  const [pomodoroLongBreak, setPomodoroLongBreak] = useState('15');
  const [announcementBanner, setAnnouncementBanner] = useState('');
  const [maintenanceMode, setMaintenanceMode] = useState('false');
  const [savingConfigKey, setSavingConfigKey] = useState<string | null>(null);
  const [savedSuccessKey, setSavedSuccessKey] = useState<string | null>(null);

  // Allowlist modal
  const [allowlistDialogOpen, setAllowlistDialogOpen] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('admin');
  const [newAdminNotes, setNewAdminNotes] = useState('');
  const [allowlistError, setAllowlistError] = useState<string | null>(null);
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);

  // Delete admin confirmation
  const [deleteEmail, setDeleteEmail] = useState<string | null>(null);
  const [isDeletingAdmin, setIsDeletingAdmin] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cfgRes, alwRes] = await Promise.all([
        getAdminSystemConfigsAction(),
        getAdminAllowlistAction(),
      ]);

      if (cfgRes.success) {
        const map: Record<string, string> = {};
        for (const c of cfgRes.configs) {
          map[c.key] = c.value;
        }
        setConfigs(map);

        if (map['target_exam_name']) setTargetExamName(map['target_exam_name']);
        if (map['target_exam_date']) setTargetExamDate(map['target_exam_date']);
        if (map['pomodoro_focus_minutes']) setPomodoroFocusMinutes(map['pomodoro_focus_minutes']);
        if (map['pomodoro_short_break_minutes']) setPomodoroShortBreak(map['pomodoro_short_break_minutes']);
        if (map['pomodoro_long_break_minutes']) setPomodoroLongBreak(map['pomodoro_long_break_minutes']);
        if (map['announcement_banner']) setAnnouncementBanner(map['announcement_banner']);
        if (map['maintenance_mode']) setMaintenanceMode(map['maintenance_mode']);
      }

      if (alwRes.success) {
        setAllowlist(alwRes.allowlist);
      }
    } catch (err) {
      console.error('Failed to load system settings and allowlist:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSaveConfig = async (key: string, value: string, description?: string) => {
    setSavingConfigKey(key);
    try {
      const res = await saveAdminSystemConfigAction(key, value, description);
      if (res.success) {
        setConfigs((prev) => ({ ...prev, [key]: value }));
        setSavedSuccessKey(key);
        setTimeout(() => setSavedSuccessKey(null), 2500);
      }
    } catch (err) {
      console.error(`Failed to save config key ${key}:`, err);
    } finally {
      setSavingConfigKey(null);
    }
  };

  const handleSaveAllConfigs = async () => {
    setSavingConfigKey('ALL');
    try {
      await Promise.all([
        saveAdminSystemConfigAction('target_exam_name', targetExamName, 'Default target exam name for countdown burndown'),
        saveAdminSystemConfigAction('target_exam_date', targetExamDate, 'Default target exam date (YYYY-MM-DD)'),
        saveAdminSystemConfigAction('pomodoro_focus_minutes', pomodoroFocusMinutes, 'Default focus timer interval in minutes'),
        saveAdminSystemConfigAction('pomodoro_short_break_minutes', pomodoroShortBreak, 'Default short break interval in minutes'),
        saveAdminSystemConfigAction('pomodoro_long_break_minutes', pomodoroLongBreak, 'Default long break interval in minutes'),
        saveAdminSystemConfigAction('announcement_banner', announcementBanner, 'Global announcement displayed to students'),
        saveAdminSystemConfigAction('maintenance_mode', maintenanceMode, 'Maintenance mode toggle'),
      ]);
      setSavedSuccessKey('ALL');
      setTimeout(() => setSavedSuccessKey(null), 2500);
    } catch (err) {
      console.error('Failed to save all configs:', err);
    } finally {
      setSavingConfigKey(null);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAddingAdmin) return;

    const email = newAdminEmail.toLowerCase().trim();
    if (!email || !email.includes('@')) {
      setAllowlistError('Please enter a valid email address');
      return;
    }

    setIsAddingAdmin(true);
    setAllowlistError(null);

    try {
      const res = await addAdminAllowlistAction({
        email,
        role: newAdminRole,
        notes: newAdminNotes.trim(),
      });

      if (res.success) {
        setAllowlistDialogOpen(false);
        setNewAdminEmail('');
        setNewAdminNotes('');
        await loadAll();
      }
    } catch (err: any) {
      console.error('Failed to add admin allowlist entry:', err);
      setAllowlistError(err.message || 'Error adding admin');
    } finally {
      setIsAddingAdmin(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!deleteEmail) return;
    setIsDeletingAdmin(true);
    try {
      await removeAdminAllowlistAction(deleteEmail);
      await loadAll();
    } catch (err) {
      console.error('Failed to delete admin entry:', err);
    } finally {
      setIsDeletingAdmin(false);
      setDeleteEmail(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-foreground flex items-center gap-2">
            <Settings2 className="w-6 h-6 text-slate-700 dark:text-slate-300" />
            System Configurations & Admin Allowlist
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Configure platform parameters, default target exam dates, Pomodoro timers, and OAuth security allowlists.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadAll}
          disabled={loading}
          className="h-8 gap-1 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Section 1: System Settings & Target Exam */}
      <Card data-slot="card">
        <CardHeader className="p-5 pb-3 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Target Exam Date & Pomodoro System Configurations
              </CardTitle>
              <CardDescription className="text-xs">
                Platform-wide parameters that dynamically propagate to student countdown widgets and focus timers.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={handleSaveAllConfigs}
              disabled={savingConfigKey !== null}
              className="gap-1.5 text-xs shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              {savingConfigKey === 'ALL' ? 'Saving...' : savedSuccessKey === 'ALL' ? 'Saved All!' : 'Save All Settings'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Target Exam Name */}
            <div className="space-y-1.5">
              <label htmlFor="target_exam_name" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                Target Exam Name
                <Badge variant="outline" className="text-[10px] font-mono">HSC / Entrance</Badge>
              </label>
              <Input
                id="target_exam_name"
                name="target_exam_name"
                placeholder="e.g. HSC 2027"
                value={targetExamName}
                onChange={(e) => setTargetExamName(e.target.value)}
                className="text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Default examination title displayed in the Dashboard Burndown and Countdown cards.
              </p>
            </div>

            {/* Target Exam Date */}
            <div className="space-y-1.5">
              <label htmlFor="target_exam_date" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                Target Exam Date
                <Badge variant="outline" className="text-[10px] font-mono">YYYY-MM-DD</Badge>
              </label>
              <Input
                id="target_exam_date"
                name="target_exam_date"
                type="date"
                value={targetExamDate}
                onChange={(e) => setTargetExamDate(e.target.value)}
                className="text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Standard baseline exam target date used to calculate days remaining and syllabus burndown velocity.
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Pomodoro Focus Minutes */}
            <div className="space-y-1.5">
              <label htmlFor="pomodoro_focus_minutes" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                Pomodoro Focus Minutes
              </label>
              <Input
                id="pomodoro_focus_minutes"
                name="pomodoro_focus_minutes"
                type="number"
                min="1"
                max="120"
                value={pomodoroFocusMinutes}
                onChange={(e) => setPomodoroFocusMinutes(e.target.value)}
                className="text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">Default work block duration (typically 25 minutes).</p>
            </div>

            {/* Short Break */}
            <div className="space-y-1.5">
              <label htmlFor="pomodoro_short_break_minutes" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-500" />
                Short Break Minutes
              </label>
              <Input
                id="pomodoro_short_break_minutes"
                name="pomodoro_short_break_minutes"
                type="number"
                min="1"
                max="60"
                value={pomodoroShortBreak}
                onChange={(e) => setPomodoroShortBreak(e.target.value)}
                className="text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">Default short rest period (typically 5 minutes).</p>
            </div>

            {/* Long Break */}
            <div className="space-y-1.5">
              <label htmlFor="pomodoro_long_break_minutes" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-500" />
                Long Break Minutes
              </label>
              <Input
                id="pomodoro_long_break_minutes"
                name="pomodoro_long_break_minutes"
                type="number"
                min="1"
                max="90"
                value={pomodoroLongBreak}
                onChange={(e) => setPomodoroLongBreak(e.target.value)}
                className="text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">Default long rest period (typically 15 minutes).</p>
            </div>
          </div>

          <div className="border-t border-border pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="announcement_banner" className="text-xs font-semibold text-foreground">
                Platform Announcement Banner
              </label>
              <Input
                id="announcement_banner"
                name="announcement_banner"
                placeholder="Optional banner message to broadcast..."
                value={announcementBanner}
                onChange={(e) => setAnnouncementBanner(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="maintenance_mode" className="text-xs font-semibold text-foreground">
                Maintenance Mode
              </label>
              <select
                id="maintenance_mode"
                name="maintenance_mode"
                value={maintenanceMode}
                onChange={(e) => setMaintenanceMode(e.target.value)}
                className="w-full text-xs h-9 rounded-md border border-input bg-card px-3 text-foreground"
              >
                <option value="false">Operational (Active)</option>
                <option value="true">Under Maintenance</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Admin Allowlist Security */}
      <Card data-slot="card">
        <CardHeader className="p-5 pb-3 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-rose-600" />
                Admin Allowlist & Google OAuth Access Control
              </CardTitle>
              <CardDescription className="text-xs">
                Accounts granted administrative privileges. Only these emails can access /admin or trigger server mutation actions.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setAllowlistError(null);
                setAllowlistDialogOpen(true);
              }}
              className="gap-1.5 text-xs shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Admin Account
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admin Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Added By</TableHead>
                <TableHead className="text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allowlist.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                    No database allowlist entries found. (Environment variable ADMIN_EMAILS allowlist remains active as fallback).
                  </TableCell>
                </TableRow>
              ) : (
                allowlist.map((admin) => (
                  <TableRow key={admin.email} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="font-mono font-semibold text-xs text-foreground">
                          {admin.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs uppercase">
                        {admin.role || 'admin'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {admin.notes || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {admin.addedBy || 'system'}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteEmail(admin.email)}
                        className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="Remove Admin Rights"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog: Add Admin Account */}
      <Dialog open={allowlistDialogOpen} onOpenChange={setAllowlistDialogOpen}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle>Allowlist New Admin Account</DialogTitle>
            <DialogDescription className="text-xs">
              Grant administrative console access to a verified Google OAuth account.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddAdmin} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-semibold text-foreground">
                Google Account Email <span className="text-destructive">*</span>
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="admin@scholarpulse.edu"
                value={newAdminEmail}
                onChange={(e) => {
                  setNewAdminEmail(e.target.value);
                  setAllowlistError(null);
                }}
                className="text-xs font-mono"
              />
              {allowlistError && (
                <span data-slot="form-message" className="text-destructive text-[11px] block">
                  {allowlistError}
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Administrative Role</label>
              <select
                value={newAdminRole}
                onChange={(e) => setNewAdminRole(e.target.value)}
                className="w-full text-xs h-9 rounded-md border border-input bg-card px-3 text-foreground"
              >
                <option value="admin">Administrator (Full Entity CRUD)</option>
                <option value="superadmin">Superadmin (All Privileges)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="notes" className="text-xs font-semibold text-foreground">
                Reference Notes / Department
              </label>
              <Input
                id="notes"
                name="notes"
                placeholder="e.g. Lead Academic Coordinator"
                value={newAdminNotes}
                onChange={(e) => setNewAdminNotes(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setAllowlistDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isAddingAdmin}>
                {isAddingAdmin ? 'Authorizing...' : 'Authorize Admin'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Admin Removal */}
      <AlertDialog open={Boolean(deleteEmail)} onOpenChange={(open) => !open && setDeleteEmail(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Admin Access</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to revoke administrative access from &quot;{deleteEmail}&quot;?
              This user will immediately be blocked from accessing /admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAdmin} className="text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAdmin}
              disabled={isDeletingAdmin}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs"
            >
              {isDeletingAdmin ? 'Revoking...' : 'Revoke Access'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
