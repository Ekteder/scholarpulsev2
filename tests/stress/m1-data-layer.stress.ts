import Module from 'module';
import assert from 'node:assert';
import crypto from 'node:crypto';

// Polyfill server-only and next packages for headless test execution
const origRequire = Module.prototype.require;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
Module.prototype.require = function (id: string, ...args: any[]) {
  if (id === 'server-only') return {};
  if (id === 'next/headers') return { cookies: async () => ({ get: () => null }) };
  if (id === 'next/navigation') {
    return {
      redirect: (url: string) => {
        const err = new Error('NEXT_REDIRECT');
        (err as unknown as { digest: string }).digest = `NEXT_REDIRECT;replace;${url};307;`;
        throw err;
      },
    };
  }
  if (id === 'next/cache') return { revalidatePath: () => {} };
  return (origRequire as any).apply(this, [id, ...args]);
};

async function runEmpiricalStressTests() {
  console.log('================================================================');
  console.log(' ScholarPulse v2 — Milestone 1 Empirical Stress Test Harness');
  console.log(' Adversarial Challenger: teamwork_challenger_m1_2');
  console.log('================================================================\n');

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const repoModule = (await import('../../src/lib/db/repository')) as any;
  const repo = repoModule.default || repoModule;
  const authModule = (await import('../../src/lib/auth')) as any;
  const { isUserAdmin, requireAdminUser } = authModule;
  const dbModule = (await import('../../src/lib/db/index')) as any;
  const db = dbModule.db || dbModule.default?.db;
  const schemaModule = (await import('../../src/lib/db/schema')) as any;
  const schema = schemaModule.default || schemaModule;
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const { eq } = await import('drizzle-orm');

  let passed = 0;
  let failed = 0;
  const errors: { name: string; error: unknown }[] = [];

  async function test(name: string, fn: () => Promise<void>) {
    process.stdout.write(`TEST: ${name} ... `);
    try {
      await fn();
      console.log('PASSED ✓');
      passed++;
    } catch (err) {
      console.log('FAILED ✗');
      console.error(err);
      failed++;
      errors.push({ name, error: err });
    }
  }

  // Tracking IDs for cleanup
  const cleanups: (() => Promise<void>)[] = [];

  try {
    // =========================================================================
    // SUITE 1: CRUD Operations across all 5 new tables
    // =========================================================================
    console.log('\n--- SUITE 1: 5-Table CRUD & Boundary Conditions ---\n');

    // 1.1 admin_allowlist CRUD
    await test('admin_allowlist: create, case-normalization, whitespace trimming, and fetch', async () => {
      const email = `Stress_Admin_${Date.now()}@Example.COM`;
      const normalizedEmail = email.toLowerCase().trim();
      cleanups.push(async () => {
        await repo.deleteAdminAllowlistEntry(normalizedEmail);
      });

      const entry = await repo.createAdminAllowlistEntry({
        email: `   ${email}   `,
        role: 'superadmin',
        notes: 'Initial stress test notes',
        addedBy: 'challenger_suite',
      });

      assert.strictEqual(entry.email, normalizedEmail, 'Email must be normalized to lowercase and trimmed');
      assert.strictEqual(entry.role, 'superadmin');

      const fetched = await repo.getAdminAllowlistEntry(email);
      assert.ok(fetched, 'Entry must be retrievable with original mixed-case email');
      assert.strictEqual(fetched.email, normalizedEmail);
    });

    await test('admin_allowlist: duplicate email updates existing record (upsert idempotency)', async () => {
      const email = `idempotent_${Date.now()}@test.com`;
      cleanups.push(async () => {
        await repo.deleteAdminAllowlistEntry(email);
      });

      await repo.createAdminAllowlistEntry({ email, role: 'admin', notes: 'First' });
      const updated = await repo.createAdminAllowlistEntry({ email, role: 'readonly', notes: 'Second' });

      assert.strictEqual(updated.email, email);
      assert.strictEqual(updated.role, 'readonly', 'Role must be updated on duplicate key');
      assert.strictEqual(updated.notes, 'Second', 'Notes must be updated on duplicate key');
    });

    await test('admin_allowlist: SQL injection, huge strings (10k chars), emojis, and deletion', async () => {
      const email = `sql_inject_${Date.now()}' OR 1=1; --@example.com`;
      const normalizedEmail = email.toLowerCase().trim();
      const hugeNotes = 'A'.repeat(10000) + ' 🚀 測試 <script>alert("xss")</script>';

      cleanups.push(async () => {
        await repo.deleteAdminAllowlistEntry(normalizedEmail);
      });

      const created = await repo.createAdminAllowlistEntry({
        email,
        role: 'admin',
        notes: hugeNotes,
      });

      assert.strictEqual(created.email, normalizedEmail);
      assert.strictEqual(created.notes, hugeNotes, 'Huge string with unicode/emojis/HTML must be preserved exactly');

      const deleted = await repo.deleteAdminAllowlistEntry(email);
      assert.ok(deleted, 'Delete must return the deleted record');
      assert.strictEqual(deleted.email, normalizedEmail);

      const afterDelete = await repo.getAdminAllowlistEntry(email);
      assert.strictEqual(afterDelete, null, 'Entry must be null after deletion');

      const deleteNonExistent = await repo.deleteAdminAllowlistEntry('non_existent@example.com');
      assert.strictEqual(deleteNonExistent, null, 'Deleting non-existent entry must return null safely');
    });

    // 1.2 curriculum_stages CRUD
    await test('curriculum_stages: create, boundary values (neg displayOrder, 0 weight, empty badge)', async () => {
      const stageId = `stage_stress_${Date.now()}`;
      cleanups.push(async () => {
        await repo.deleteAdminCurriculumStage(stageId);
      });

      const stage = await repo.saveAdminCurriculumStage({
        id: stageId,
        name: 'Stress Stage 🎯',
        color: '#FF5733',
        badgeText: '',
        displayOrder: -5,
        weight: 0,
        isActive: false,
      });

      assert.strictEqual(stage.id, stageId);
      assert.strictEqual(stage.displayOrder, -5, 'Negative displayOrder must be supported');
      assert.strictEqual(stage.weight, 0, 'Zero weight must be supported');
      assert.strictEqual(stage.isActive, false);

      const fetched = await repo.getCurriculumStageById(stageId);
      assert.ok(fetched);
      assert.strictEqual(fetched.name, 'Stress Stage 🎯');
    });

    await test('curriculum_stages: upsert partial update preserves untouched fields', async () => {
      const stageId = `stage_upsert_${Date.now()}`;
      cleanups.push(async () => {
        await repo.deleteAdminCurriculumStage(stageId);
      });

      await repo.saveAdminCurriculumStage({
        id: stageId,
        name: 'Original Stage',
        color: '#10B981',
        badgeText: 'ORIG',
        displayOrder: 10,
        weight: 5,
        isActive: true,
      });

      // Partial update: only update name and weight
      const updated = await repo.saveAdminCurriculumStage({
        id: stageId,
        name: 'Updated Stage',
        weight: 9,
      });

      assert.strictEqual(updated.name, 'Updated Stage');
      assert.strictEqual(updated.weight, 9);
      assert.strictEqual(updated.color, '#10B981', 'Color must be preserved');
      assert.strictEqual(updated.badgeText, 'ORIG', 'BadgeText must be preserved');
      assert.strictEqual(updated.displayOrder, 10, 'DisplayOrder must be preserved');
    });

    await test('curriculum_stages: reorderCurriculumStages strictly sets displayOrder 0..N', async () => {
      const idA = `stage_ord_A_${Date.now()}`;
      const idB = `stage_ord_B_${Date.now()}`;
      const idC = `stage_ord_C_${Date.now()}`;

      cleanups.push(async () => {
        await repo.deleteAdminCurriculumStage(idA);
        await repo.deleteAdminCurriculumStage(idB);
        await repo.deleteAdminCurriculumStage(idC);
      });

      await repo.saveAdminCurriculumStage({ id: idA, name: 'Stage A', displayOrder: 99 });
      await repo.saveAdminCurriculumStage({ id: idB, name: 'Stage B', displayOrder: 88 });
      await repo.saveAdminCurriculumStage({ id: idC, name: 'Stage C', displayOrder: 77 });

      // Apply reordering: [idC, idA, idB] -> order must be C=0, A=1, B=2
      const reordered = await repo.reorderCurriculumStages([idC, idA, idB]);
      assert.strictEqual(reordered.length, 3);

      const stageC = await repo.getCurriculumStageById(idC);
      const stageA = await repo.getCurriculumStageById(idA);
      const stageB = await repo.getCurriculumStageById(idB);

      assert.strictEqual(stageC?.displayOrder, 0, 'Stage C must have displayOrder 0');
      assert.strictEqual(stageA?.displayOrder, 1, 'Stage A must have displayOrder 1');
      assert.strictEqual(stageB?.displayOrder, 2, 'Stage B must have displayOrder 2');
    });

    // 1.3 goal_templates CRUD
    await test('goal_templates: create with auto-UUID, boundary targetValue (1M), and upsert', async () => {
      const template = await repo.saveAdminGoalTemplate({
        title: 'Master Physics 🚀',
        description: 'Complete 1,000,000 problems',
        targetType: 'questions_solved',
        targetValue: 1000000,
        period: 'yearly',
      });

      assert.ok(template.id, 'Template must be assigned an ID automatically');
      cleanups.push(async () => {
        await repo.deleteAdminGoalTemplate(template.id);
      });

      assert.strictEqual(template.targetValue, 1000000);
      assert.strictEqual(template.isActive, true);

      // Upsert
      const updated = await repo.saveAdminGoalTemplate({
        id: template.id,
        title: 'Master Physics (Updated)',
        targetType: 'questions_solved',
        targetValue: 500,
        period: 'monthly',
        isActive: false,
      });

      assert.strictEqual(updated.title, 'Master Physics (Updated)');
      assert.strictEqual(updated.targetValue, 500);
      assert.strictEqual(updated.period, 'monthly');
      assert.strictEqual(updated.isActive, false);

      const deleted = await repo.deleteAdminGoalTemplate(template.id);
      assert.ok(deleted);
      assert.strictEqual(await repo.getGoalTemplateById(template.id), null);
    });

    // 1.4 schedule_templates CRUD
    await test('schedule_templates: ordering by dayOfWeek ASC and startTime ASC', async () => {
      const t1 = await repo.saveAdminScheduleTemplate({
        title: 'Late Monday',
        dayOfWeek: 1,
        startTime: '18:00',
        endTime: '20:00',
      });
      const t2 = await repo.saveAdminScheduleTemplate({
        title: 'Early Monday',
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '10:00',
      });
      const t3 = await repo.saveAdminScheduleTemplate({
        title: 'Sunday Study',
        dayOfWeek: 0,
        startTime: '12:00',
        endTime: '14:00',
      });

      cleanups.push(async () => {
        await repo.deleteAdminScheduleTemplate(t1.id);
        await repo.deleteAdminScheduleTemplate(t2.id);
        await repo.deleteAdminScheduleTemplate(t3.id);
      });

      const all = await repo.getAllScheduleTemplates();
      const filtered = all.filter((s: { id: string }) => [t1.id, t2.id, t3.id].includes(s.id));

      assert.strictEqual(filtered.length, 3);
      assert.strictEqual(filtered[0].id, t3.id, 'Sunday (day 0) must come first');
      assert.strictEqual(filtered[1].id, t2.id, 'Monday 08:00 must come before Monday 18:00');
      assert.strictEqual(filtered[2].id, t1.id, 'Monday 18:00 must come last');
    });

    // 1.5 system_configurations CRUD
    await test('system_configurations: special key chars, large 50KB payload, and default value fallback', async () => {
      const key = `app.config:custom_setting#${Date.now()}`;
      cleanups.push(async () => {
        await repo.deleteAdminSystemConfiguration(key);
      });

      const largePayload = JSON.stringify({
        settings: Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Param_${i}` })),
      });

      await repo.saveAdminSystemConfiguration({
        key,
        value: largePayload,
        description: 'Large JSON payload stress test',
        updatedBy: 'challenger',
      });

      const val = await repo.getSystemConfigurationValue(key, 'default');
      assert.strictEqual(val, largePayload);

      const nonExistentVal = await repo.getSystemConfigurationValue('non.existent.key', 'fallback_val');
      assert.strictEqual(nonExistentVal, 'fallback_val', 'Must return default value for non-existent key');

      const deleted = await repo.deleteAdminSystemConfiguration(key);
      assert.ok(deleted);
      assert.strictEqual(await repo.getSystemConfiguration(key), null);
    });

    // =========================================================================
    // SUITE 2: getRevisionWorkspaceData Isolation & Non-Corruption
    // =========================================================================
    console.log('\n--- SUITE 2: Student Workspace Isolation & Non-Corruption ---\n');

    await test('getRevisionWorkspaceData: adding global subjects & stages does NOT mutate student records', async () => {
      const studentId = `student_stress_${Date.now()}`;
      const studentEmail = `${studentId}@student.test`;

      // 1. Create a dummy profile for the student
      await repo.getOrCreateProfile(studentId, studentEmail, 'Stress Student');

      // 2. Student creates a custom subject, paper, topic
      const customSubId = crypto.randomUUID();
      const customPaperId = crypto.randomUUID();
      const customTopicId = crypto.randomUUID();

      await db.insert(schema.curriculumSubjects).values({
        id: customSubId,
        userId: studentId,
        name: 'Student Custom Art',
        code: 'ART-101',
        displayOrder: 1,
      });

      await db.insert(schema.curriculumPapers).values({
        id: customPaperId,
        userId: studentId,
        subjectId: customSubId,
        title: 'Art History Paper 1',
        displayOrder: 1,
      });

      await db.insert(schema.curriculumTopics).values({
        id: customTopicId,
        userId: studentId,
        subjectId: customSubId,
        paperId: customPaperId,
        title: 'Renaissance Period',
        chapterNumber: 1,
        displayOrder: 1,
      });

      // 3. Student records a revision entry
      const recId = crypto.randomUUID();
      await db.insert(schema.revisionRecords).values({
        id: recId,
        userId: studentId,
        subjectId: customSubId,
        topicId: customTopicId,
        category: 'revision_note',
        activityDate: '2026-11-02',
        isCompleted: true,
        notes: 'Initial student revision notes',
      });

      // Query workspace initially to obtain a default global subject UUID
      const initialWorkspace = await repo.getRevisionWorkspaceData(studentId);
      const targetSub = initialWorkspace.subjects[0];

      // 4. Student customizes an existing global subject
      await db.insert(schema.userCurriculumCustomizations).values({
        userId: studentId,
        targetType: 'subject',
        targetId: targetSub.id,
        customTitle: 'My Personalized Subject Title',
        customOrder: 0,
        isHidden: false,
      });

      cleanups.push(async () => {
        await db.delete(schema.revisionRecords).where(eq(schema.revisionRecords.userId, studentId));
        await db.delete(schema.userCurriculumCustomizations).where(eq(schema.userCurriculumCustomizations.userId, studentId));
        await db.delete(schema.curriculumTopics).where(eq(schema.curriculumTopics.userId, studentId));
        await db.delete(schema.curriculumPapers).where(eq(schema.curriculumPapers.userId, studentId));
        await db.delete(schema.curriculumSubjects).where(eq(schema.curriculumSubjects.userId, studentId));
        await db.delete(schema.profiles).where(eq(schema.profiles.userId, studentId));
      });

      // Query workspace BEFORE admin mutations
      const workspaceBefore = await repo.getRevisionWorkspaceData(studentId);

      assert.strictEqual(workspaceBefore.records.length, 1, 'Student must have exactly 1 revision record');
      assert.strictEqual(workspaceBefore.records[0].id, recId);
      assert.strictEqual(workspaceBefore.records[0].notes, 'Initial student revision notes');

      const customSubBefore = workspaceBefore.subjects.find((s: { id: string }) => s.id === customSubId);
      assert.ok(customSubBefore, 'Student custom subject must be present');

      const targetSubBefore = workspaceBefore.subjects.find((s: { id: string }) => s.id === targetSub.id);
      assert.strictEqual(targetSubBefore?.name, 'My Personalized Subject Title', 'Student customization must apply');

      // 5. ADMIN MUTATIONS: Add new global subject, add new stage, update stage
      const globalSubId = crypto.randomUUID();
      const adminStageId = `admin_global_stage_${Date.now()}`;

      cleanups.push(async () => {
        await repo.deleteAdminCurriculumSubject(globalSubId);
        await repo.deleteAdminCurriculumStage(adminStageId);
      });

      await repo.saveAdminCurriculumSubject({
        id: globalSubId,
        name: 'Global Admin Astronomy',
        code: 'AST-999',
        displayOrder: 999,
      });

      await repo.saveAdminCurriculumStage({
        id: adminStageId,
        name: 'Flashcard Mastery',
        color: '#EC4899',
        badgeText: 'FM',
        displayOrder: 50,
      });

      // Query workspace AFTER admin mutations
      const workspaceAfter = await repo.getRevisionWorkspaceData(studentId);

      // VERIFICATIONS:
      // A. Student revision records MUST be 100% identical and uncorrupted
      assert.strictEqual(workspaceAfter.records.length, 1, 'Student records count must remain exactly 1');
      assert.strictEqual(workspaceAfter.records[0].id, recId, 'Record ID must match');
      assert.strictEqual(workspaceAfter.records[0].topicId, customTopicId, 'Record topicId must match');
      assert.strictEqual(workspaceAfter.records[0].notes, 'Initial student revision notes', 'Record notes must match');
      assert.strictEqual(workspaceAfter.records[0].isCompleted, true);

      // B. Student custom subject, paper, topic must remain intact
      const customSubAfter = workspaceAfter.subjects.find((s: { id: string }) => s.id === customSubId);
      assert.ok(customSubAfter, 'Student custom subject must still exist');
      assert.strictEqual(customSubAfter?.name, 'Student Custom Art');

      const customTopicAfter = workspaceAfter.topics.find((t: { id: string }) => t.id === customTopicId);
      assert.ok(customTopicAfter, 'Student custom topic must still exist');

      // C. Student customized global title must remain intact
      const targetSubAfter = workspaceAfter.subjects.find((s: { id: string }) => s.id === targetSub.id);
      assert.strictEqual(targetSubAfter?.name, 'My Personalized Subject Title', 'Student customization must not be clobbered');

      // D. Global mutations must appear alongside student data
      const globalSubFound = workspaceAfter.subjects.find((s: { id: string }) => s.id === globalSubId);
      assert.ok(globalSubFound, 'New global subject must appear in workspace');
      assert.strictEqual(globalSubFound?.name, 'Global Admin Astronomy');

      const globalStageFound = workspaceAfter.stages.find((st: { id: string }) => st.id === adminStageId);
      assert.ok(globalStageFound, 'New global stage must appear in stages list');
      assert.strictEqual(globalStageFound?.name, 'Flashcard Mastery');
    });

    // =========================================================================
    // SUITE 3: Achievements Catalog Cache Invalidation
    // =========================================================================
    console.log('\n--- SUITE 3: Achievements Catalog In-Memory Cache Invalidation ---\n');

    await test('invalidateAchievementsCatalogCache: badge mutations immediately invalidate cache', async () => {
      const badgeId = `stress_badge_${Date.now()}`;
      cleanups.push(async () => {
        await repo.deleteAdminAchievement(badgeId);
        repo.invalidateAchievementsCatalogCache();
      });

      // 1. Prime cache
      repo.invalidateAchievementsCatalogCache();
      const initialCatalog = await repo.getAllAchievementsCatalog();
      assert.ok(initialCatalog.length > 0, 'Catalog should be initialized');

      // 2. Insert new achievement
      await repo.saveAdminAchievement({
        id: badgeId,
        title: 'Initial Badge Title',
        description: 'Test Description',
        icon: 'Flame',
        category: 'streak',
        requirementType: 'streak_days',
        requirementValue: 10,
      });

      // 3. Fetch catalog: must contain the new badge immediately without stale cache
      const catalogAfterAdd = await repo.getAllAchievementsCatalog();
      const addedBadge = catalogAfterAdd.find((b: { id: string }) => b.id === badgeId);
      assert.ok(addedBadge, 'New badge must be visible immediately (cache was cleared)');
      assert.strictEqual(addedBadge?.title, 'Initial Badge Title');

      // 4. Update the achievement
      await repo.saveAdminAchievement({
        id: badgeId,
        title: 'Updated Super Badge Title',
        description: 'Updated Description',
        icon: 'Zap',
        category: 'streak',
        requirementType: 'streak_days',
        requirementValue: 20,
      });

      // 5. Fetch catalog: must reflect updated title immediately
      const catalogAfterUpdate = await repo.getAllAchievementsCatalog();
      const updatedBadge = catalogAfterUpdate.find((b: { id: string }) => b.id === badgeId);
      assert.ok(updatedBadge);
      assert.strictEqual(updatedBadge?.title, 'Updated Super Badge Title', 'Cache must be invalidated on update');
      assert.strictEqual(updatedBadge?.requirementValue, 20);

      // 6. Delete the achievement
      await repo.deleteAdminAchievement(badgeId);

      // 7. Fetch catalog: badge must be gone immediately
      const catalogAfterDelete = await repo.getAllAchievementsCatalog();
      const deletedBadge = catalogAfterDelete.find((b: { id: string }) => b.id === badgeId);
      assert.strictEqual(deletedBadge, undefined, 'Badge must be removed immediately (cache was cleared)');

      // 8. Explicit invalidate call
      assert.doesNotThrow(() => {
        repo.invalidateAchievementsCatalogCache();
      });
    });

    // =========================================================================
    // SUITE 4: Security & Allowlist Adversarial Scenarios
    // =========================================================================
    console.log('\n--- SUITE 4: Auth & Allowlist Security Stress Scenarios ---\n');

    await test('isUserAdmin & requireAdminUser: allowlist precedence, case variation, and rejection', async () => {
      // 1. Test process.env.ADMIN_EMAILS fallback
      const envEmail = 'env_admin@scholarpulse.org';
      process.env.ADMIN_EMAILS = `someone_else@test.com,  ${envEmail.toUpperCase()}  , third@test.com`;

      assert.strictEqual(
        await isUserAdmin({ uid: 'u1', email: envEmail, name: 'Env Admin' }),
        true,
        'Env allowlist with uppercase and spaces must grant admin'
      );

      assert.strictEqual(
        await isUserAdmin({ uid: 'u1', email: '  ENV_ADMIN@scholarpulse.org  ', name: 'Env Admin' }),
        true,
        'User email with spaces and uppercase must match'
      );

      // 2. Test database allowlist table
      const dbAdminEmail = `db_admin_${Date.now()}@test.org`;
      cleanups.push(async () => {
        await repo.deleteAdminAllowlistEntry(dbAdminEmail);
      });

      await repo.createAdminAllowlistEntry({ email: dbAdminEmail, role: 'admin' });

      assert.strictEqual(
        await isUserAdmin({ uid: 'u2', email: dbAdminEmail.toUpperCase(), name: 'DB Admin' }),
        true,
        'DB allowlist must grant admin across casing'
      );

      // 3. Test unauthorized user
      assert.strictEqual(
        await isUserAdmin({ uid: 'u3', email: 'regular_student@test.org', name: 'Student' }),
        false,
        'Regular user must be denied'
      );

      assert.strictEqual(await isUserAdmin(null), false, 'Null user must be denied');
      assert.strictEqual(
        await isUserAdmin({ uid: 'u4', email: '', name: 'Empty' }),
        false,
        'Empty email must be denied'
      );

      // 4. Test requireAdminUser behavior
      // A. Unauthorized with redirect: false throws Error
      let threw = false;
      try {
        await requireAdminUser({ redirect: false });
      } catch (err: unknown) {
        threw = true;
        assert.ok((err as Error).message.includes('Unauthorized'));
      }
      assert.ok(threw, 'requireAdminUser must throw when unauthorized and redirect: false');

      // B. Unauthorized with redirect: true redirects (throws NEXT_REDIRECT digest)
      let redirected = false;
      try {
        await requireAdminUser({ redirect: true });
      } catch (err: unknown) {
        const d = (err as { digest?: string }).digest;
        if (d && d.includes('NEXT_REDIRECT') && d.includes('unauthorized_admin')) {
          redirected = true;
        }
      }
      assert.ok(redirected, 'requireAdminUser must redirect to /?authError=unauthorized_admin');
    });

  } finally {
    // Teardown / Cleanup
    console.log('\n--- Cleaning up temporary stress test database artifacts ---');
    for (const cleanup of cleanups) {
      try {
        await cleanup();
      } catch (e) {
        console.error('Cleanup warning:', e);
      }
    }
  }

  console.log('\n================================================================');
  console.log(` Stress Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    console.error('Test Failures:');
    for (const { name, error } of errors) {
      console.error(`- ${name}:`, error);
    }
    process.exit(1);
  } else {
    console.log('ALL EMPIRICAL STRESS TESTS PASSED WITH 100% SUCCESS.');
    process.exit(0);
  }
}

runEmpiricalStressTests().catch((err) => {
  console.error('Fatal test harness execution error:', err);
  process.exit(1);
});
