const { Pool } = require('/tmp/node_modules/pg');
const fs = require('fs');

function getEnv(path) {
  const content = fs.readFileSync(path, 'utf8');
  const res = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      res[trimmed.slice(0, idx).trim()] = val;
    }
  }
  return res;
}

const DEFAULT_SUBJECTS = [
  { name: 'Physics', color: '#2563EB', icon: 'BookOpen', description: 'HSC Physics 1st & 2nd Paper' },
  { name: 'Chemistry', color: '#0891B2', icon: 'BookOpen', description: 'HSC Chemistry 1st & 2nd Paper' },
  { name: 'Mathematics', color: '#9333EA', icon: 'BookOpen', description: 'HSC Higher Mathematics 1st & 2nd Paper' },
  { name: 'Biology', color: '#16A34A', icon: 'BookOpen', description: 'HSC Biology 1st & 2nd Paper' },
  { name: 'ICT', color: '#2563EB', icon: 'BookOpen', description: 'Information & Communication Technology' },
  { name: 'English', color: '#D97706', icon: 'BookOpen', description: 'HSC English 1st & 2nd Paper' },
  { name: 'Bangla', color: '#DC2626', icon: 'BookOpen', description: 'HSC Bangla 1st & 2nd Paper' }
];

async function resetUser() {
  console.log('====================================================');
  console.log(' Resetting data for iktidarsanglap01@gmail.com');
  console.log(' in both Supabase (v1) and Neon (v2)');
  console.log('====================================================\n');

  const v1Env = getEnv('/media/sanglap/Movies/scholarpulsev2/v1/.env.production');
  const v2Env = getEnv('/media/sanglap/Movies/scholarpulsev2/v2/.env');

  const supabase = new Pool({
    connectionString: v1Env.DATABASE_URL_POOLED || v1Env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const neon = new Pool({
    connectionString: v2Env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // ==========================================
    // 1. RESET IN SUPABASE (v1)
    // ==========================================
    console.log('--- 1. Resetting Supabase (v1) ---');
    const spProf = await supabase.query("SELECT user_id FROM profiles WHERE email = 'iktidarsanglap01@gmail.com'");
    const spUserIds = spProf.rows.map(r => r.user_id);
    console.log('Found Supabase UIDs for iktidarsanglap01@gmail.com:', spUserIds);

    for (const uid of spUserIds) {
      // Delete user dependent rows
      await supabase.query('DELETE FROM active_timer_sessions WHERE user_id = $1', [uid]);
      await supabase.query('DELETE FROM study_sessions WHERE user_id = $1', [uid]);
      await supabase.query('DELETE FROM revision_records WHERE user_id = $1', [uid]);
      await supabase.query('DELETE FROM user_curriculum_customizations WHERE user_id = $1', [uid]);
      await supabase.query('DELETE FROM user_achievements WHERE user_id = $1', [uid]);
      await supabase.query('DELETE FROM tasks WHERE user_id = $1', [uid]);
      await supabase.query('DELETE FROM schedules WHERE user_id = $1', [uid]);
      await supabase.query('DELETE FROM goals WHERE user_id = $1', [uid]);
      await supabase.query('DELETE FROM subjects WHERE user_id = $1', [uid]);

      // Insert clean default subjects
      for (const s of DEFAULT_SUBJECTS) {
        await supabase.query(`
          INSERT INTO subjects (id, user_id, name, description, color, icon, daily_target_minutes, weekly_target_minutes, is_archived, notes)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 60, 300, false, '')
        `, [uid, s.name, s.description, s.color, s.icon]);
      }

      // Insert fresh active daily study goal
      await supabase.query(`
        INSERT INTO goals (id, user_id, title, goal_type, target_value, current_value, unit, start_date, end_date, status)
        VALUES (gen_random_uuid(), $1, 'Daily Study Target (6h)', 'daily', 360, 0, 'minutes', CURRENT_DATE::text, (CURRENT_DATE + INTERVAL '30 days')::date::text, 'active')
      `, [uid]);

      // Reset profile defaults
      await supabase.query(`
        UPDATE profiles SET
          daily_study_target_minutes = 360,
          preferred_study_time = 'evening',
          timezone = 'Asia/Dhaka',
          theme_preference = 'light',
          target_exam_name = 'HSC 2027',
          target_exam_date = '2027-06-01',
          onboarding_completed = true,
          updated_at = NOW()
        WHERE user_id = $1
      `, [uid]);
    }
    console.log('✓ Supabase (v1) data reset completed successfully.\n');

    // ==========================================
    // 2. RESET IN NEON (v2)
    // ==========================================
    console.log('--- 2. Resetting Neon (v2) ---');
    const neonProf = await neon.query("SELECT user_id, id FROM profiles WHERE email = 'iktidarsanglap01@gmail.com'");
    const neonUserIds = neonProf.rows.map(r => r.user_id);
    console.log('Found Neon UIDs for iktidarsanglap01@gmail.com:', neonUserIds);

    const primaryGoogleUid = '106603956445816075425';

    for (const uid of neonUserIds) {
      await neon.query('DELETE FROM active_timer_sessions WHERE user_id = $1', [uid]);
      await neon.query('DELETE FROM study_sessions WHERE user_id = $1', [uid]);
      await neon.query('DELETE FROM revision_records WHERE user_id = $1', [uid]);
      await neon.query('DELETE FROM user_curriculum_customizations WHERE user_id = $1', [uid]);
      await neon.query('DELETE FROM user_achievements WHERE user_id = $1', [uid]);
      await neon.query('DELETE FROM curriculum_resources WHERE user_id = $1', [uid]);
      await neon.query('DELETE FROM tasks WHERE user_id = $1', [uid]);
      await neon.query('DELETE FROM schedules WHERE user_id = $1', [uid]);
      await neon.query('DELETE FROM goals WHERE user_id = $1', [uid]);
      await neon.query('DELETE FROM sync_events WHERE user_id = $1', [uid]);
      await neon.query('DELETE FROM subjects WHERE user_id = $1', [uid]);
    }

    // Remove legacy Firebase UID profile in Neon if present so only primary Google OAuth profile remains
    await neon.query("DELETE FROM profiles WHERE email = 'iktidarsanglap01@gmail.com' AND user_id != $1", [primaryGoogleUid]);

    // Insert clean default subjects for primary Google user
    for (const s of DEFAULT_SUBJECTS) {
      await neon.query(`
        INSERT INTO subjects (id, user_id, name, description, color, icon, daily_target_minutes, weekly_target_minutes, is_archived, notes)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 60, 300, false, '')
      `, [primaryGoogleUid, s.name, s.description, s.color, s.icon]);
    }

    // Insert clean active daily study goal
    await neon.query(`
      INSERT INTO goals (id, user_id, title, goal_type, target_value, current_value, unit, start_date, end_date, status)
      VALUES (gen_random_uuid(), $1, 'Daily Study Target (6h)', 'daily', 360, 0, 'minutes', CURRENT_DATE::text, (CURRENT_DATE + INTERVAL '30 days')::date::text, 'active')
    `, [primaryGoogleUid]);

    // Reset profile XP, targets, and dates
    await neon.query(`
      UPDATE profiles SET
        gamification_xp = 0,
        daily_study_target_minutes = 360,
        preferred_study_time = 'evening',
        timezone = 'Asia/Dhaka',
        theme_preference = 'light',
        target_exam_name = 'HSC 2027',
        target_exam_date = '2027-06-01',
        onboarding_completed = true,
        updated_at = NOW()
      WHERE user_id = $1
    `, [primaryGoogleUid]);

    console.log('✓ Neon (v2) data reset completed successfully.\n');

    // ==========================================
    // 3. VERIFY FINAL CLEAN STATE
    // ==========================================
    console.log('--- 3. Verifying Clean Fresh State ---');
    const spCheck = await supabase.query(`
      SELECT 
        (SELECT count(*) FROM study_sessions WHERE user_id = 'Ie2Q7hRIjkN4lWcjGhPzGRoDKt42') as sessions,
        (SELECT count(*) FROM revision_records WHERE user_id = 'Ie2Q7hRIjkN4lWcjGhPzGRoDKt42') as revs,
        (SELECT count(*) FROM subjects WHERE user_id = 'Ie2Q7hRIjkN4lWcjGhPzGRoDKt42') as subjects,
        (SELECT count(*) FROM user_achievements WHERE user_id = 'Ie2Q7hRIjkN4lWcjGhPzGRoDKt42') as achievements,
        (SELECT count(*) FROM goals WHERE user_id = 'Ie2Q7hRIjkN4lWcjGhPzGRoDKt42') as goals
    `);
    console.log('Supabase (v1) check:', spCheck.rows[0]);

    const neonCheck = await neon.query(`
      SELECT 
        gamification_xp,
        (SELECT count(*) FROM study_sessions WHERE user_id = $1) as sessions,
        (SELECT count(*) FROM revision_records WHERE user_id = $1) as revs,
        (SELECT count(*) FROM subjects WHERE user_id = $1) as subjects,
        (SELECT count(*) FROM user_achievements WHERE user_id = $1) as achievements,
        (SELECT count(*) FROM goals WHERE user_id = $1) as goals
      FROM profiles WHERE user_id = $1
    `, [primaryGoogleUid]);
    console.log('Neon (v2) check:', neonCheck.rows[0]);

    console.log('\n====================================================');
    console.log(' Fresh Start Ready! All test/debug data cleared.');
    console.log('====================================================');
  } catch (err) {
    console.error('Reset error:', err);
    throw err;
  } finally {
    await supabase.end();
    await neon.end();
  }
}

resetUser().catch(err => {
  console.error(err);
  process.exit(1);
});
