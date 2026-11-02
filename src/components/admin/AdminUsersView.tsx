'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Ban,
  CheckCircle,
  Copy,
  Check,
  Megaphone,
  Edit,
  Clock,
  BookOpen,
  Calendar,
  Award,
  Sparkles,
  ExternalLink,
  Trash2,
  Send,
  AlertTriangle,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  getAdminUsersListAction,
  getAdminUserDetailAction,
  updateAdminUserDetailAction,
  toggleAdminUserBanAction,
  setAdminUserTargetedAnnouncementAction,
} from '@/actions/admin';
import type { AdminUserListItem, AdminUserDetailResult } from '@/lib/db/repository';
import { SUPPORTED_TIMEZONES } from '@/lib/timezone';

export function AdminUsersView() {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // User detail inspection & edit state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailUser, setDetailUser] = useState<AdminUserDetailResult | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Editable form fields
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAvatarUrl, setFormAvatarUrl] = useState('');
  const [formDailyTargetMinutes, setFormDailyTargetMinutes] = useState(360);
  const [formDailyTargetHours, setFormDailyTargetHours] = useState('6.0');
  const [formPreferredStudyTime, setFormPreferredStudyTime] = useState('evening');
  const [formTimezone, setFormTimezone] = useState('Asia/Dhaka');
  const [formThemePreference, setFormThemePreference] = useState('light');
  const [formFocusMinutes, setFormFocusMinutes] = useState(25);
  const [formShortBreakMinutes, setFormShortBreakMinutes] = useState(5);
  const [formLongBreakMinutes, setFormLongBreakMinutes] = useState(15);
  const [formLongBreakInterval, setFormLongBreakInterval] = useState(4);
  const [formTargetExamName, setFormTargetExamName] = useState('HSC 2027');
  const [formTargetExamDate, setFormTargetExamDate] = useState('2027-06-01');
  const [formGamificationXp, setFormGamificationXp] = useState(0);
  const [formOnboardingCompleted, setFormOnboardingCompleted] = useState(true);

  // Ban management
  const [banReasonInput, setBanReasonInput] = useState('');
  const [isBanning, setIsBanning] = useState(false);

  // Targeted announcement
  const [targetedAnnouncementText, setTargetedAnnouncementText] = useState('');
  const [isSendingAnnouncement, setIsSendingAnnouncement] = useState(false);
  const [announcementSuccess, setAnnouncementSuccess] = useState(false);

  // Save changes
  const [isSavingChanges, setIsSavingChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Copied ID state
  const [copiedId, setCopiedId] = useState(false);

  const loadUsersList = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const res = await getAdminUsersListAction();
      if (res.success && res.users) {
        setUsers(res.users);
      } else {
        setActionError('Failed to fetch users list');
      }
    } catch (err: any) {
      setActionError(err?.message || 'Error loading users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsersList();
  }, []);

  const handleOpenUserDetail = async (userId: string) => {
    setSelectedUserId(userId);
    setDetailDialogOpen(true);
    setDetailLoading(true);
    setSaveSuccess(false);
    setAnnouncementSuccess(false);
    setDetailUser(null);

    try {
      const res = await getAdminUserDetailAction(userId);
      if (res.success && res.user) {
        const u = res.user;
        setDetailUser(u);
        const p = u.profile;
        setFormFullName(p.fullName || '');
        setFormEmail(p.email || '');
        setFormAvatarUrl(p.avatarUrl || '');
        const minutes = p.dailyStudyTargetMinutes || 360;
        setFormDailyTargetMinutes(minutes);
        setFormDailyTargetHours((minutes / 60).toFixed(1));
        setFormPreferredStudyTime(p.preferredStudyTime || 'evening');
        setFormTimezone(p.timezone || 'Asia/Dhaka');
        setFormThemePreference(p.themePreference || 'light');
        setFormFocusMinutes(p.pomodoroFocusMinutes || 25);
        setFormShortBreakMinutes(p.pomodoroShortBreakMinutes || 5);
        setFormLongBreakMinutes(p.pomodoroLongBreakMinutes || 15);
        setFormLongBreakInterval(p.pomodoroLongBreakInterval || 4);
        setFormTargetExamName(p.targetExamName || 'HSC 2027');
        setFormTargetExamDate(p.targetExamDate || '2027-06-01');
        setFormGamificationXp(p.gamificationXp || 0);
        setFormOnboardingCompleted(p.onboardingCompleted ?? true);
        setBanReasonInput(p.bannedReason || '');
        setTargetedAnnouncementText(p.targetedAnnouncement || '');
      } else {
        setActionError('Failed to load user details');
      }
    } catch (err: any) {
      setActionError(err?.message || 'Error loading user details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleToggleBan = async (userId: string, currentBanned: boolean, reason?: string) => {
    setIsBanning(true);
    setActionError(null);
    try {
      const nextBanned = !currentBanned;
      const effectiveReason =
        reason !== undefined
          ? reason
          : (detailUser?.profile.userId === userId ? banReasonInput : undefined);
      const res = await toggleAdminUserBanAction(userId, nextBanned, effectiveReason);
      if (res.success) {
        // Update list in state
        setUsers((prev) =>
          prev.map((u) =>
            u.userId === userId
              ? {
                  ...u,
                  isBanned: nextBanned,
                  bannedReason: nextBanned ? (effectiveReason || 'Account suspended by administrator') : '',
                  bannedAt: nextBanned ? new Date() : null,
                }
              : u
          )
        );

        // Update detail dialog if open
        if (detailUser && detailUser.profile.userId === userId) {
          setDetailUser({
            ...detailUser,
            profile: {
              ...detailUser.profile,
              isBanned: nextBanned,
              bannedReason: nextBanned ? (effectiveReason || 'Account suspended by administrator') : '',
              bannedAt: nextBanned ? new Date() : null,
            },
          });
        }

        if (!nextBanned) {
          setBanReasonInput('');
        }
      } else {
        setActionError(res.error || 'Failed to update ban status');
      }
    } catch (err: any) {
      setActionError(err?.message || 'Error updating ban status');
    } finally {
      setIsBanning(false);
    }
  };

  const handleSaveProfileChanges = async () => {
    if (!selectedUserId) return;
    setIsSavingChanges(true);
    setSaveSuccess(false);
    setActionError(null);
    try {
      const hours = parseFloat(formDailyTargetHours) || 6;
      const targetMinutes = Math.max(30, Math.min(1440, Math.round(hours * 60)));
      const res = await updateAdminUserDetailAction(selectedUserId, {
        fullName: formFullName.trim(),
        email: formEmail.trim(),
        avatarUrl: formAvatarUrl.trim(),
        dailyStudyTargetMinutes: targetMinutes,
        preferredStudyTime: formPreferredStudyTime,
        timezone: formTimezone,
        themePreference: formThemePreference,
        pomodoroFocusMinutes: formFocusMinutes,
        pomodoroShortBreakMinutes: formShortBreakMinutes,
        pomodoroLongBreakMinutes: formLongBreakMinutes,
        pomodoroLongBreakInterval: formLongBreakInterval,
        targetExamName: formTargetExamName.trim(),
        targetExamDate: formTargetExamDate,
        gamificationXp: formGamificationXp,
        onboardingCompleted: formOnboardingCompleted,
      });

      if (res.success && res.user) {
        setSaveSuccess(true);
        // Update user in list
        setUsers((prev) =>
          prev.map((u) =>
            u.userId === selectedUserId
              ? {
                  ...u,
                  fullName: res.user.fullName,
                  email: res.user.email,
                  avatarUrl: res.user.avatarUrl,
                }
              : u
          )
        );

        if (detailUser) {
          setDetailUser({
            ...detailUser,
            profile: {
              ...detailUser.profile,
              ...res.user,
            },
          });
        }

        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setActionError(res.error || 'Failed to update user profile');
      }
    } catch (err: any) {
      setActionError(err?.message || 'Error updating user profile');
    } finally {
      setIsSavingChanges(false);
    }
  };

  const handleSendTargetedAnnouncement = async (announcement: string) => {
    if (!selectedUserId) return;
    setIsSendingAnnouncement(true);
    setAnnouncementSuccess(false);
    setActionError(null);
    try {
      const res = await setAdminUserTargetedAnnouncementAction(selectedUserId, announcement);
      if (res.success && res.user) {
        setAnnouncementSuccess(true);
        if (detailUser) {
          setDetailUser({
            ...detailUser,
            profile: {
              ...detailUser.profile,
              targetedAnnouncement: res.user.targetedAnnouncement,
              targetedAnnouncementCreatedAt: res.user.targetedAnnouncementCreatedAt,
            },
          });
        }
        setTargetedAnnouncementText(res.user.targetedAnnouncement || '');
        setTimeout(() => setAnnouncementSuccess(false), 3000);
      } else {
        setActionError(res.error || 'Failed to send targeted announcement');
      }
    } catch (err: any) {
      setActionError(err?.message || 'Error sending targeted announcement');
    } finally {
      setIsSendingAnnouncement(false);
    }
  };

  const copyUserId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase().trim();
    return users.filter(
      (u) =>
        (u.fullName && u.fullName.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.userId && u.userId.toLowerCase().includes(q))
    );
  }, [users, searchQuery]);

  return (
    <div className="space-y-6" data-testid="admin-users-view">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              User Management
            </h1>
            <Badge variant="secondary" className="font-mono text-xs">
              {users.length} {users.length === 1 ? 'user' : 'users'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            View all users, inspect and edit their data, enforce ban controls, and send targeted unclosable announcements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadUsersList}
            disabled={loading}
            className="text-xs gap-1.5 h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-center justify-between gap-3 animate-in fade-in"
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActionError(null)}
            className="h-6 px-2 text-xs hover:bg-destructive/10"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Search Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users by name, email, or UID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
            data-testid="search-users-input"
          />
        </div>
      </div>

      {/* Users List Table (R1: Shows name, email, ban/unban button, without loading details upfront) */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[280px]">User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[140px]">Joined</TableHead>
                <TableHead className="text-right w-[200px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <TableRow key={idx} className="animate-pulse">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-muted" />
                        <div className="space-y-1">
                          <div className="h-3.5 w-24 bg-muted rounded" />
                          <div className="h-2.5 w-16 bg-muted rounded" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><div className="h-3.5 w-36 bg-muted rounded" /></TableCell>
                    <TableCell><div className="h-5 w-16 bg-muted rounded-full" /></TableCell>
                    <TableCell><div className="h-3.5 w-20 bg-muted rounded" /></TableCell>
                    <TableCell className="text-right"><div className="h-8 w-24 bg-muted rounded ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground text-xs">
                    {searchQuery ? 'No users matching your search criteria.' : 'No users registered yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow
                    key={user.userId}
                    className="cursor-pointer hover:bg-muted/50 transition-colors group"
                    data-testid={`user-row-${user.userId}`}
                    onClick={() => handleOpenUserDetail(user.userId)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0 border border-border bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-bold text-xs">
                            {user.fullName ? user.fullName.trim().slice(0, 2).toUpperCase() : 'U'}
                          </span>
                          {user.avatarUrl && (
                            <img
                              src={user.avatarUrl}
                              alt={user.fullName || 'User'}
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-foreground truncate group-hover:text-primary transition-colors">
                            {user.fullName || 'Student Scholar'}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px]">
                            {user.userId}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      {user.isBanned ? (
                        <Badge variant="destructive" className="text-[10px] py-0 px-2 font-medium gap-1">
                          <Ban className="w-3 h-3" />
                          <span>Banned</span>
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] py-0 px-2 font-medium text-emerald-600 dark:text-emerald-400 gap-1 bg-emerald-500/10 border-emerald-500/20">
                          <CheckCircle className="w-3 h-3" />
                          <span>Active</span>
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Ban / Unban quick button (R1, R3) */}
                        <Button
                          variant={user.isBanned ? 'outline' : 'destructive'}
                          size="sm"
                          disabled={isBanning}
                          className="h-7 text-xs px-2.5"
                          data-testid={`ban-toggle-btn-${user.userId}`}
                          onClick={() => handleToggleBan(user.userId, user.isBanned)}
                        >
                          {user.isBanned ? (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                              <span>Unban</span>
                            </>
                          ) : (
                            <>
                              <Ban className="w-3.5 h-3.5 mr-1" />
                              <span>Ban User</span>
                            </>
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2"
                          data-testid={`inspect-user-btn-${user.userId}`}
                          onClick={() => handleOpenUserDetail(user.userId)}
                        >
                          <Edit className="w-3.5 h-3.5 mr-1" />
                          <span>Inspect</span>
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

      {/* User Detail Inspection & Editing Dialog (R2, R3, R4) */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent
          className="max-w-3xl max-h-[90vh] overflow-y-auto"
          data-testid="user-detail-dialog"
        >
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <span>User Profile & Controls</span>
              </DialogTitle>
              {detailUser?.profile.isBanned && (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <Ban className="w-3.5 h-3.5" />
                  <span>Account Suspended</span>
                </Badge>
              )}
            </div>
            <DialogDescription className="text-xs">
              Inspect user metadata, edit profile and study preferences, manage ban controls, and issue targeted announcements.
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-12 space-y-4 text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto" />
              <p className="text-xs text-muted-foreground">Lazy loading full user record from database...</p>
            </div>
          ) : detailUser ? (
            <div className="space-y-6 py-2">
              {/* Error alert inside dialog */}
              {actionError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in"
                >
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{actionError}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActionError(null)}
                    className="h-6 px-2 text-xs hover:bg-destructive/10"
                  >
                    Dismiss
                  </Button>
                </div>
              )}
              {/* Banner: save / announcement feedback */}
              {saveSuccess && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>User profile changes have been persisted successfully!</span>
                </div>
              )}
              {announcementSuccess && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <Megaphone className="w-4 h-4 shrink-0" />
                  <span>Targeted announcement dispatched. It is now displayed unclosably to this user.</span>
                </div>
              )}

              {/* SECTION 1: Identity & Read-Only Metadata (Formatted like admin profile) */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 border border-border bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-bold text-sm">
                        {detailUser.profile.fullName ? detailUser.profile.fullName.trim().slice(0, 2).toUpperCase() : 'US'}
                      </span>
                      {detailUser.profile.avatarUrl && (
                        <img
                          src={detailUser.profile.avatarUrl}
                          alt={detailUser.profile.fullName || 'User'}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-foreground">{detailUser.profile.fullName}</h3>
                      <p className="text-xs text-muted-foreground font-mono">{detailUser.profile.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1.5 bg-background px-2.5 py-1 rounded-md border border-border font-mono text-[11px]">
                      <span className="text-muted-foreground">UID:</span>
                      <span className="truncate max-w-[150px]">{detailUser.profile.userId}</span>
                      <button
                        type="button"
                        onClick={() => copyUserId(detailUser.profile.userId)}
                        className="text-muted-foreground hover:text-foreground ml-1"
                        title="Copy User ID"
                      >
                        {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/60 text-xs">
                  <div>
                    <span className="text-muted-foreground text-[10px] uppercase font-bold">Created At</span>
                    <p className="font-medium text-foreground">
                      {detailUser.profile.createdAt
                        ? new Date(detailUser.profile.createdAt).toLocaleDateString()
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] uppercase font-bold">Updated At</span>
                    <p className="font-medium text-foreground">
                      {detailUser.profile.updatedAt
                        ? new Date(detailUser.profile.updatedAt).toLocaleDateString()
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] uppercase font-bold">XP Points</span>
                    <p className="font-semibold text-primary">{detailUser.profile.gamificationXp || 0} XP</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] uppercase font-bold">Onboarding</span>
                    <p className="font-medium text-foreground">
                      {detailUser.profile.onboardingCompleted ? 'Completed' : 'Pending'}
                    </p>
                  </div>
                </div>

                {/* Activity stats summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/60 text-xs">
                  <div className="bg-background p-2 rounded-lg border border-border/60">
                    <span className="text-[10px] text-muted-foreground">Study Sessions</span>
                    <p className="font-bold text-sm text-foreground">{detailUser.stats.totalSessions}</p>
                  </div>
                  <div className="bg-background p-2 rounded-lg border border-border/60">
                    <span className="text-[10px] text-muted-foreground">Total Study Time</span>
                    <p className="font-bold text-sm text-foreground">{detailUser.stats.totalStudyMinutes} mins</p>
                  </div>
                  <div className="bg-background p-2 rounded-lg border border-border/60">
                    <span className="text-[10px] text-muted-foreground">Active Subjects</span>
                    <p className="font-bold text-sm text-foreground">{detailUser.stats.totalSubjects}</p>
                  </div>
                  <div className="bg-background p-2 rounded-lg border border-border/60">
                    <span className="text-[10px] text-muted-foreground">Total Tasks</span>
                    <p className="font-bold text-sm text-foreground">{detailUser.stats.totalTasks}</p>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Ban / Unban Access Controls (R3) */}
              <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-destructive">
                    <ShieldAlert className="w-4 h-4" />
                    <h4 className="font-display font-bold text-xs uppercase tracking-wider">
                      Account Ban & Security Lockdown (R3)
                    </h4>
                  </div>
                  <Badge variant={detailUser.profile.isBanned ? 'destructive' : 'secondary'}>
                    {detailUser.profile.isBanned ? 'Banned (Locked Out)' : 'Access Restored'}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  Banning a user immediately revokes access to authenticated workspace features and shows an Account Suspended lockout screen. Unbanning restores their access instantly.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="flex-1 w-full">
                    <Input
                      placeholder="Optional reason for ban (e.g. Terms violation, unpaid invoice)..."
                      value={banReasonInput}
                      onChange={(e) => setBanReasonInput(e.target.value)}
                      className="text-xs h-9"
                      data-testid="ban-reason-input"
                    />
                  </div>
                  <Button
                    type="button"
                    variant={detailUser.profile.isBanned ? 'outline' : 'destructive'}
                    size="sm"
                    disabled={isBanning}
                    onClick={() => handleToggleBan(detailUser.profile.userId, detailUser.profile.isBanned, banReasonInput)}
                    className="h-9 text-xs font-semibold shrink-0"
                    data-testid="detail-ban-toggle-btn"
                  >
                    {detailUser.profile.isBanned ? (
                      <>
                        <ShieldCheck className="w-4 h-4 mr-1 text-emerald-600" />
                        <span>Unban User (Restore Access)</span>
                      </>
                    ) : (
                      <>
                        <Ban className="w-4 h-4 mr-1" />
                        <span>Ban User (Lockout)</span>
                      </>
                    )}
                  </Button>
                </div>

                {detailUser.profile.isBanned && detailUser.profile.bannedReason && (
                  <p className="text-[11px] text-destructive/80 font-mono">
                    Active Ban Reason: &quot;{detailUser.profile.bannedReason}&quot;
                  </p>
                )}
              </div>

              {/* SECTION 3: Targeted Unclosable Announcements (R4) */}
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3" data-testid="targeted-announcement-section">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <Megaphone className="w-4 h-4" />
                    <h4 className="font-display font-bold text-xs uppercase tracking-wider">
                      Targeted Unclosable Announcement (R4)
                    </h4>
                  </div>
                  {detailUser.profile.targetedAnnouncement ? (
                    <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px]">
                      Announcement Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      None Active
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  Target an announcement specifically to this user. This banner is visible <strong>only</strong> to them on their workspace and <strong>cannot be closed or dismissed</strong> like general announcements.
                </p>

                {detailUser.profile.targetedAnnouncement && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs space-y-1">
                    <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                      Currently Visible to User:
                    </span>
                    <p className="font-medium text-foreground italic break-words whitespace-pre-wrap">
                      &quot;{detailUser.profile.targetedAnnouncement}&quot;
                    </p>
                    {detailUser.profile.targetedAnnouncementCreatedAt && (
                      <p className="text-[10px] text-muted-foreground font-mono">
                        Dispatched: {new Date(detailUser.profile.targetedAnnouncementCreatedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Textarea
                    placeholder="Enter targeted announcement message for this user..."
                    value={targetedAnnouncementText}
                    onChange={(e) => setTargetedAnnouncementText(e.target.value)}
                    className="text-xs min-h-[70px]"
                    data-testid="targeted-announcement-input"
                  />
                  <div className="flex items-center justify-between gap-2">
                    {detailUser.profile.targetedAnnouncement ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isSendingAnnouncement}
                        onClick={() => handleSendTargetedAnnouncement('')}
                        className="text-xs text-destructive hover:bg-destructive/10 h-8"
                        data-testid="clear-announcement-btn"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        <span>Clear Announcement</span>
                      </Button>
                    ) : <span />}

                    <Button
                      type="button"
                      size="sm"
                      disabled={isSendingAnnouncement || !targetedAnnouncementText.trim()}
                      onClick={() => handleSendTargetedAnnouncement(targetedAnnouncementText)}
                      className="text-xs h-8 bg-amber-600 hover:bg-amber-700 text-white"
                      data-testid="send-announcement-btn"
                    >
                      <Send className="w-3.5 h-3.5 mr-1" />
                      <span>{isSendingAnnouncement ? 'Sending...' : 'Send Targeted Announcement'}</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* SECTION 4: User Profile & Study Settings Editable Form (R2) */}
              <div className="space-y-4 pt-2 border-t border-border">
                <h4 className="font-display font-bold text-xs uppercase tracking-wider text-muted-foreground">
                  User Profile & Study Parameters (R2)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-medium text-foreground mb-1">Full Name</label>
                    <Input
                      value={formFullName}
                      onChange={(e) => setFormFullName(e.target.value)}
                      className="text-xs h-9"
                      data-testid="edit-user-fullname"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-foreground mb-1">Email Address</label>
                    <Input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="text-xs h-9"
                      data-testid="edit-user-email"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-foreground mb-1">Avatar Image URL</label>
                    <Input
                      value={formAvatarUrl}
                      onChange={(e) => setFormAvatarUrl(e.target.value)}
                      placeholder="https://..."
                      className="text-xs h-9 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-foreground mb-1">Daily Study Target (Hours)</label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="24"
                      value={formDailyTargetHours}
                      onChange={(e) => {
                        setFormDailyTargetHours(e.target.value);
                        const parsed = parseFloat(e.target.value);
                        if (!isNaN(parsed) && parsed > 0) {
                          setFormDailyTargetMinutes(Math.round(parsed * 60));
                        }
                      }}
                      className="text-xs h-9"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-foreground mb-1">Target Exam Name</label>
                    <Input
                      value={formTargetExamName}
                      onChange={(e) => setFormTargetExamName(e.target.value)}
                      className="text-xs h-9"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-foreground mb-1">Target Exam Date</label>
                    <Input
                      type="date"
                      value={formTargetExamDate}
                      onChange={(e) => setFormTargetExamDate(e.target.value)}
                      className="text-xs h-9"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-foreground mb-1">Preferred Study Time</label>
                    <select
                      value={formPreferredStudyTime}
                      onChange={(e) => setFormPreferredStudyTime(e.target.value)}
                      className="w-full h-9 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="morning">Morning</option>
                      <option value="afternoon">Afternoon</option>
                      <option value="evening">Evening</option>
                      <option value="night">Night</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-foreground mb-1">Timezone</label>
                    <select
                      value={formTimezone}
                      onChange={(e) => setFormTimezone(e.target.value)}
                      className="w-full h-9 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {SUPPORTED_TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-foreground mb-1">Theme Preference</label>
                    <select
                      value={formThemePreference}
                      onChange={(e) => setFormThemePreference(e.target.value)}
                      className="w-full h-9 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="system">System Default</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-foreground mb-1">Gamification XP</label>
                    <Input
                      type="number"
                      min="0"
                      value={formGamificationXp}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setFormGamificationXp(isNaN(val) ? 0 : Math.max(0, val));
                      }}
                      className="text-xs h-9"
                    />
                  </div>
                </div>

                {/* Pomodoro Settings */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                  <div>
                    <label className="block text-muted-foreground mb-1">Focus (min)</label>
                    <Input
                      type="number"
                      min="5"
                      max="120"
                      value={formFocusMinutes}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setFormFocusMinutes(isNaN(val) ? 25 : val);
                      }}
                      className="text-xs h-8"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-1">Short Break (min)</label>
                    <Input
                      type="number"
                      min="1"
                      max="30"
                      value={formShortBreakMinutes}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setFormShortBreakMinutes(isNaN(val) ? 5 : val);
                      }}
                      className="text-xs h-8"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-1">Long Break (min)</label>
                    <Input
                      type="number"
                      min="5"
                      max="60"
                      value={formLongBreakMinutes}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setFormLongBreakMinutes(isNaN(val) ? 15 : val);
                      }}
                      className="text-xs h-8"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-1">Interval (cycles)</label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={formLongBreakInterval}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setFormLongBreakInterval(isNaN(val) ? 4 : val);
                      }}
                      className="text-xs h-8"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDetailDialogOpen(false)}
              className="text-xs"
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSavingChanges || detailLoading}
              onClick={handleSaveProfileChanges}
              className="text-xs font-semibold"
              data-testid="save-user-changes-btn"
            >
              {isSavingChanges ? 'Saving...' : 'Save User Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
