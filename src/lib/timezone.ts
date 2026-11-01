/**
 * Timezone-aware date & duration utilities
 * Default timezone: Asia/Dhaka
 */

export const SUPPORTED_TIMEZONES = [
  { value: 'Asia/Dhaka', label: 'Asia/Dhaka (GMT+6 - Bangladesh)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (GMT+5:30 - India)' },
  { value: 'Asia/Karachi', label: 'Asia/Karachi (GMT+5 - Pakistan)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (GMT+8 - Singapore)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (GMT+9 - Japan)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GMT+4 - UAE)' },
  { value: 'Europe/London', label: 'Europe/London (GMT+0/+1 - UK)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (GMT+1/+2 - Central Europe)' },
  { value: 'America/New_York', label: 'America/New_York (GMT-5/-4 - US Eastern)' },
  { value: 'America/Chicago', label: 'America/Chicago (GMT-6/-5 - US Central)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (GMT-8/-7 - US Pacific)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (GMT+10/+11 - Australia)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
];

/**
 * Formats a Date or ISO timestamp into YYYY-MM-DD in the given IANA timezone.
 */
export function toDateStringInTz(dateInput: Date | string | number, timeZone = 'Asia/Dhaka'): string {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date); // en-CA produces YYYY-MM-DD
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Formats a Date or ISO timestamp into HH:mm (24h) in the given IANA timezone.
 */
export function toTimeStringInTz(dateInput: Date | string | number, timeZone = 'Asia/Dhaka'): string {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return '00:00';
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().slice(11, 16);
  }
}

/**
 * Gets the day of week (0 = Sunday ... 6 = Saturday) for a date in the user's timezone.
 */
export function getDayOfWeekInTz(dateInput: Date | string | number, timeZone = 'Asia/Dhaka'): number {
  const ymd = toDateStringInTz(dateInput, timeZone);
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Adds or subtracts days from a YYYY-MM-DD string.
 */
export function addDaysToYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Computes current streak, longest streak, and total active study days
 * based on recorded sessions in the user's configured timezone.
 */
export function computeStreaksFromDates(
  sessionStartTimes: Array<Date | string>,
  timeZone = 'Asia/Dhaka',
  now: Date = new Date()
): {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  studiedToday: boolean;
  activeDatesSet: string[];
} {
  const uniqueDates = Array.from(
    new Set(sessionStartTimes.map((t) => toDateStringInTz(t, timeZone)))
  ).sort();

  const totalActiveDays = uniqueDates.length;
  if (totalActiveDays === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalActiveDays: 0,
      studiedToday: false,
      activeDatesSet: [],
    };
  }

  const dateSet = new Set(uniqueDates);
  const todayYmd = toDateStringInTz(now, timeZone);
  const yesterdayYmd = addDaysToYmd(todayYmd, -1);
  const studiedToday = dateSet.has(todayYmd);

  // Calculate current streak (continues if studied today OR studied yesterday)
  let currentStreak = 0;
  let cursor = studiedToday ? todayYmd : dateSet.has(yesterdayYmd) ? yesterdayYmd : null;
  while (cursor && dateSet.has(cursor)) {
    currentStreak++;
    cursor = addDaysToYmd(cursor, -1);
  }

  // Calculate longest streak
  let longestStreak = 0;
  let running = 0;
  let prevYmd: string | null = null;

  for (const ymd of uniqueDates) {
    if (!prevYmd || addDaysToYmd(prevYmd, 1) === ymd) {
      running += 1;
    } else {
      running = 1;
    }
    if (running > longestStreak) {
      longestStreak = running;
    }
    prevYmd = ymd;
  }

  return {
    currentStreak,
    longestStreak,
    totalActiveDays,
    studiedToday,
    activeDatesSet: uniqueDates,
  };
}

/**
 * Formats seconds into human-readable "Xh Ym" or "Ym Zs"
 */
export function formatDurationHuman(totalSeconds: number, includeSeconds = false): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (includeSeconds) {
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h 0m`;
  return `${minutes}m`;
}

/**
 * Formats seconds into digital clock HH:MM:SS or MM:SS
 */
export function formatDigitalClock(totalSeconds: number, forceHours = false): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0 || forceHours) {
    const hh = String(hours).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/**
 * Calculates minutes between two HH:mm strings (e.g., "09:00" to "11:30" -> 150)
 */
export function getMinutesBetweenHHMM(startHHMM: string, endHHMM: string): number {
  const [sh, sm] = startHHMM.split(':').map(Number);
  const [eh, em] = endHHMM.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
  const startTotal = sh * 60 + sm;
  const endTotal = eh * 60 + em;
  return Math.max(0, endTotal - startTotal);
}
