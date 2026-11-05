import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

function getDbSql() {
  const envPath = path.resolve(__dirname, '../../.env.local');
  let connStr = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;
  if (!connStr && fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf-8');
    const m = raw.match(/DATABASE_URL=([^\r\n]+)/);
    if (m) connStr = m[1].trim();
  }
  if (!connStr) throw new Error('No DATABASE_URL found for test db helper');
  return neon(connStr);
}

export async function seedActiveTimerForUser(
  userId: string,
  elapsedSeconds: number = 5084,
  options?: {
    phase?: 'focus' | 'short_break' | 'long_break';
    mode?: 'stopwatch' | 'pomodoro';
    subjectName?: string;
    topic?: string;
    totalFocusSeconds?: number;
  }
) {
  const sql = getDbSql();
  const phase = options?.phase || 'focus';
  const mode = options?.mode || 'stopwatch';
  let targetDurationSeconds = 0;
  if (mode === 'pomodoro') {
    targetDurationSeconds = phase === 'long_break' ? Math.max(1800, elapsedSeconds + 600) : phase === 'short_break' ? Math.max(300, elapsedSeconds + 300) : Math.max(1500, elapsedSeconds + 3600);
  }
  const totalFocusSeconds = options?.totalFocusSeconds ?? (phase !== 'focus' ? 1500 : 0);
  const desiredSubjectName = options?.subjectName;

  // 1. Ensure user has a subject
  let subjectId: string;
  if (desiredSubjectName) {
    const existingNamed = await sql`SELECT id FROM subjects WHERE user_id = ${userId} AND name = ${desiredSubjectName} AND is_archived = false LIMIT 1`;
    if (existingNamed.length > 0) {
      subjectId = existingNamed[0].id;
    } else {
      const inserted = await sql`
        INSERT INTO subjects (user_id, name, color, icon, daily_target_minutes, weekly_target_minutes)
        VALUES (${userId}, ${desiredSubjectName}, '#8B5CF6', 'Atom', 60, 300)
        RETURNING id
      `;
      subjectId = inserted[0].id;
    }
  } else {
    const existingSubjects = await sql`SELECT id FROM subjects WHERE user_id = ${userId} AND is_archived = false LIMIT 1`;
    if (existingSubjects.length > 0) {
      subjectId = existingSubjects[0].id;
    } else {
      const inserted = await sql`
        INSERT INTO subjects (user_id, name, color, icon, daily_target_minutes, weekly_target_minutes)
        VALUES (${userId}, 'Physics', '#2563EB', 'BookOpen', 60, 300)
        RETURNING id
      `;
      subjectId = inserted[0].id;
    }
  }

  // 2. Insert or update active_timer_sessions
  const startedAt = new Date(Date.now() - elapsedSeconds * 1000).toISOString();
  const lastResumedAt = new Date().toISOString();
  const idempotencyKey = `e2e_timer_${Date.now()}`;

  await sql`
    INSERT INTO active_timer_sessions (
      user_id, subject_id, topic, notes, mode, phase, status,
      started_at, last_resumed_at, accumulated_seconds, total_focus_seconds, target_duration_seconds,
      completed_pomodoros, state_version, idempotency_key, updated_at
    )
    VALUES (
      ${userId}, ${subjectId}, ${options?.topic || 'Quantum Mechanics'}, 'Notes for test', ${mode}, ${phase}, 'running',
      ${startedAt}, ${lastResumedAt}, ${elapsedSeconds}, ${totalFocusSeconds}, ${targetDurationSeconds},
      ${options?.phase !== 'focus' ? 1 : 0}, 1, ${idempotencyKey}, NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      subject_id = EXCLUDED.subject_id,
      topic = EXCLUDED.topic,
      notes = EXCLUDED.notes,
      mode = EXCLUDED.mode,
      phase = EXCLUDED.phase,
      status = EXCLUDED.status,
      started_at = EXCLUDED.started_at,
      last_resumed_at = EXCLUDED.last_resumed_at,
      accumulated_seconds = EXCLUDED.accumulated_seconds,
      total_focus_seconds = EXCLUDED.total_focus_seconds,
      target_duration_seconds = EXCLUDED.target_duration_seconds,
      completed_pomodoros = EXCLUDED.completed_pomodoros,
      idempotency_key = EXCLUDED.idempotency_key,
      updated_at = NOW()
  `;

  return { subjectId };
}

export async function clearActiveTimerForUser(userId: string) {
  const sql = getDbSql();
  await sql`DELETE FROM active_timer_sessions WHERE user_id = ${userId}`;
}
