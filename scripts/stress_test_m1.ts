/**
 * Empirical Adversarial Stress Test Suite for ScholarPulse v2 Milestone 1
 * Targets:
 *   1. Auth & Allowlist Security (src/lib/auth.ts)
 *   2. requireAdminUser() throwing and redirecting
 *   3. Dynamic Repository Fallback (src/lib/db/repository.ts)
 *   4. Server Action Security (src/actions/admin.ts)
 */

import Module from 'module';

// Intercept module imports before application code loads
const origRequire = (Module.prototype as any).require;
let mockCookieStore = new Map<string, string>();
let redirectSpy: { called: boolean; url: string | null } = { called: false, url: null };
let revalidatePathCalls: string[] = [];

(Module.prototype as any).require = function (id: string) {
  if (id === 'server-only') {
    return {};
  }
  if (id === 'next/headers') {
    return {
      cookies: async () => ({
        get: (name: string) =>
          mockCookieStore.has(name) ? { value: mockCookieStore.get(name)! } : undefined,
        set: (name: string, val: string) => mockCookieStore.set(name, val),
        delete: (name: string | { name: string }) => {
          const key = typeof name === 'string' ? name : name.name;
          mockCookieStore.delete(key);
        },
      }),
    };
  }
  if (id === 'next/navigation') {
    return {
      redirect: (url: string) => {
        redirectSpy = { called: true, url };
        const err = new Error('NEXT_REDIRECT');
        (err as any).digest = `NEXT_REDIRECT;replace;${url};307;`;
        throw err;
      },
    };
  }
  if (id === 'next/cache') {
    return {
      revalidatePath: (path: string, type?: string) => {
        revalidatePathCalls.push(`${path}:${type || 'default'}`);
      },
    };
  }
  return origRequire.apply(this, arguments);
};

// Now import dependencies
import { SignJWT } from 'jose';

const AUTH_SECRET =
  process.env.AUTH_SECRET || 'scholarpulse-v2-super-secure-production-secret-key-32chars';
const SECRET_KEY = new TextEncoder().encode(AUTH_SECRET);
const COOKIE_NAME = 'sp_session';

async function createSignedToken(payload: Record<string, unknown>, secret = SECRET_KEY): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(secret);
}

// Track results
interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  detail?: string;
}

const results: TestResult[] = [];

function assert(suite: string, name: string, condition: boolean, detail?: string) {
  if (condition) {
    results.push({ suite, name, passed: true, detail });
    console.log(`  [PASS] ${name}`);
  } else {
    results.push({ suite, name, passed: false, error: 'Assertion failed', detail });
    console.error(`  [FAIL] ${name} ${detail ? `(${detail})` : ''}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('   EMPIRICAL ADVERSARIAL STRESS TEST: MILESTONE 1');
  console.log('================================================================\n');

  // Load modules dynamically
  const authModule = await import('../src/lib/auth');
  const auth = (authModule as any).default || authModule;

  const repoModule = await import('../src/lib/db/repository');
  const repo = (repoModule as any).default || repoModule;

  const adminActionsModule = await import('../src/actions/admin');
  const adminActions = (adminActionsModule as any).default || adminActionsModule;

  const { db } = await import('../src/lib/db/index');
  const { adminAllowlist } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');

  // ============================================================================
  // SUITE 1: Auth & Allowlist Security (isUserAdmin)
  // ============================================================================
  console.log('--- Suite 1: Unauthorized Access & Spoofed Emails in isUserAdmin ---');
  const testAdminEmail = 'm1_test_admin@scholarpulse.edu';
  process.env.ADMIN_EMAILS = `superadmin@scholarpulse.edu, ${testAdminEmail} , secondadmin@scholarpulse.edu`;

  // 1.1 Null / Undefined / Empty sessions
  assert('Auth', 'Null session returns false', (await auth.isUserAdmin(null)) === false);
  assert(
    'Auth',
    'User with empty email returns false',
    (await auth.isUserAdmin({ uid: '1', email: '', name: 'Empty' })) === false
  );
  assert(
    'Auth',
    'User with undefined email returns false',
    (await auth.isUserAdmin({ uid: '1', email: undefined as any, name: 'Undef' })) === false
  );
  assert(
    'Auth',
    'User with null email returns false',
    (await auth.isUserAdmin({ uid: '1', email: null as any, name: 'NullEmail' })) === false
  );

  // 1.2 Regular student user
  assert(
    'Auth',
    'Regular student user returns false',
    (await auth.isUserAdmin({ uid: 'student-123', email: 'student@scholarpulse.edu', name: 'Student' })) === false
  );

  // 1.3 Case sensitivity & whitespace trimming for legitimate admin
  assert(
    'Auth',
    'Exact match in ADMIN_EMAILS returns true',
    (await auth.isUserAdmin({ uid: 'admin-1', email: testAdminEmail, name: 'Admin' })) === true
  );
  assert(
    'Auth',
    'Uppercase admin email returns true (case-insensitive)',
    (await auth.isUserAdmin({ uid: 'admin-1', email: testAdminEmail.toUpperCase(), name: 'Admin' })) === true
  );
  assert(
    'Auth',
    'Admin email with leading/trailing whitespace returns true (trimmed)',
    (await auth.isUserAdmin({ uid: 'admin-1', email: `  ${testAdminEmail}  `, name: 'Admin' })) === true
  );

  // 1.4 Spoofing attacks
  assert(
    'Auth',
    'Subdomain spoofing (admin@domain.attacker.com) returns false',
    (await auth.isUserAdmin({ uid: 'spoofer-1', email: `${testAdminEmail}.attacker.com`, name: 'Spoofer' })) === false
  );
  assert(
    'Auth',
    'Prefix spoofing (fake_admin@domain) returns false',
    (await auth.isUserAdmin({ uid: 'spoofer-2', email: `fake_${testAdminEmail}`, name: 'Spoofer' })) === false
  );
  assert(
    'Auth',
    'TLD spoofing (admin@domain.org instead of .edu) returns false',
    (await auth.isUserAdmin({ uid: 'spoofer-3', email: testAdminEmail.replace('.edu', '.org'), name: 'Spoofer' })) === false
  );
  assert(
    'Auth',
    'Multiple @ attack (admin@domain@evil.com) returns false',
    (await auth.isUserAdmin({ uid: 'spoofer-4', email: `${testAdminEmail}@evil.com`, name: 'Spoofer' })) === false
  );
  assert(
    'Auth',
    'Comma injection (user@domain,admin@domain) returns false',
    (await auth.isUserAdmin({ uid: 'spoofer-5', email: `student@scholarpulse.edu,${testAdminEmail}`, name: 'Spoofer' })) === false
  );
  assert(
    'Auth',
    'Null byte injection in email returns false',
    (await auth.isUserAdmin({ uid: 'spoofer-6', email: `${testAdminEmail}\0.evil.com`, name: 'Spoofer' })) === false
  );

  // 1.5 SQL Injection attempts in email
  const sqliPayloads = [
    "' OR '1'='1",
    "admin'--",
    "' OR 1=1; --",
    `' UNION SELECT * FROM admin_allowlist WHERE '1'='1`,
    `'; DROP TABLE admin_allowlist; --`,
    `" OR ""="`,
    `admin%`,
  ];
  for (const sqli of sqliPayloads) {
    const sqliResult = await auth.isUserAdmin({ uid: 'sqli', email: sqli, name: 'Hacker' });
    assert('Auth', `SQLi attempt (${sqli.slice(0, 20)}) rejected`, sqliResult === false);
  }

  // 1.6 Database allowlist check
  const dbAdminEmail = `db_admin_${Date.now()}@scholarpulse.edu`;
  try {
    await db.insert(adminAllowlist).values({
      email: dbAdminEmail,
      role: 'admin',
      notes: 'Test DB Admin Entry',
      addedBy: 'stress-test',
    });

    const isDbAdmin = await auth.isUserAdmin({ uid: 'db-admin-1', email: dbAdminEmail, name: 'DB Admin' });
    assert('Auth', 'Admin present in database admin_allowlist returns true', isDbAdmin === true);

    const isDbAdminUpper = await auth.isUserAdmin({ uid: 'db-admin-1', email: dbAdminEmail.toUpperCase(), name: 'DB Admin' });
    assert('Auth', 'Database admin email case-insensitive match returns true', isDbAdminUpper === true);

    // Clean up
    await db.delete(adminAllowlist).where(eq(adminAllowlist.email, dbAdminEmail));
    const afterDelete = await auth.isUserAdmin({ uid: 'db-admin-1', email: dbAdminEmail, name: 'DB Admin' });
    assert('Auth', 'After removal from DB allowlist, isUserAdmin returns false', afterDelete === false);
  } catch (err: any) {
    assert('Auth', 'DB allowlist test execution', false, err.message);
  }

  // 1.7 Concurrency stress test: 20 concurrent isUserAdmin requests
  const concurrentEmails = [
    testAdminEmail,
    'attacker1@evil.com',
    'student@scholarpulse.edu',
    testAdminEmail.toUpperCase(),
    "' OR 1=1 --",
    'nonexistent@domain.com',
    testAdminEmail,
  ];
  const concurrentResults = await Promise.all(
    concurrentEmails.map((email) => auth.isUserAdmin({ uid: 'conc', email, name: 'Conc' }))
  );
  assert(
    'Auth',
    'Concurrent isUserAdmin calls return consistent and correct verdicts',
    concurrentResults[0] === true &&
      concurrentResults[1] === false &&
      concurrentResults[2] === false &&
      concurrentResults[3] === true &&
      concurrentResults[4] === false &&
      concurrentResults[5] === false &&
      concurrentResults[6] === true
  );

  // ============================================================================
  // SUITE 2: requireAdminUser() throwing and redirecting
  // ============================================================================
  console.log('\n--- Suite 2: requireAdminUser() Throwing & Redirect Behavior ---');

  // Case 2.1: Null session with redirect (default)
  mockCookieStore.clear();
  redirectSpy = { called: false, url: null };
  try {
    await auth.requireAdminUser();
    assert('RequireAdmin', 'Null session with redirect should throw', false);
  } catch (err: any) {
    const isRedirect =
      err?.digest?.startsWith('NEXT_REDIRECT') ||
      err?.message === 'NEXT_REDIRECT' ||
      redirectSpy.called;
    assert(
      'RequireAdmin',
      'Null session with redirect triggers NEXT_REDIRECT to /?authError=unauthorized_admin',
      isRedirect && redirectSpy.url === '/?authError=unauthorized_admin'
    );
  }

  // Case 2.2: Null session without redirect (redirect: false)
  mockCookieStore.clear();
  redirectSpy = { called: false, url: null };
  try {
    await auth.requireAdminUser({ redirect: false });
    assert('RequireAdmin', 'Null session with redirect:false should throw', false);
  } catch (err: any) {
    assert(
      'RequireAdmin',
      'Null session with redirect:false throws exact Error("Unauthorized: Admin access required")',
      err.message === 'Unauthorized: Admin access required' && !redirectSpy.called
    );
  }

  // Case 2.3: Boolean false argument
  try {
    await auth.requireAdminUser(false);
    assert('RequireAdmin', 'Null session with false should throw', false);
  } catch (err: any) {
    assert(
      'RequireAdmin',
      'Null session with boolean false throws exact Error("Unauthorized: Admin access required")',
      err.message === 'Unauthorized: Admin access required'
    );
  }

  // Case 2.4: Regular student user session with redirect
  const studentToken = await createSignedToken({
    uid: 'student-999',
    email: 'student@scholarpulse.edu',
    name: 'Normal Student',
  });
  mockCookieStore.set(COOKIE_NAME, studentToken);
  redirectSpy = { called: false, url: null };
  try {
    await auth.requireAdminUser();
    assert('RequireAdmin', 'Regular student session with redirect should throw', false);
  } catch (err: any) {
    assert(
      'RequireAdmin',
      'Regular student session triggers NEXT_REDIRECT to /?authError=unauthorized_admin',
      redirectSpy.called && redirectSpy.url === '/?authError=unauthorized_admin'
    );
  }

  // Case 2.5: Regular student user session without redirect
  mockCookieStore.set(COOKIE_NAME, studentToken);
  redirectSpy = { called: false, url: null };
  try {
    await auth.requireAdminUser({ redirect: false });
    assert('RequireAdmin', 'Regular student session with redirect:false should throw', false);
  } catch (err: any) {
    assert(
      'RequireAdmin',
      'Regular student session with redirect:false throws exact Error("Unauthorized: Admin access required")',
      err.message === 'Unauthorized: Admin access required' && !redirectSpy.called
    );
  }

  // Case 2.6: Forged/Tampered JWT session (wrong secret)
  const fakeSecretKey = new TextEncoder().encode('fake-secret-key-that-does-not-match-original');
  const forgedToken = await createSignedToken(
    { uid: 'attacker', email: testAdminEmail, name: 'Attacker' },
    fakeSecretKey
  );
  mockCookieStore.set(COOKIE_NAME, forgedToken);
  redirectSpy = { called: false, url: null };
  try {
    await auth.requireAdminUser({ redirect: false });
    assert('RequireAdmin', 'Forged JWT session should throw', false);
  } catch (err: any) {
    assert(
      'RequireAdmin',
      'Forged JWT session is rejected by jwtVerify and throws Unauthorized',
      err.message === 'Unauthorized: Admin access required'
    );
  }

  // Case 2.7: Expired JWT session
  const expiredToken = await new SignJWT({ uid: 'expired', email: testAdminEmail, name: 'Expired' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
    .sign(SECRET_KEY);
  mockCookieStore.set(COOKIE_NAME, expiredToken);
  try {
    await auth.requireAdminUser({ redirect: false });
    assert('RequireAdmin', 'Expired JWT session should throw', false);
  } catch (err: any) {
    assert(
      'RequireAdmin',
      'Expired JWT session is rejected by jwtVerify and throws Unauthorized',
      err.message === 'Unauthorized: Admin access required'
    );
  }

  // Case 2.8: Corrupted JWT string
  mockCookieStore.set(COOKIE_NAME, 'not.a.valid.jwt.string.at.all');
  try {
    await auth.requireAdminUser({ redirect: false });
    assert('RequireAdmin', 'Corrupted JWT string should throw', false);
  } catch (err: any) {
    assert(
      'RequireAdmin',
      'Corrupted JWT string is rejected and throws Unauthorized',
      err.message === 'Unauthorized: Admin access required'
    );
  }

  // Case 2.9: Valid Admin user session
  const validAdminToken = await createSignedToken({
    uid: 'admin-authorized',
    email: testAdminEmail,
    name: 'Authorized Admin',
  });
  mockCookieStore.set(COOKIE_NAME, validAdminToken);
  redirectSpy = { called: false, url: null };
  try {
    const adminUser = await auth.requireAdminUser();
    assert(
      'RequireAdmin',
      'Authorized admin session succeeds and returns user payload',
      adminUser.email === testAdminEmail && adminUser.uid === 'admin-authorized'
    );
  } catch (err: any) {
    assert('RequireAdmin', 'Authorized admin session should not throw', false, err.message);
  }

  // ============================================================================
  // SUITE 3: Dynamic Repository Fallback (getRevisionWorkspaceData)
  // ============================================================================
  console.log('\n--- Suite 3: Dynamic Repository Fallback in getRevisionWorkspaceData ---');

  // Test 3.1: Populated DB with real database
  const dummyUserId = 'test-dummy-user-' + Date.now();
  try {
    const workspaceData = await repo.getRevisionWorkspaceData(dummyUserId);

    assert(
      'Repository',
      'Workspace data returns all 7 expected keys',
      'subjects' in workspaceData &&
        'papers' in workspaceData &&
        'topics' in workspaceData &&
        'stages' in workspaceData &&
        'customizations' in workspaceData &&
        'records' in workspaceData &&
        'resources' in workspaceData
    );

    assert(
      'Repository',
      'Subjects fallback to default/global curriculum (>= 6)',
      Array.isArray(workspaceData.subjects) && workspaceData.subjects.length >= 6,
      `Count: ${workspaceData.subjects.length}`
    );

    assert(
      'Repository',
      'Papers fallback to default/global papers (>= 10)',
      Array.isArray(workspaceData.papers) && workspaceData.papers.length >= 10,
      `Count: ${workspaceData.papers.length}`
    );

    assert(
      'Repository',
      'Topics fallback to default/global topics (>= 50)',
      Array.isArray(workspaceData.topics) && workspaceData.topics.length >= 50,
      `Count: ${workspaceData.topics.length}`
    );

    assert(
      'Repository',
      'Stages return non-empty array with proper structure (>= 4)',
      Array.isArray(workspaceData.stages) &&
        workspaceData.stages.length >= 4 &&
        workspaceData.stages.every((s: any) => s.id && s.name && s.color !== undefined),
      `Count: ${workspaceData.stages.length}`
    );

    assert(
      'Repository',
      'Customizations for dummy user are empty array',
      Array.isArray(workspaceData.customizations) && workspaceData.customizations.length === 0
    );
  } catch (err: any) {
    assert('Repository', 'getRevisionWorkspaceData execution', false, err.message);
  }

  // Test 3.2: Pure EMPTY DB fallback test (simulating empty DB responses)
  console.log('Testing pure empty DB fallback simulation...');
  const origSelect = db.select;
  try {
    // Intercept select to return empty arrays for all queries
    db.select = function () {
      const chain: any = {
        from: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        then: (resolve: any) => Promise.resolve([]).then(resolve),
        catch: (reject: any) => Promise.resolve([]).catch(reject),
      };
      return chain;
    };

    const emptyDbWorkspace = await repo.getRevisionWorkspaceData('user-empty-db');
    assert(
      'RepositoryFallback',
      'Empty DB: subjects fallback to DEFAULT_SUBJECTS (exactly 7 default subjects)',
      Array.isArray(emptyDbWorkspace.subjects) && emptyDbWorkspace.subjects.length === 7,
      `Count: ${emptyDbWorkspace.subjects.length}`
    );

    assert(
      'RepositoryFallback',
      'Empty DB: papers fallback to DEFAULT_PAPERS',
      Array.isArray(emptyDbWorkspace.papers) && emptyDbWorkspace.papers.length > 0,
      `Count: ${emptyDbWorkspace.papers.length}`
    );

    assert(
      'RepositoryFallback',
      'Empty DB: topics fallback to DEFAULT_TOPICS',
      Array.isArray(emptyDbWorkspace.topics) && emptyDbWorkspace.topics.length > 0,
      `Count: ${emptyDbWorkspace.topics.length}`
    );

    assert(
      'RepositoryFallback',
      'Empty DB: stages fallback to REVISION_CATEGORIES (exactly 6 stages)',
      Array.isArray(emptyDbWorkspace.stages) &&
        emptyDbWorkspace.stages.length === 6 &&
        emptyDbWorkspace.stages.map((s: any) => s.id).includes('class'),
      `Count: ${emptyDbWorkspace.stages.length}`
    );
  } finally {
    // Restore original select
    db.select = origSelect;
  }

  // Test 3.3: Dynamic insertion and reflection in getRevisionWorkspaceData
  console.log('Testing dynamic global subject addition and reflection in getRevisionWorkspaceData...');
  const testSubjectName = `Empirical Physics ${Date.now()}`;
  let createdSubjectId: string | null = null;
  try {
    const created = await repo.saveAdminCurriculumSubject({
      name: testSubjectName,
      code: 'emp_physics',
      color: '#10B981',
      icon: 'Atom',
      displayOrder: 999,
    });
    createdSubjectId = created.id;

    const updatedWorkspace = await repo.getRevisionWorkspaceData(dummyUserId);
    const foundSubject = updatedWorkspace.subjects.find((s: any) => s.id === createdSubjectId);

    assert(
      'Repository',
      'Newly added global curriculum subject dynamically reflects in student workspace data',
      foundSubject !== undefined && foundSubject.name === testSubjectName
    );

    // Clean up
    if (createdSubjectId) {
      await repo.deleteAdminCurriculumSubject(createdSubjectId);
      const afterDeleteWorkspace = await repo.getRevisionWorkspaceData(dummyUserId);
      const stillFound = afterDeleteWorkspace.subjects.find((s: any) => s.id === createdSubjectId);
      assert(
        'Repository',
        'Deleted global curriculum subject dynamically disappears from student workspace data',
        stillFound === undefined
      );
    }
  } catch (err: any) {
    assert('Repository', 'Dynamic global subject reflection test', false, err.message);
    if (createdSubjectId) {
      try {
        await repo.deleteAdminCurriculumSubject(createdSubjectId);
      } catch {}
    }
  }

  // ============================================================================
  // SUITE 4: Server Action Security across all 29 admin actions
  // ============================================================================
  console.log('\n--- Suite 4: Server Action Security across all 29 admin actions ---');

  const actionEntries = Object.entries(adminActions).filter(
    ([name, fn]) => typeof fn === 'function' && name.endsWith('Action')
  );

  console.log(`Discovered ${actionEntries.length} server actions in src/actions/admin.ts.`);
  assert(
    'ServerActions',
    'Exactly 29 admin server actions detected',
    actionEntries.length === 29,
    `Found ${actionEntries.length}`
  );

  // 4.1 Test with NULL session
  mockCookieStore.clear();
  let nullSessionRejectedCount = 0;
  for (const [name, fn] of actionEntries) {
    redirectSpy = { called: false, url: null };
    try {
      await (fn as any)({ dummy: 'arg' });
      console.error(`    SECURITY VULNERABILITY: ${name} executed without session!`);
    } catch (err: any) {
      const isRejected =
        err?.digest?.startsWith('NEXT_REDIRECT') ||
        err?.message?.includes('Unauthorized') ||
        redirectSpy.called;
      if (isRejected) {
        nullSessionRejectedCount++;
      } else {
        console.error(`    UNEXPECTED ERROR in ${name}:`, err);
      }
    }
  }

  assert(
    'ServerActions',
    'All 29 actions reject null session callers',
    nullSessionRejectedCount === actionEntries.length,
    `${nullSessionRejectedCount}/${actionEntries.length} rejected`
  );

  // 4.2 Test with REGULAR STUDENT user session
  mockCookieStore.set(COOKIE_NAME, studentToken);
  let studentSessionRejectedCount = 0;
  for (const [name, fn] of actionEntries) {
    redirectSpy = { called: false, url: null };
    try {
      await (fn as any)({ dummy: 'arg' });
      console.error(`    SECURITY VULNERABILITY: ${name} executed by regular student!`);
    } catch (err: any) {
      const isRejected =
        err?.digest?.startsWith('NEXT_REDIRECT') ||
        err?.message?.includes('Unauthorized') ||
        redirectSpy.called;
      if (isRejected) {
        studentSessionRejectedCount++;
      } else {
        console.error(`    UNEXPECTED ERROR in ${name}:`, err);
      }
    }
  }

  assert(
    'ServerActions',
    'All 29 actions reject authenticated regular student callers',
    studentSessionRejectedCount === actionEntries.length,
    `${studentSessionRejectedCount}/${actionEntries.length} rejected`
  );

  // 4.3 Test schema validation with ADMIN session
  mockCookieStore.set(COOKIE_NAME, validAdminToken);

  // Malformed input test: addAdminAllowlistAction with invalid email
  try {
    await adminActions.addAdminAllowlistAction({ email: 'not-an-email' });
    assert('ServerActions', 'Invalid email schema rejection', false, 'Should have thrown Zod error');
  } catch (err: any) {
    assert(
      'ServerActions',
      'addAdminAllowlistAction rejects invalid email with Zod validation error',
      err?.name === 'ZodError' || Array.isArray(err?.issues)
    );
  }

  // Malformed input test: saveAdminGoalTemplateAction with negative targetValue
  try {
    await adminActions.saveAdminGoalTemplateAction({
      title: 'Invalid Goal',
      targetType: 'pomodoro',
      targetValue: -10,
      period: 'daily',
    });
    assert('ServerActions', 'Negative targetValue schema rejection', false);
  } catch (err: any) {
    assert(
      'ServerActions',
      'saveAdminGoalTemplateAction rejects negative targetValue with Zod validation error',
      err?.name === 'ZodError' || Array.isArray(err?.issues)
    );
  }

  // Malformed input test: saveAdminScheduleTemplateAction with invalid time format
  try {
    await adminActions.saveAdminScheduleTemplateAction({
      title: 'Invalid Schedule',
      dayOfWeek: 1,
      startTime: '25:99',
      endTime: 'noon',
    });
    assert('ServerActions', 'Invalid time format schema rejection', false);
  } catch (err: any) {
    assert(
      'ServerActions',
      'saveAdminScheduleTemplateAction rejects invalid time regex with Zod validation error',
      err?.name === 'ZodError' || Array.isArray(err?.issues)
    );
  }

  // 4.4 End-to-end admin action execution & revalidation
  revalidatePathCalls = [];
  const testConfigKey = `test_config_${Date.now()}`;
  try {
    const saveRes = await adminActions.saveAdminSystemConfigAction(
      testConfigKey,
      'stress_test_value',
      'Temporary test config'
    );
    assert(
      'ServerActions',
      'Authorized admin can successfully execute saveAdminSystemConfigAction',
      saveRes?.success === true && saveRes?.config?.key === testConfigKey
    );

    assert(
      'ServerActions',
      'saveAdminSystemConfigAction invokes revalidatePath("/", "layout")',
      revalidatePathCalls.includes('/:layout')
    );

    // Retrieve via action
    const getRes = await adminActions.getAdminSystemConfigsAction();
    const configFound = getRes?.configs?.find((c: any) => c.key === testConfigKey);
    assert(
      'ServerActions',
      'getAdminSystemConfigsAction retrieves newly created configuration',
      configFound !== undefined && configFound.value === 'stress_test_value'
    );

    // Delete via action
    const delRes = await adminActions.deleteAdminSystemConfigAction(testConfigKey);
    assert(
      'ServerActions',
      'deleteAdminSystemConfigAction successfully deletes configuration',
      delRes?.success === true
    );
  } catch (err: any) {
    assert('ServerActions', 'Admin action end-to-end CRUD test', false, err.message);
  }

  // ============================================================================
  // FINAL SUMMARY
  // ============================================================================
  console.log('\n================================================================');
  console.log('   EMPIRICAL ADVERSARIAL STRESS TEST SUMMARY');
  console.log('================================================================');

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total Assertions: ${total}`);
  console.log(`Passed:           ${passed}`);
  console.log(`Failed:           ${failed}`);

  if (failed > 0) {
    console.log('\nFailed Tests:');
    for (const r of results.filter((r) => !r.passed)) {
      console.log(` - [${r.suite}] ${r.name}: ${r.detail || r.error}`);
    }
    process.exit(1);
  } else {
    console.log('\nAll empirical stress tests PASSED successfully!');
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('FATAL UNCAUGHT ERROR IN TEST SUITE:', err);
  process.exit(1);
});
