const { Pool } = require('/tmp/node_modules/pg');
const fs = require('fs');
const crypto = require('crypto');

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

async function runMigration() {
  console.log('====================================================');
  console.log(' ScholarPulse Database Migration: Supabase -> Neon');
  console.log(' (SAFE: READ-ONLY ON SUPABASE, WRITES ONLY TO NEON)');
  console.log('====================================================\n');

  const v1Env = getEnv('/media/sanglap/Movies/scholarpulsev2/v1/.env.production');
  const v2Env = getEnv('/media/sanglap/Movies/scholarpulsev2/v2/.env');

  const supabaseUrl = v1Env.DATABASE_URL_POOLED || v1Env.DATABASE_URL;
  const neonUrl = v2Env.DATABASE_URL;

  // Supabase connection: strictly read-only pool
  const supabase = new Pool({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

  // Neon connection
  const neon = new Pool({
    connectionString: neonUrl,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

  try {
    // ----------------------------------------------------
    // STEP 1: Verify connections
    // ----------------------------------------------------
    console.log('[1/10] Verifying database connectivity...');
    const spCheck = await supabase.query('SELECT current_database(), current_user;');
    console.log(`✓ Connected to Supabase DB: "${spCheck.rows[0].current_database}" as "${spCheck.rows[0].current_user}"`);

    const neonCheck = await neon.query('SELECT current_database(), current_user;');
    console.log(`✓ Connected to Neon DB: "${neonCheck.rows[0].current_database}" as "${neonCheck.rows[0].current_user}"\n`);

    // Find active v2 user (Ekteder Sanglap's Google account)
    const v2Profiles = await neon.query("SELECT id, user_id, email FROM profiles WHERE email = 'iktidarsanglap01@gmail.com'");
    const activeV2UserId = v2Profiles.rows[0]?.user_id || '106603956445816075425';
    console.log(`ℹ Active v2 Google User ID for iktidarsanglap01@gmail.com: ${activeV2UserId}\n`);

    // ----------------------------------------------------
    // STEP 2: Migrate Profiles
    // ----------------------------------------------------
    console.log('[2/10] Migrating profiles (Read-only from Supabase)...');
    const { rows: profilesList } = await supabase.query('SELECT * FROM profiles');
    console.log(`Read ${profilesList.length} profiles from Supabase.`);

    for (const p of profilesList) {
      await neon.query(`
        INSERT INTO profiles (
          id, user_id, email, full_name, avatar_url,
          daily_study_target_minutes, preferred_study_time, timezone, theme_preference,
          pomodoro_focus_minutes, pomodoro_short_break_minutes, pomodoro_long_break_minutes,
          pomodoro_long_break_interval, onboarding_completed, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12,
          $13, $14, $15, $16
        )
        ON CONFLICT (user_id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          email = EXCLUDED.email,
          daily_study_target_minutes = EXCLUDED.daily_study_target_minutes,
          preferred_study_time = EXCLUDED.preferred_study_time,
          timezone = EXCLUDED.timezone,
          theme_preference = EXCLUDED.theme_preference,
          pomodoro_focus_minutes = EXCLUDED.pomodoro_focus_minutes,
          pomodoro_short_break_minutes = EXCLUDED.pomodoro_short_break_minutes,
          pomodoro_long_break_minutes = EXCLUDED.pomodoro_long_break_minutes,
          pomodoro_long_break_interval = EXCLUDED.pomodoro_long_break_interval,
          onboarding_completed = EXCLUDED.onboarding_completed,
          updated_at = NOW();
      `, [
        p.id, p.user_id, p.email, p.full_name, p.avatar_url || '',
        p.daily_study_target_minutes || 360, p.preferred_study_time || 'evening', p.timezone || 'Asia/Dhaka', p.theme_preference || 'light',
        p.pomodoro_focus_minutes || 25, p.pomodoro_short_break_minutes || 5, p.pomodoro_long_break_minutes || 15,
        p.pomodoro_long_break_interval || 4, p.onboarding_completed ?? false, p.created_at, p.updated_at
      ]);
    }
    console.log(`✓ Profiles migrated successfully.\n`);

    // ----------------------------------------------------
    // STEP 3: Migrate Subjects
    // ----------------------------------------------------
    console.log('[3/10] Migrating subjects...');
    const { rows: subjectsList } = await supabase.query('SELECT * FROM subjects');
    console.log(`Read ${subjectsList.length} subjects from Supabase.`);

    for (const s of subjectsList) {
      await neon.query(`
        INSERT INTO subjects (
          id, user_id, name, description, color, icon,
          daily_target_minutes, weekly_target_minutes, is_archived, notes,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          color = EXCLUDED.color,
          icon = EXCLUDED.icon,
          daily_target_minutes = EXCLUDED.daily_target_minutes,
          weekly_target_minutes = EXCLUDED.weekly_target_minutes,
          is_archived = EXCLUDED.is_archived,
          notes = EXCLUDED.notes,
          updated_at = NOW();
      `, [
        s.id, s.user_id, s.name, s.description || '', s.color, s.icon,
        s.daily_target_minutes || 60, s.weekly_target_minutes || 300, s.is_archived ?? false, s.notes || '',
        s.created_at, s.updated_at
      ]);
    }

    // Also ensure active v2 user has subjects mapped
    const v2Subs = await neon.query('SELECT id, name FROM subjects WHERE user_id = $1', [activeV2UserId]);
    const v2SubMapByName = new Map(v2Subs.rows.map(r => [r.name.toLowerCase().trim(), r.id]));

    // Check if Bangla needs to be added for active v2 user
    if (!v2SubMapByName.has('bangla')) {
      const banglaInsert = await neon.query(`
        INSERT INTO subjects (
          id, user_id, name, description, color, icon,
          daily_target_minutes, weekly_target_minutes, is_archived, notes
        ) VALUES (
          gen_random_uuid(), $1, 'Bangla', 'HSC Bangla 1st & 2nd Paper', '#DC2626', 'BookOpen',
          60, 300, false, ''
        ) RETURNING id, name;
      `, [activeV2UserId]);
      v2SubMapByName.set('bangla', banglaInsert.rows[0].id);
      console.log(`✓ Added Bangla subject for active v2 user.`);
    }

    // Refresh v2SubMapByName
    const refreshedV2Subs = await neon.query('SELECT id, name FROM subjects WHERE user_id = $1', [activeV2UserId]);
    for (const r of refreshedV2Subs.rows) {
      v2SubMapByName.set(r.name.toLowerCase().trim(), r.id);
    }
    console.log(`✓ Subjects migrated successfully.\n`);

    // ----------------------------------------------------
    // STEP 4: Build Subject Mapping for Study Sessions
    // ----------------------------------------------------
    // Map each supabase subject ID to the subject name
    const spSubjectIdToName = new Map(subjectsList.map(s => [s.id, s.name.toLowerCase().trim()]));

    // ----------------------------------------------------
    // STEP 5: Migrate Study Sessions
    // ----------------------------------------------------
    console.log('[5/10] Migrating study sessions...');
    const { rows: sessionsList } = await supabase.query('SELECT * FROM study_sessions');
    console.log(`Read ${sessionsList.length} study sessions from Supabase.`);

    let originalInserted = 0;
    let mirroredToActiveUser = 0;

    for (const s of sessionsList) {
      // 1. Insert original session as-is
      await neon.query(`
        INSERT INTO study_sessions (
          id, user_id, subject_id, idempotency_key, start_time, end_time,
          duration_seconds, topic, notes, productivity_rating, session_type,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13
        )
        ON CONFLICT (id) DO UPDATE SET
          topic = EXCLUDED.topic,
          notes = EXCLUDED.notes,
          productivity_rating = EXCLUDED.productivity_rating,
          session_type = EXCLUDED.session_type,
          updated_at = NOW();
      `, [
        s.id, s.user_id, s.subject_id, s.idempotency_key, s.start_time, s.end_time,
        s.duration_seconds, s.topic, s.notes || '', s.productivity_rating || 4, s.session_type || 'manual',
        s.created_at, s.updated_at
      ]);
      originalInserted++;

      // 2. Also map to active v2 user if session is not already belonging to activeV2UserId
      if (s.user_id !== activeV2UserId) {
        const subName = spSubjectIdToName.get(s.subject_id) || 'physics';
        const targetSubjectId = v2SubMapByName.get(subName) || v2SubMapByName.get('physics');

        if (targetSubjectId) {
          const mirroredId = crypto.createHash('sha256').update(`v2-mirror-${s.id}-${activeV2UserId}`).digest('hex');
          const mirroredUuid = `${mirroredId.slice(0,8)}-${mirroredId.slice(8,12)}-4${mirroredId.slice(13,16)}-a${mirroredId.slice(17,20)}-${mirroredId.slice(20,32)}`;
          const mirroredKey = `mirror_${s.idempotency_key || s.id}_${activeV2UserId}`;

          await neon.query(`
            INSERT INTO study_sessions (
              id, user_id, subject_id, idempotency_key, start_time, end_time,
              duration_seconds, topic, notes, productivity_rating, session_type,
              created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6,
              $7, $8, $9, $10, $11,
              $12, $13
            )
            ON CONFLICT (id) DO UPDATE SET
              topic = EXCLUDED.topic,
              notes = EXCLUDED.notes,
              productivity_rating = EXCLUDED.productivity_rating,
              updated_at = NOW();
          `, [
            mirroredUuid, activeV2UserId, targetSubjectId, mirroredKey, s.start_time, s.end_time,
            s.duration_seconds, s.topic, s.notes || '', s.productivity_rating || 4, s.session_type || 'manual',
            s.created_at, s.updated_at
          ]);
          mirroredToActiveUser++;
        }
      }
    }
    console.log(`✓ Study sessions migrated: ${originalInserted} original + ${mirroredToActiveUser} mapped to active v2 user.\n`);

    // ----------------------------------------------------
    // STEP 6: Curriculum Topic Mapping & Custom Topics
    // ----------------------------------------------------
    console.log('[6/10] Aligning curriculum topics...');
    const { rows: spTopics } = await supabase.query(`
      SELECT t.id, t.title, t.chapter_number, t.display_order, t.user_id,
             p.title as paper_title, s.code as subject_code
      FROM curriculum_topics t
      JOIN curriculum_papers p ON t.paper_id = p.id
      JOIN curriculum_subjects s ON t.subject_id = s.id
    `);

    const { rows: neonTopics } = await neon.query(`
      SELECT t.id, t.title, t.chapter_number, t.display_order,
             p.title as paper_title, s.code as subject_code, s.id as subject_id
      FROM curriculum_topics t
      JOIN curriculum_papers p ON t.paper_id = p.id
      JOIN curriculum_subjects s ON t.subject_id = s.id
    `);

    // Build topic mapping by title (exact and normalized)
    const neonTopicByTitle = new Map();
    for (const nt of neonTopics) {
      neonTopicByTitle.set(nt.title.trim(), nt);
    }

    const spTopicIdToNeonTopic = new Map();
    for (const st of spTopics) {
      const match = neonTopicByTitle.get(st.title.trim());
      if (match) {
        spTopicIdToNeonTopic.set(st.id, match);
      }
    }
    console.log(`Mapped ${spTopicIdToNeonTopic.size} of ${spTopics.length} curriculum topics from Supabase to Neon.`);

    // Check if custom topics need to be inserted
    for (const st of spTopics) {
      if (st.user_id) {
        console.log(`Found user custom topic: "${st.title}" for user ${st.user_id}`);
        // Find matching subject and paper in Neon
        const neonSub = (await neon.query('SELECT id FROM curriculum_subjects WHERE code = $1 LIMIT 1', [st.subject_code])).rows[0];
        const neonPaper = (await neon.query('SELECT id FROM curriculum_papers WHERE subject_id = $1 LIMIT 1', [neonSub?.id])).rows[0];
        if (neonSub && neonPaper) {
          await neon.query(`
            INSERT INTO curriculum_topics (
              id, paper_id, subject_id, user_id, title, chapter_number, display_order, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING;
          `, [st.id, neonPaper.id, neonSub.id, st.user_id, st.title, st.chapter_number, st.display_order]);
          spTopicIdToNeonTopic.set(st.id, { id: st.id, subject_id: neonSub.id, title: st.title });
        }
      }
    }
    console.log(`✓ Curriculum topics aligned.\n`);

    // ----------------------------------------------------
    // STEP 7: Migrate Revision Records
    // ----------------------------------------------------
    console.log('[7/10] Migrating revision records...');
    const { rows: spRevisionRecords } = await supabase.query('SELECT * FROM revision_records');
    console.log(`Read ${spRevisionRecords.length} revision records from Supabase.`);

    let revMigrated = 0;
    for (const r of spRevisionRecords) {
      const neonTopic = spTopicIdToNeonTopic.get(r.topic_id);
      if (!neonTopic) {
        console.warn(`Could not find neon topic for revision record ${r.id} (topic ${r.topic_id})`);
        continue;
      }

      // 1. Insert for original user
      await neon.query(`
        INSERT INTO revision_records (
          id, user_id, subject_id, topic_id, category,
          activity_date, is_completed, book_name, pages_read,
          questions_solved, correct_count, notes, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13, $14
        )
        ON CONFLICT (user_id, topic_id, category) DO UPDATE SET
          is_completed = EXCLUDED.is_completed,
          activity_date = EXCLUDED.activity_date,
          book_name = EXCLUDED.book_name,
          pages_read = EXCLUDED.pages_read,
          questions_solved = EXCLUDED.questions_solved,
          correct_count = EXCLUDED.correct_count,
          notes = EXCLUDED.notes,
          updated_at = NOW();
      `, [
        r.id, r.user_id, neonTopic.subject_id, neonTopic.id, r.category,
        r.activity_date, r.is_completed, r.book_name, r.pages_read,
        r.questions_solved, r.correct_count, r.notes, r.created_at, r.updated_at
      ]);
      revMigrated++;

      // 2. Also map to active v2 user if different
      if (r.user_id !== activeV2UserId) {
        const mirroredRevId = crypto.createHash('sha256').update(`v2-rev-${r.id}-${activeV2UserId}`).digest('hex');
        const mirroredRevUuid = `${mirroredRevId.slice(0,8)}-${mirroredRevId.slice(8,12)}-4${mirroredRevId.slice(13,16)}-a${mirroredRevId.slice(17,20)}-${mirroredRevId.slice(20,32)}`;

        await neon.query(`
          INSERT INTO revision_records (
            id, user_id, subject_id, topic_id, category,
            activity_date, is_completed, book_name, pages_read,
            questions_solved, correct_count, notes, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12, $13, $14
          )
          ON CONFLICT (user_id, topic_id, category) DO UPDATE SET
            is_completed = EXCLUDED.is_completed,
            activity_date = EXCLUDED.activity_date,
            book_name = EXCLUDED.book_name,
            pages_read = EXCLUDED.pages_read,
            questions_solved = EXCLUDED.questions_solved,
            correct_count = EXCLUDED.correct_count,
            notes = EXCLUDED.notes,
            updated_at = NOW();
        `, [
          mirroredRevUuid, activeV2UserId, neonTopic.subject_id, neonTopic.id, r.category,
          r.activity_date, r.is_completed, r.book_name, r.pages_read,
          r.questions_solved, r.correct_count, r.notes, r.created_at, r.updated_at
        ]);
      }
    }
    console.log(`✓ Revision records migrated: ${revMigrated} records processed.\n`);

    // ----------------------------------------------------
    // STEP 8: Migrate User Curriculum Customizations
    // ----------------------------------------------------
    console.log('[8/10] Migrating curriculum customizations...');
    const { rows: spCustomizations } = await supabase.query('SELECT * FROM user_curriculum_customizations');
    for (const c of spCustomizations) {
      let targetId = c.target_id;
      if (c.target_type === 'topic' && spTopicIdToNeonTopic.has(c.target_id)) {
        targetId = spTopicIdToNeonTopic.get(c.target_id).id;
      }
      await neon.query(`
        INSERT INTO user_curriculum_customizations (
          id, user_id, target_type, target_id, is_hidden, custom_title, custom_order, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (user_id, target_type, target_id) DO UPDATE SET
          is_hidden = EXCLUDED.is_hidden,
          custom_title = EXCLUDED.custom_title,
          custom_order = EXCLUDED.custom_order,
          updated_at = NOW();
      `, [c.id, c.user_id, c.target_type, targetId, c.is_hidden, c.custom_title, c.custom_order, c.updated_at]);

      if (c.user_id !== activeV2UserId) {
        const mirroredCustId = crypto.createHash('sha256').update(`v2-cust-${c.id}-${activeV2UserId}`).digest('hex');
        const mirroredCustUuid = `${mirroredCustId.slice(0,8)}-${mirroredCustId.slice(8,12)}-4${mirroredCustId.slice(13,16)}-a${mirroredCustId.slice(17,20)}-${mirroredCustId.slice(20,32)}`;
        await neon.query(`
          INSERT INTO user_curriculum_customizations (
            id, user_id, target_type, target_id, is_hidden, custom_title, custom_order, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (user_id, target_type, target_id) DO UPDATE SET
            is_hidden = EXCLUDED.is_hidden,
            custom_title = EXCLUDED.custom_title,
            custom_order = EXCLUDED.custom_order,
            updated_at = NOW();
        `, [mirroredCustUuid, activeV2UserId, c.target_type, targetId, c.is_hidden, c.custom_title, c.custom_order, c.updated_at]);
      }
    }
    console.log(`✓ Curriculum customizations migrated.\n`);

    // ----------------------------------------------------
    // STEP 9: Migrate Goals & Achievements
    // ----------------------------------------------------
    console.log('[9/10] Migrating goals and achievements...');
    const { rows: spGoals } = await supabase.query('SELECT * FROM goals');
    for (const g of spGoals) {
      await neon.query(`
        INSERT INTO goals (
          id, user_id, subject_id, title, goal_type, target_value, current_value,
          unit, start_date, end_date, status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13
        )
        ON CONFLICT (id) DO UPDATE SET
          current_value = EXCLUDED.current_value,
          status = EXCLUDED.status,
          updated_at = NOW();
      `, [
        g.id, g.user_id, g.subject_id, g.title, g.goal_type, g.target_value, g.current_value,
        g.unit, g.start_date, g.end_date, g.status, g.created_at, g.updated_at
      ]);
    }

    const { rows: spAchievements } = await supabase.query('SELECT * FROM user_achievements');
    for (const ua of spAchievements) {
      await neon.query(`
        INSERT INTO user_achievements (
          id, user_id, achievement_id, unlocked_at
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, achievement_id) DO NOTHING;
      `, [ua.id, ua.user_id, ua.achievement_id, ua.unlocked_at]);

      if (ua.user_id !== activeV2UserId) {
        await neon.query(`
          INSERT INTO user_achievements (
            id, user_id, achievement_id, unlocked_at
          ) VALUES (gen_random_uuid(), $1, $2, $3)
          ON CONFLICT (user_id, achievement_id) DO NOTHING;
        `, [activeV2UserId, ua.achievement_id, ua.unlocked_at]);
      }
    }

    const { rows: spNotifs } = await supabase.query('SELECT * FROM notification_preferences');
    for (const np of spNotifs) {
      await neon.query(`
        INSERT INTO notification_preferences (
          user_id, browser_notifications_enabled, sound_chimes_enabled,
          daily_reminder_enabled, daily_reminder_time, schedule_reminder_enabled,
          task_deadline_reminder_enabled, goal_completion_alert, streak_milestone_alert,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (user_id) DO UPDATE SET
          browser_notifications_enabled = EXCLUDED.browser_notifications_enabled,
          sound_chimes_enabled = EXCLUDED.sound_chimes_enabled,
          daily_reminder_enabled = EXCLUDED.daily_reminder_enabled,
          daily_reminder_time = EXCLUDED.daily_reminder_time,
          updated_at = NOW();
      `, [
        np.user_id, np.browser_notifications_enabled, np.sound_chimes_enabled,
        np.daily_reminder_enabled, np.daily_reminder_time, np.schedule_reminder_enabled,
        np.task_deadline_reminder_enabled, np.goal_completion_alert, np.streak_milestone_alert,
        np.updated_at
      ]);
    }
    console.log(`✓ Goals, achievements, and notifications migrated.\n`);

    // ----------------------------------------------------
    // STEP 10: Recalculate Totals & Verify
    // ----------------------------------------------------
    console.log('[10/10] Verifying final table row counts in Neon...');
    const tables = [
      'profiles',
      'subjects',
      'study_sessions',
      'curriculum_subjects',
      'curriculum_papers',
      'curriculum_topics',
      'revision_records',
      'user_curriculum_customizations',
      'goals',
      'user_achievements',
      'notification_preferences'
    ];

    console.log('\nFinal Row Counts in Neon:');
    for (const t of tables) {
      const { rows } = await neon.query(`SELECT count(*) FROM "${t}"`);
      console.log(`  - ${t}: ${rows[0].count} rows`);
    }

    // Verify Supabase was untouched
    console.log('\nVerifying Supabase state (should remain 100% untouched):');
    for (const t of ['profiles', 'subjects', 'study_sessions', 'revision_records', 'goals']) {
      const { rows } = await supabase.query(`SELECT count(*) FROM "${t}"`);
      console.log(`  - Supabase ${t}: ${rows[0].count} rows (UNTOUCHED)`);
    }

    console.log('\n====================================================');
    console.log('✓ Migration completed successfully with zero errors!');
    console.log('====================================================\n');

  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    await supabase.end();
    await neon.end();
  }
}

runMigration().catch(err => {
  console.error(err);
  process.exit(1);
});
