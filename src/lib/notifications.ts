'use client';

import { playTimerChime } from './audio';
import { WorkspaceData } from '@/types';
import { toDateStringInTz, getDayOfWeekInTz, toTimeStringInTz } from './timezone';

class NotificationService {
  private streakCheckTimer: NodeJS.Timeout | null = null;
  private scheduleCheckInterval: NodeJS.Timeout | null = null;
  private alertedSlotKeys = new Set<string>();

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  public async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      const perm = await Notification.requestPermission();
      return perm === 'granted';
    } catch {
      return false;
    }
  }

  public send(title: string, options?: NotificationOptions): boolean {
    if (!this.isSupported() || Notification.permission !== 'granted') {
      return false;
    }

    try {
      playTimerChime();
      new Notification(title, {
        icon: '/icon.svg',
        badge: '/icon.svg',
        ...options,
      });
      return true;
    } catch (err) {
      console.warn('Failed to dispatch browser notification:', err);
      return false;
    }
  }

  /**
   * Starts periodic checks for 8 PM streak protection and upcoming schedule alarms
   */
  public startBackgroundScheduler(data: WorkspaceData | null) {
    if (!data || typeof window === 'undefined') return;

    this.stopBackgroundScheduler();

    // Check every 60 seconds for scheduled classes and 8 PM streak alarm
    this.scheduleCheckInterval = setInterval(() => {
      this.checkScheduledClasses(data);
      this.checkDailyStreakAlert(data);
    }, 60 * 1000);

    // Initial check
    this.checkScheduledClasses(data);
    this.checkDailyStreakAlert(data);
  }

  public stopBackgroundScheduler() {
    if (this.scheduleCheckInterval) {
      clearInterval(this.scheduleCheckInterval);
      this.scheduleCheckInterval = null;
    }
    if (this.streakCheckTimer) {
      clearTimeout(this.streakCheckTimer);
      this.streakCheckTimer = null;
    }
  }

  private checkDailyStreakAlert(data: WorkspaceData) {
    const prefs = data.notificationPreferences;
    if (!prefs?.dailyReminderEnabled) return;

    const timezone = data.profile?.timezone || 'Asia/Dhaka';
    const now = new Date();
    const timeInTz = toTimeStringInTz(now, timezone);
    const [hours, minutes] = timeInTz.split(':').map(Number);

    // Trigger at 8:00 PM (20:00) or user's dailyReminderTime in their timezone
    const reminderTime = prefs.dailyReminderTime || '20:00';
    const [targetH, targetM] = reminderTime.split(':').map(Number);

    if (hours === targetH && Math.abs(minutes - targetM) < 2) {
      const todayYmd = toDateStringInTz(now, timezone);
      const key = `streak_${todayYmd}`;
      if (this.alertedSlotKeys.has(key)) return;

      // Check today's study minutes
      const todaySessions = data.studySessions.filter((s) => {
        const sDate = toDateStringInTz(s.startTime, timezone);
        return sDate === todayYmd;
      });
      const todayMinutes = Math.floor(
        todaySessions.reduce((acc, s) => acc + s.durationSeconds, 0) / 60
      );

      const targetMinutes = data.profile?.dailyStudyTargetMinutes || 360;

      if (todayMinutes < targetMinutes) {
        this.alertedSlotKeys.add(key);
        this.send('🔥 Protect Your Daily Study Streak!', {
          body: `You have logged ${todayMinutes}m of your ${targetMinutes}m target today. Complete a study session before midnight to keep your streak intact!`,
          tag: 'streak-protection',
        });
      }
    }
  }

  private checkScheduledClasses(data: WorkspaceData) {
    const prefs = data.notificationPreferences;
    if (!prefs?.scheduleReminderEnabled) return;

    const timezone = data.profile?.timezone || 'Asia/Dhaka';
    const now = new Date();
    const dayOfWeek = getDayOfWeekInTz(now, timezone);
    const timeInTz = toTimeStringInTz(now, timezone);
    const [curH, curM] = timeInTz.split(':').map(Number);
    const currentTotalMinutes = curH * 60 + curM;

    const todaySchedules = data.schedules.filter((s) => s.dayOfWeek === dayOfWeek);

    todaySchedules.forEach((sch) => {
      const [startH, startM] = sch.startTime.split(':').map(Number);
      const scheduleMinutes = startH * 60 + startM;

      // Check if slot starts in 10 minutes (between 8 and 11 minutes away)
      const diffMinutes = scheduleMinutes - currentTotalMinutes;
      const todayYmd = toDateStringInTz(now, timezone);
      const key = `sch_${todayYmd}_${sch.id}_${sch.startTime}`;

      if (diffMinutes >= 8 && diffMinutes <= 11 && !this.alertedSlotKeys.has(key)) {
        this.alertedSlotKeys.add(key);
        const subject = data.subjects.find((s) => s.id === sch.subjectId);
        const subName = subject?.name || 'Class / Study Session';

        this.send(`⏰ Upcoming Study Slot: ${subName}`, {
          body: `Starts in 10 minutes at ${sch.startTime}. Prepare your study materials!`,
          tag: key,
        });
      }
    });
  }
}

export const notificationService = new NotificationService();
