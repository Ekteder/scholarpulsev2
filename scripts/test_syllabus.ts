import {
  DEFAULT_SUBJECTS,
  DEFAULT_PAPERS,
  DEFAULT_TOPICS,
  DEFAULT_SUBJECT_BY_ID,
  DEFAULT_PAPER_BY_ID,
  DEFAULT_TOPIC_BY_ID,
  STATIC_TOPIC_IDS,
  STATIC_SUBJECT_IDS,
  STATIC_PAPER_IDS,
  isStaticTopicId,
} from '../src/lib/syllabusData';
import {
  getRevisionWorkspaceData,
  toggleRevisionRecord,
  saveDetailedRevisionRecord,
  deleteRevisionRecord,
  addCustomCurriculumTopic,
  addCustomCurriculumSubject,
  updateCurriculumCustomization,
  createCurriculumResource,
  deleteUserAccountTransactional,
} from '../src/lib/db/repository';
import type { RevisionCategory } from '../src/types/index';

async function runTests() {
  console.log('====================================================');
  console.log(' ScholarPulse: Code-First Static Syllabus Test Suite');
  console.log('====================================================\n');

  // Test 1: Static Syllabus In-Memory Integrity
  console.log('[Test 1] In-Memory Static Syllabus Integrity Check');
  if (DEFAULT_SUBJECTS.length !== 7) throw new Error(`Expected 7 subjects, got ${DEFAULT_SUBJECTS.length}`);
  if (DEFAULT_PAPERS.length !== 15) throw new Error(`Expected 15 papers, got ${DEFAULT_PAPERS.length}`);
  if (DEFAULT_TOPICS.length !== 151) throw new Error(`Expected 151 topics, got ${DEFAULT_TOPICS.length}`);

  // Verify lookup indexes
  if (DEFAULT_SUBJECT_BY_ID.size !== 7) throw new Error('Subject map size mismatch');
  if (DEFAULT_PAPER_BY_ID.size !== 15) throw new Error('Paper map size mismatch');
  if (DEFAULT_TOPIC_BY_ID.size !== 151) throw new Error('Topic map size mismatch');
  if (STATIC_TOPIC_IDS.size !== 151) throw new Error('Topic ID set size mismatch');
  if (STATIC_SUBJECT_IDS.size !== 7) throw new Error('Subject ID set size mismatch');
  if (STATIC_PAPER_IDS.size !== 15) throw new Error('Paper ID set size mismatch');

  // Verify all topics reference valid papers and subjects
  for (const topic of DEFAULT_TOPICS) {
    if (!STATIC_SUBJECT_IDS.has(topic.subjectId)) {
      throw new Error(`Topic ${topic.id} has invalid subjectId ${topic.subjectId}`);
    }
    if (!STATIC_PAPER_IDS.has(topic.paperId)) {
      throw new Error(`Topic ${topic.id} has invalid paperId ${topic.paperId}`);
    }
    if (!isStaticTopicId(topic.id)) {
      throw new Error(`isStaticTopicId returned false for static topic ${topic.id}`);
    }
  }
  console.log('✓ Test 1 Passed: 7 subjects, 15 papers, and 151 deterministic topics validated.\n');

  const testUserId1 = `test_user_1_${Date.now()}`;
  const testUserId2 = `test_user_2_${Date.now()}`;

  try {
    // Test 2: In-Memory Read Performance & Empty User Workspace
    console.log('[Test 2] getRevisionWorkspaceData for New User (0 DB Seed Checks)');
    const t0 = performance.now();
    const workspace = await getRevisionWorkspaceData(testUserId1);
    const durationMs = performance.now() - t0;
    console.log(`Fetched workspace in ${durationMs.toFixed(2)}ms`);

    if (workspace.subjects.length !== 7) throw new Error(`Expected 7 subjects in workspace, got ${workspace.subjects.length}`);
    if (workspace.papers.length !== 15) throw new Error(`Expected 15 papers in workspace, got ${workspace.papers.length}`);
    if (workspace.topics.length !== 151) throw new Error(`Expected 151 topics in workspace, got ${workspace.topics.length}`);
    if (workspace.records.length !== 0) throw new Error(`Expected 0 records for new user, got ${workspace.records.length}`);
    console.log('✓ Test 2 Passed: In-memory static syllabus served instantly without DB seeding.\n');

    // Test 3: Toggle Revision Record on Static Topic (FK Safety Check)
    console.log('[Test 3] Toggle Revision Record on Static Topic');
    const targetTopic = DEFAULT_TOPICS[0];
    const targetSubject = DEFAULT_SUBJECTS[0];

    const toggled = await toggleRevisionRecord(testUserId1, {
      subjectId: targetSubject.id,
      topicId: targetTopic.id,
      category: 'class',
      isCompleted: true,
      activityDate: '2026-11-02',
      notes: 'Completed live lecture review',
    });

    if (!toggled || !toggled.isCompleted) {
      throw new Error('Toggle failed or record not completed');
    }
    console.log('✓ Test 3 Passed: Successfully toggled revision record on static topic.\n');

    // Test 4: Save Detailed Revision Record on Static Topic
    console.log('[Test 4] Save Detailed Revision Record');
    const detailed = await saveDetailedRevisionRecord(testUserId1, {
      subjectId: targetSubject.id,
      topicId: targetTopic.id,
      category: 'book_reading',
      isCompleted: true,
      bookName: 'HSC Main Textbook',
      pagesRead: 45,
      questionsSolved: 15,
      correctCount: 14,
      notes: 'Great chapter on Bangla literature',
    });

    if (!detailed || detailed.pagesRead !== 45 || detailed.questionsSolved !== 15) {
      throw new Error('Detailed record save failed');
    }
    console.log('✓ Test 4 Passed: Detailed revision record saved accurately.\n');

    // Test 5: User Customizations (Rename, Hide, Custom Order)
    console.log('[Test 5] Apply Customization to Static Topic');
    await updateCurriculumCustomization(testUserId1, {
      targetType: 'topic',
      targetId: targetTopic.id,
      customTitle: 'আমার কাস্টমাইজড অধ্যায় শিরোনাম',
      isHidden: true,
    });

    // Verify workspace applies customization
    const customizedWorkspace = await getRevisionWorkspaceData(testUserId1);
    const foundTopic = customizedWorkspace.topics.find((t) => t.id === targetTopic.id);
    if (!foundTopic) throw new Error('Topic not found in customized workspace');
    if (foundTopic.title !== 'আমার কাস্টমাইজড অধ্যায় শিরোনাম') {
      throw new Error(`Expected custom title, got: ${foundTopic.title}`);
    }
    if (!foundTopic.isHidden) {
      throw new Error('Expected topic to be marked isHidden = true');
    }
    console.log('✓ Test 5 Passed: Custom title and isHidden successfully merged into static topic.\n');

    // Test 6: User-Added Custom Topic & Sequential displayOrder
    console.log('[Test 6] User Adds Custom Topic Under Static Paper');
    const customTopic1 = await addCustomCurriculumTopic(testUserId1, {
      subjectId: targetSubject.id,
      paperId: targetTopic.paperId,
      title: 'স্পেশাল রিভিশন কাস্টম চ্যাপ্টার ২০২৬',
    });

    if (!customTopic1 || customTopic1.userId !== testUserId1) {
      throw new Error('Failed to create custom topic');
    }

    const workspaceWithCustom = await getRevisionWorkspaceData(testUserId1);
    if (workspaceWithCustom.topics.length !== 152) {
      throw new Error(`Expected 152 topics (151 static + 1 custom), got ${workspaceWithCustom.topics.length}`);
    }

    const customTopic2 = await addCustomCurriculumTopic(testUserId1, {
      subjectId: targetSubject.id,
      paperId: targetTopic.paperId,
      title: 'স্পেশাল রিভিশন কাস্টম চ্যাপ্টার ২',
    });
    if (customTopic2.displayOrder !== customTopic1.displayOrder + 1) {
      throw new Error(`Expected sequential displayOrder ${customTopic1.displayOrder + 1}, got ${customTopic2.displayOrder}`);
    }
    console.log('✓ Test 6 Passed: User custom topics merged and sequential display orders calculated accurately.\n');

    // Test 7: Add Custom Subject
    console.log('[Test 7] Add custom subject and verify displayOrder');
    const customSubj1 = await addCustomCurriculumSubject(testUserId1, {
      name: 'মনোবিজ্ঞান (Psychology)',
    });
    if (customSubj1.subject.displayOrder !== 8) {
      throw new Error(`Expected custom subject displayOrder 8, got ${customSubj1.subject.displayOrder}`);
    }
    const workspaceWithCustomSubj = await getRevisionWorkspaceData(testUserId1);
    if (workspaceWithCustomSubj.subjects.length !== 8) {
      throw new Error(`Expected 8 subjects, got ${workspaceWithCustomSubj.subjects.length}`);
    }
    console.log('✓ Test 7 Passed: Custom subject created with displayOrder 8 and merged cleanly.\n');

    // Test 8: Multi-User Isolation (User 2 custom subject & custom topic displayOrder)
    console.log('[Test 8] Multi-User Isolation Verification');
    const user2Subj = await addCustomCurriculumSubject(testUserId2, {
      name: 'অর্থনীতি (Economics)',
    });
    if (user2Subj.subject.displayOrder !== 8) {
      throw new Error(`Expected user 2 first custom subject displayOrder 8, got ${user2Subj.subject.displayOrder}`);
    }

    const user2Topic = await addCustomCurriculumTopic(testUserId2, {
      subjectId: targetSubject.id,
      paperId: targetTopic.paperId,
      title: 'User 2 First Custom Topic',
    });
    // Static paper has 12 static topics -> first custom topic must be 13 for user 2!
    if (user2Topic.displayOrder !== 13) {
      throw new Error(`Expected user 2 first custom topic displayOrder 13, got ${user2Topic.displayOrder}`);
    }
    console.log('✓ Test 8 Passed: Multi-user displayOrder isolation verified.\n');

    // Test 9: Concurrency Check (5 parallel toggles)
    console.log('[Test 9] Concurrency Check: Parallel Toggles');
    const categories: RevisionCategory[] = ['revision_note', 'mcq_exam', 'cq_solve', 'test_paper_solving'];
    await Promise.all(
      categories.map((cat) =>
        toggleRevisionRecord(testUserId1, {
          subjectId: targetSubject.id,
          topicId: targetTopic.id,
          category: cat,
          isCompleted: true,
          activityDate: '2026-11-02',
          notes: `Parallel toggle for ${cat}`,
        })
      )
    );
    const workspaceAfterParallel = await getRevisionWorkspaceData(testUserId1);
    const completedRecords = workspaceAfterParallel.records.filter((r) => r.topicId === targetTopic.id && r.isCompleted);
    // 1 from Test 3 (class) + 1 from Test 4 (book_reading) + 4 from Test 9 = 6
    if (completedRecords.length !== 6) {
      throw new Error(`Expected 6 completed records on target topic, got ${completedRecords.length}`);
    }
    console.log('✓ Test 9 Passed: Concurrent toggles processed accurately without race conditions.\n');

    // Test 10: Curriculum Resource Creation
    console.log('[Test 10] Curriculum Resource Creation on Static Topic');
    const res = await createCurriculumResource(testUserId1, {
      subjectId: targetSubject.id,
      topicId: targetTopic.id,
      title: 'Bangla 1st Paper Video Lecture',
      url: 'https://youtube.com/watch?v=example',
      resourceType: 'youtube',
      notes: 'Important lecture for revision',
    });
    if (!res || res.userId !== testUserId1) {
      throw new Error('Failed to create curriculum resource');
    }
    const workspaceWithRes = await getRevisionWorkspaceData(testUserId1);
    if (workspaceWithRes.resources.length !== 1) {
      throw new Error(`Expected 1 resource in workspace, got ${workspaceWithRes.resources.length}`);
    }
    console.log('✓ Test 10 Passed: Curriculum resource created and returned in workspace.\n');

  } finally {
    // Cleanup: Transactionally delete all test user data
    console.log('[Cleanup] Cleaning up all test user records across all tables...');
    await deleteUserAccountTransactional(testUserId1);
    await deleteUserAccountTransactional(testUserId2);
    console.log('✓ Cleanup Complete: Database returned to pristine state.\n');
  }

  console.log('====================================================');
  console.log(' All 10 Static Syllabus Architecture Tests PASSED! ✓');
  console.log('====================================================');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  });
