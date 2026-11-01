'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  CurriculumSubject,
  CurriculumPaper,
  CurriculumResourceItem,
  CurriculumTopic,
  RevisionCategory,
  RevisionRecord,
  REVISION_CATEGORIES,
  RevisionWorkspacePayload,
  UserCurriculumCustomization,
} from '@/types/index';
import { MathRenderer } from './MathRenderer';
import {
  BookOpenCheck,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  Filter,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  BarChart3,
  ListTodo,
  History,
  FileText,
  BookOpen,
  Calendar,
  Layers,
  GraduationCap,
  ChevronRight,
  TrendingUp,
  Percent,
  ExternalLink,
  Video,
  Link as LinkIcon,
  Bookmark,
} from 'lucide-react';

const CATEGORY_ICONS: Record<RevisionCategory, React.ComponentType<{ className?: string }>> = {
  class: GraduationCap,
  revision_note: FileText,
  book_reading: BookOpen,
  mcq_exam: CheckCircle2,
  cq_solve: Edit3,
  test_paper_solving: Layers,
};

type ViewMode = 'matrix' | 'records' | 'analytics';

export function RevisionTrackerView() {
  const {
    revisionData,
    fetchRevisionWorkspace,
    toggleRevisionActivity,
    saveDetailedRevision,
    deleteRevisionRecordItem,
    addCustomCurriculumTopicItem,
    addCustomCurriculumSubjectItem,
    updateCurriculumCustomizationItem,
    createResource,
    deleteResource,
    addToast,
  } = useWorkspace();

  const [detailTab, setDetailTab] = useState<'log' | 'resources'>('log');
  const [resTitle, setResTitle] = useState('');
  const [resUrl, setResUrl] = useState('');
  const [resType, setResType] = useState<string>('link');
  const [resPageRef, setResPageRef] = useState('');
  const [resNotes, setResNotes] = useState('');
  const [savingRes, setSavingRes] = useState(false);

  const [loading, setLoading] = useState(!revisionData);
  const [error, setError] = useState<string | null>(null);

  // Raw data from server or in-memory cache for instant 0ms mount
  const [subjects, setSubjects] = useState<CurriculumSubject[]>(revisionData?.subjects || []);
  const [papers, setPapers] = useState<CurriculumPaper[]>(revisionData?.papers || []);
  const [topics, setTopics] = useState<CurriculumTopic[]>(revisionData?.topics || []);
  const [customizations, setCustomizations] = useState<UserCurriculumCustomization[]>(
    revisionData?.customizations || []
  );
  const [records, setRecords] = useState<RevisionRecord[]>(revisionData?.records || []);

  // Navigation & filter state
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'not_started' | 'in_progress' | 'completed'>('all');
  const [categoryFilter, setCategoryFilter] = useState<RevisionCategory | 'all'>('all');
  const [showHidden, setShowHidden] = useState(false);

  // Modals
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [activeDetailItem, setActiveDetailItem] = useState<{
    subject: CurriculumSubject;
    topic: CurriculumTopic;
    category: RevisionCategory;
    record?: RevisionRecord;
  } | null>(null);

  const topicResources = useMemo(() => {
    if (!activeDetailItem || !revisionData?.resources) return [];
    return revisionData.resources.filter((r) => r.topicId === activeDetailItem.topic.id);
  }, [activeDetailItem, revisionData?.resources]);

  const handleSaveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDetailItem || !resTitle.trim() || !resUrl.trim()) return;
    setSavingRes(true);
    try {
      await createResource({
        subjectId: activeDetailItem.subject.id,
        topicId: activeDetailItem.topic.id,
        title: resTitle.trim(),
        url: resUrl.trim(),
        resourceType: resType,
        pageReference: resPageRef.trim(),
        notes: resNotes.trim(),
      });
      setResTitle('');
      setResUrl('');
      setResPageRef('');
      setResNotes('');
    } finally {
      setSavingRes(false);
    }
  };

  const [addTopicModalOpen, setAddTopicModalOpen] = useState(false);
  const [addTopicPaperId, setAddTopicPaperId] = useState('');
  const [addTopicSubjectId, setAddTopicSubjectId] = useState('');
  const [newTopicTitle, setNewTopicTitle] = useState('');

  const [addSubjectModalOpen, setAddSubjectModalOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState('#2563EB');

  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renamingTopic, setRenamingTopic] = useState<CurriculumTopic | null>(null);
  const [newCustomTitle, setNewCustomTitle] = useState('');

  // Detailed Modal Form State
  const [detailActivityDate, setDetailActivityDate] = useState('');
  const [detailIsCompleted, setDetailIsCompleted] = useState(true);
  const [detailBookName, setDetailBookName] = useState('');
  const [detailPagesRead, setDetailPagesRead] = useState<number | ''>('');
  const [detailQuestionsSolved, setDetailQuestionsSolved] = useState<number | ''>('');
  const [detailCorrectCount, setDetailCorrectCount] = useState<number | ''>('');
  const [detailNotes, setDetailNotes] = useState('');
  const [isSavingDetail, setIsSavingDetail] = useState(false);

  // Synchronize state immediately whenever context cache updates
  useEffect(() => {
    if (revisionData) {
      setSubjects(revisionData.subjects);
      setPapers(revisionData.papers);
      setTopics(revisionData.topics);
      setCustomizations(revisionData.customizations);
      setRecords(revisionData.records);
      setLoading(false);
    }
  }, [revisionData]);

  // Fetch initial workspace or revalidate quietly in the background
  const loadWorkspace = useCallback(async (force = false) => {
    try {
      if (!revisionData || force) {
        setLoading(true);
      }
      setError(null);
      const data: RevisionWorkspacePayload = await fetchRevisionWorkspace(force);
      setSubjects(data.subjects);
      setPapers(data.papers);
      setTopics(data.topics);
      setCustomizations(data.customizations);
      setRecords(data.records);
    } catch (err: any) {
      console.error('Failed to load revision workspace:', err);
      if (!revisionData) {
        setError(err.message || 'Could not load revision curriculum');
      }
    } finally {
      setLoading(false);
    }
  }, [fetchRevisionWorkspace, revisionData]);

  useEffect(() => {
    loadWorkspace(false);
  }, [loadWorkspace]);

  // Fast record lookup map: key = `${topicId}_${category}`
  const recordMap = useMemo(() => {
    const map = new Map<string, RevisionRecord>();
    for (const r of records) {
      map.set(`${r.topicId}_${r.category}`, r);
    }
    return map;
  }, [records]);

  // Customization map: key = `${targetType}_${targetId}`
  const customizationMap = useMemo(() => {
    const map = new Map<string, UserCurriculumCustomization>();
    for (const c of customizations) {
      map.set(`${c.targetType}_${c.targetId}`, c);
    }
    return map;
  }, [customizations]);

  // Effective topics with user customizations applied
  const effectiveTopics = useMemo(() => {
    return topics.map((t) => {
      const cust = customizationMap.get(`topic_${t.id}`);
      return {
        ...t,
        title: cust?.customTitle || t.title,
        isHidden: cust?.isHidden ?? false,
        displayOrder: cust?.customOrder ?? t.displayOrder,
      };
    });
  }, [topics, customizationMap]);

  // Active / non-hidden topics (or all if showHidden is true)
  const visibleTopics = useMemo(() => {
    return effectiveTopics.filter((t) => showHidden || !t.isHidden);
  }, [effectiveTopics, showHidden]);

  // Fast helper: get completed activities count for a topic (0 to 6)
  const getTopicProgress = useCallback(
    (topicId: string) => {
      let completedCount = 0;
      for (const cat of REVISION_CATEGORIES) {
        const rec = recordMap.get(`${topicId}_${cat.id}`);
        if (rec && rec.isCompleted) {
          completedCount++;
        }
      }
      return completedCount;
    },
    [recordMap]
  );

  // KPI Calculations
  const stats = useMemo(() => {
    const totalPossibleActivities = visibleTopics.length * 6;
    let totalCompleted = 0;
    const categoryCounts: Record<RevisionCategory, number> = {
      class: 0,
      revision_note: 0,
      book_reading: 0,
      mcq_exam: 0,
      cq_solve: 0,
      test_paper_solving: 0,
    };

    let chaptersNotStarted = 0;
    let chaptersInProgress = 0;
    let chaptersCompleted = 0;

    for (const t of visibleTopics) {
      const completed = getTopicProgress(t.id);
      if (completed === 0) chaptersNotStarted++;
      else if (completed === 6) chaptersCompleted++;
      else chaptersInProgress++;

      for (const cat of REVISION_CATEGORIES) {
        const rec = recordMap.get(`${t.id}_${cat.id}`);
        if (rec && rec.isCompleted) {
          totalCompleted++;
          categoryCounts[cat.id]++;
        }
      }
    }

    const pendingActivities = Math.max(0, totalPossibleActivities - totalCompleted);
    const overallPercentage =
      totalPossibleActivities > 0
        ? Math.round((totalCompleted / totalPossibleActivities) * 100)
        : 0;

    return {
      totalPossibleActivities,
      totalCompleted,
      pendingActivities,
      overallPercentage,
      categoryCounts,
      chaptersNotStarted,
      chaptersInProgress,
      chaptersCompleted,
      totalChapters: visibleTopics.length,
    };
  }, [visibleTopics, recordMap, getTopicProgress]);

  // Subject-wise stats
  const subjectStats = useMemo(() => {
    return subjects.map((subj) => {
      const subjTopics = visibleTopics.filter((t) => t.subjectId === subj.id);
      const totalPossible = subjTopics.length * 6;
      let completedCount = 0;
      let completedChapters = 0;

      for (const t of subjTopics) {
        const prog = getTopicProgress(t.id);
        completedCount += prog;
        if (prog === 6) completedChapters++;
      }

      const percentage =
        totalPossible > 0 ? Math.round((completedCount / totalPossible) * 100) : 0;

      return {
        subject: subj,
        topicCount: subjTopics.length,
        completedCount,
        totalPossible,
        completedChapters,
        percentage,
      };
    });
  }, [subjects, visibleTopics, getTopicProgress]);

  // Filtered topics for the matrix view
  const filteredTopics = useMemo(() => {
    return visibleTopics.filter((t) => {
      if (selectedSubjectId !== 'all' && t.subjectId !== selectedSubjectId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!t.title.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (statusFilter !== 'all') {
        const completed = getTopicProgress(t.id);
        if (statusFilter === 'not_started' && completed !== 0) return false;
        if (statusFilter === 'in_progress' && (completed === 0 || completed === 6))
          return false;
        if (statusFilter === 'completed' && completed !== 6) return false;
      }
      return true;
    });
  }, [visibleTopics, selectedSubjectId, searchQuery, statusFilter, getTopicProgress]);

  // Group filtered topics by Subject -> Paper
  const groupedCurriculum = useMemo(() => {
    const topicPaperMap = new Map<string, CurriculumTopic[]>();
    for (const t of filteredTopics) {
      const list = topicPaperMap.get(t.paperId) || [];
      list.push(t);
      topicPaperMap.set(t.paperId, list);
    }

    const subjs = subjects.filter(
      (s) => selectedSubjectId === 'all' || s.id === selectedSubjectId
    );

    return subjs
      .map((subj) => {
        const subjPapers = papers
          .filter((p) => p.subjectId === subj.id)
          .map((paper) => ({
            paper,
            topics: (topicPaperMap.get(paper.id) || []).sort(
              (a, b) => a.displayOrder - b.displayOrder
            ),
          }))
          .filter((grp) => grp.topics.length > 0);

        return {
          subject: subj,
          paperGroups: subjPapers,
        };
      })
      .filter((grp) => grp.paperGroups.length > 0);
  }, [filteredTopics, subjects, papers, selectedSubjectId]);

  // Checkbox Click Handler: Instant Optimistic Toggle + DB Update
  const handleToggleCheckbox = async (
    subjectId: string,
    topicId: string,
    category: RevisionCategory
  ) => {
    const existing = recordMap.get(`${topicId}_${category}`);
    const nextCompleted = existing ? !existing.isCompleted : true;
    const nowYmd = new Date().toISOString().slice(0, 10);

    // Optimistic UI update
    setRecords((prev) => {
      const filtered = prev.filter(
        (r) => !(r.topicId === topicId && r.category === category)
      );
      const updatedRecord: RevisionRecord = {
        id: existing?.id || `temp_${Date.now()}`,
        userId: 'current',
        subjectId,
        topicId,
        category,
        activityDate: existing?.activityDate || nowYmd,
        isCompleted: nextCompleted,
        bookName: existing?.bookName,
        pagesRead: existing?.pagesRead,
        questionsSolved: existing?.questionsSolved,
        correctCount: existing?.correctCount,
        notes: existing?.notes,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return [...filtered, updatedRecord];
    });

    try {
      const serverRecord = await toggleRevisionActivity({
        subjectId,
        topicId,
        category,
        isCompleted: nextCompleted,
        activityDate: nowYmd,
      });

      // Replace optimistic record with server record
      setRecords((prev) =>
        prev.map((r) =>
          r.topicId === topicId && r.category === category ? serverRecord : r
        )
      );
    } catch (err: any) {
      console.error('Failed to toggle revision checkbox:', err);
      loadWorkspace();
      addToast({
        title: 'Sync Error',
        description: err.message || 'Could not save checkbox state',
        variant: 'error',
      });
    }
  };

  // Open Details Modal
  const openDetailModal = (
    subj: CurriculumSubject,
    topic: CurriculumTopic,
    category: RevisionCategory
  ) => {
    const rec = recordMap.get(`${topic.id}_${category}`);
    setActiveDetailItem({
      subject: subj,
      topic,
      category,
      record: rec,
    });

    setDetailActivityDate(
      rec?.activityDate || new Date().toISOString().slice(0, 10)
    );
    setDetailIsCompleted(rec ? rec.isCompleted : true);
    setDetailBookName(rec?.bookName || '');
    setDetailPagesRead(rec?.pagesRead ?? '');
    setDetailQuestionsSolved(rec?.questionsSolved ?? '');
    setDetailCorrectCount(rec?.correctCount ?? '');
    setDetailNotes(rec?.notes || '');
    setDetailModalOpen(true);
  };

  // Save Detailed Modal
  const handleSaveDetailModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDetailItem) return;

    try {
      setIsSavingDetail(true);
      const serverRecord = await saveDetailedRevision({
        id: activeDetailItem.record?.id,
        subjectId: activeDetailItem.subject.id,
        topicId: activeDetailItem.topic.id,
        category: activeDetailItem.category,
        isCompleted: detailIsCompleted,
        activityDate: detailActivityDate,
        bookName: detailBookName.trim() || undefined,
        pagesRead:
          detailPagesRead !== '' ? Number(detailPagesRead) : undefined,
        questionsSolved:
          detailQuestionsSolved !== ''
            ? Number(detailQuestionsSolved)
            : undefined,
        correctCount:
          detailCorrectCount !== '' ? Number(detailCorrectCount) : undefined,
        notes: detailNotes.trim() || undefined,
      });

      setRecords((prev) => {
        const filtered = prev.filter(
          (r) =>
            !(
              r.topicId === activeDetailItem.topic.id &&
              r.category === activeDetailItem.category
            )
        );
        return [...filtered, serverRecord];
      });

      setDetailModalOpen(false);
      setActiveDetailItem(null);
    } catch (err: any) {
      console.error('Error saving revision details:', err);
      addToast({
        title: 'Error',
        description: err.message || 'Failed to save revision details',
        variant: 'error',
      });
    } finally {
      setIsSavingDetail(false);
    }
  };

  // Reset / Delete record
  const handleDeleteRecord = async () => {
    if (!activeDetailItem?.record) return;
    if (
      !window.confirm(
        'Are you sure you want to reset this activity record? This will uncheck the box and clear logged notes.'
      )
    ) {
      return;
    }

    try {
      await deleteRevisionRecordItem(activeDetailItem.record.id);
      setRecords((prev) =>
        prev.filter((r) => r.id !== activeDetailItem.record!.id)
      );
      setDetailModalOpen(false);
      setActiveDetailItem(null);
    } catch (err: any) {
      console.error('Error deleting record:', err);
      addToast({
        title: 'Error',
        description: err.message || 'Failed to reset record',
        variant: 'error',
      });
    }
  };

  // Add Custom Topic Handler
  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicTitle.trim() || !addTopicPaperId || !addTopicSubjectId) return;

    try {
      const topic = await addCustomCurriculumTopicItem({
        paperId: addTopicPaperId,
        subjectId: addTopicSubjectId,
        title: newTopicTitle.trim(),
      });
      setTopics((prev) => [...prev, topic]);
      setAddTopicModalOpen(false);
      setNewTopicTitle('');
    } catch (err: any) {
      console.error('Failed to add topic:', err);
      addToast({
        title: 'Error',
        description: err.message || 'Failed to create chapter',
        variant: 'error',
      });
    }
  };

  // Add Custom Subject Handler
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;

    try {
      const { subject, paper } = await addCustomCurriculumSubjectItem({
        name: newSubjectName.trim(),
        color: newSubjectColor,
      });
      setSubjects((prev) => [...prev, subject]);
      setPapers((prev) => [...prev, paper]);
      setAddSubjectModalOpen(false);
      setNewSubjectName('');
    } catch (err: any) {
      console.error('Failed to add subject:', err);
      addToast({
        title: 'Error',
        description: err.message || 'Failed to create subject',
        variant: 'error',
      });
    }
  };

  // Toggle Hide Topic Handler
  const handleToggleHideTopic = async (topic: CurriculumTopic) => {
    const nextHidden = !topic.isHidden;
    try {
      await updateCurriculumCustomizationItem({
        targetType: 'topic',
        targetId: topic.id,
        isHidden: nextHidden,
      });

      setCustomizations((prev) => {
        const filtered = prev.filter(
          (c) => !(c.targetType === 'topic' && c.targetId === topic.id)
        );
        return [
          ...filtered,
          {
            id: `cust_${Date.now()}`,
            userId: 'current',
            targetType: 'topic',
            targetId: topic.id,
            isHidden: nextHidden,
            customTitle: topic.title,
            customOrder: topic.displayOrder,
          },
        ];
      });

      addToast({
        title: nextHidden ? 'Chapter Hidden' : 'Chapter Restored',
        description: `"${topic.title}" was ${nextHidden ? 'hidden from matrix' : 'restored'}.`,
        variant: 'default',
      });
    } catch (err: any) {
      console.error('Failed to customize topic visibility:', err);
      addToast({
        title: 'Error',
        description: 'Failed to update chapter visibility',
        variant: 'error',
      });
    }
  };

  // Rename Topic Handler
  const handleRenameTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingTopic || !newCustomTitle.trim()) return;

    try {
      await updateCurriculumCustomizationItem({
        targetType: 'topic',
        targetId: renamingTopic.id,
        customTitle: newCustomTitle.trim(),
      });

      setCustomizations((prev) => {
        const filtered = prev.filter(
          (c) => !(c.targetType === 'topic' && c.targetId === renamingTopic.id)
        );
        return [
          ...filtered,
          {
            id: `cust_${Date.now()}`,
            userId: 'current',
            targetType: 'topic',
            targetId: renamingTopic.id,
            isHidden: renamingTopic.isHidden ?? false,
            customTitle: newCustomTitle.trim(),
            customOrder: renamingTopic.displayOrder,
          },
        ];
      });

      setRenameModalOpen(false);
      setRenamingTopic(null);
      setNewCustomTitle('');
      addToast({
        title: 'Chapter Renamed',
        description: 'Updated chapter title successfully.',
        variant: 'success',
      });
    } catch (err: any) {
      console.error('Failed to rename chapter:', err);
      addToast({
        title: 'Error',
        description: 'Failed to rename chapter',
        variant: 'error',
      });
    }
  };

  // Recent history records (completed or updated recently)
  const recentHistory = useMemo(() => {
    const topicMap = new Map<string, CurriculumTopic>(
      effectiveTopics.map((t) => [t.id, t])
    );
    const subjMap = new Map<string, CurriculumSubject>(
      subjects.map((s) => [s.id, s])
    );

    return [...records]
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      .slice(0, 30)
      .map((r) => ({
        ...r,
        topic: topicMap.get(r.topicId),
        subject: subjMap.get(r.subjectId),
        categoryMeta: REVISION_CATEGORIES.find((c) => c.id === r.category),
      }));
  }, [records, effectiveTopics, subjects]);

  if (loading && subjects.length === 0) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-64 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl" />
          <div className="h-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl" />
          <div className="h-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl" />
        </div>
        <div className="h-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl" />
      </div>
    );
  }

  if (error && subjects.length === 0) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
        <h3 className="font-display font-bold text-slate-900 dark:text-white">
          Could Not Load Revision Tracker
        </h3>
        <p className="text-xs text-slate-500">{error}</p>
        <button
          type="button"
          onClick={() => loadWorkspace(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <BookOpenCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Revision Tracker
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Interactive Chapter Checklist Matrix • 6 Essential Milestones • Real PostgreSQL Cloud Sync
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Switcher + Add Custom Subject */}
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-center text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ListTodo className="w-3.5 h-3.5" />
              <span>Checklist Matrix</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('records')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'records'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('analytics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'analytics'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analytics</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setAddSubjectModalOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Subject</span>
          </button>
        </div>
      </div>

      {/* 2. Top KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Total Revision Activities Completed */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Completed Activities
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Check className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {stats.totalCompleted}
            </span>
            <span className="text-xs text-slate-400 tabular-nums">
              / {stats.totalPossibleActivities} total milestones
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mb-1.5">
              <span>Overall Completion</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {stats.overallPercentage}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${stats.overallPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Category Breakdown in Strict Order */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Category Breakdown (6 Stages)
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800">
              6 Categories
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {REVISION_CATEGORIES.map((cat) => {
              const count = stats.categoryCounts[cat.id];
              return (
                <div
                  key={cat.id}
                  className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-center"
                >
                  <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate" title={cat.label}>
                    {cat.shortLabel}
                  </p>
                  <p className="font-display font-bold text-sm text-slate-900 dark:text-white tabular-nums mt-0.5">
                    {count}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 3: Pending Activities & Chapter Completion Status */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Pending & Progress
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
              {stats.pendingActivities}
            </span>
            <span className="text-xs text-slate-400">activities pending</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[10px]">
            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <p className="font-bold tabular-nums">{stats.chaptersCompleted}</p>
              <p className="text-[9px] text-slate-400">Done (6/6)</p>
            </div>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/40 dark:border-blue-800/40">
              <p className="font-bold tabular-nums">{stats.chaptersInProgress}</p>
              <p className="text-[9px]">In Progress</p>
            </div>
            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500">
              <p className="font-bold tabular-nums">{stats.chaptersNotStarted}</p>
              <p className="text-[9px] text-slate-400">Not Started</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Subject-Wise Progress Pills */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Subject Progress
          </h3>
          <span className="text-[11px] text-slate-400">
            {stats.totalChapters} Active Chapters Across {subjects.length} Subjects
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {subjectStats.map((st) => {
            const isSelected = selectedSubjectId === st.subject.id;
            return (
              <button
                key={st.subject.id}
                type="button"
                onClick={() =>
                  setSelectedSubjectId(isSelected ? 'all' : st.subject.id)
                }
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/50 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: st.subject.color }}
                  />
                  <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-white tabular-nums">
                    {st.percentage}%
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {st.subject.name}
                </p>
                <div className="mt-1.5 w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${st.percentage}%`,
                      backgroundColor: st.subject.color,
                    }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 tabular-nums truncate">
                  {st.completedChapters}/{st.topicCount} chapters done
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* VIEW MODE 1: Interactive Chapter Checklist Matrix */}
      {viewMode === 'matrix' && (
        <div className="space-y-4">
          {/* Controls & Filter Bar */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chapter or topic (e.g., ভৌত জগৎ, Unit 1)..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {/* Subject Select */}
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                <option value="all">All Subjects ({subjects.length})</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {/* Status Select */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="not_started">Not Started (0/6)</option>
                <option value="in_progress">In Progress (1–5/6)</option>
                <option value="completed">Completed (6/6)</option>
              </select>

              {/* Toggle Hidden Items */}
              <button
                type="button"
                onClick={() => setShowHidden(!showHidden)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                  showHidden
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Toggle visibility of hidden custom chapters"
              >
                {showHidden ? (
                  <Eye className="w-3.5 h-3.5" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5" />
                )}
                <span>{showHidden ? 'Showing Hidden' : 'Hide Inactive'}</span>
              </button>
            </div>
          </div>

          {/* Checklist Matrix Tables (Grouped by Subject & Paper) */}
          {groupedCurriculum.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
              <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No chapters matched your filter criteria
              </p>
              <p className="text-xs text-slate-400">
                Try clearing your search query or selecting "All Subjects".
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedSubjectId('all');
                  setStatusFilter('all');
                }}
                className="mt-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            groupedCurriculum.map((group) => (
              <div
                key={group.subject.id}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden"
              >
                {/* Subject Header */}
                <div
                  className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50"
                  style={{ borderLeft: `5px solid ${group.subject.color}` }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: group.subject.color }}
                    />
                    <h2 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      {group.subject.name}
                    </h2>
                  </div>

                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {group.paperGroups.reduce((acc, p) => acc + p.topics.length, 0)} Chapters
                  </span>
                </div>

                {/* Iterate over Paper Groups (1st Paper, 2nd Paper, etc.) */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {group.paperGroups.map(({ paper, topics }) => (
                    <div key={paper.id} className="p-3 sm:p-4 space-y-2.5">
                      {/* Paper Section Subheader */}
                      <div className="flex items-center justify-between pb-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            {paper.title}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            ({topics.length} items)
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setAddTopicPaperId(paper.id);
                            setAddTopicSubjectId(group.subject.id);
                            setAddTopicModalOpen(true);
                          }}
                          className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Topic</span>
                        </button>
                      </div>

                      {/* Interactive 6-Column Matrix Table with Sticky Chapter Title */}
                      <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                        <table className="w-full text-left text-xs border-collapse min-w-[760px]">
                          <thead>
                            <tr className="bg-slate-100/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                              <th className="py-2.5 px-3 sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 w-[240px] sm:w-[320px] shadow-sm">
                                Chapter / Topic
                              </th>
                              <th className="py-2.5 px-2 text-center w-[60px]">
                                Status
                              </th>
                              {/* Exact 6 Checkbox Columns in Exact Order */}
                              {REVISION_CATEGORIES.map((cat) => (
                                <th
                                  key={cat.id}
                                  className="py-2.5 px-2 text-center w-[95px]"
                                  title={cat.description}
                                >
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                                      {cat.shortLabel}
                                    </span>
                                  </div>
                                </th>
                              ))}
                              <th className="py-2.5 px-2 text-center w-[50px]">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
                            {topics.map((topic) => {
                              const completedCount = getTopicProgress(topic.id);
                              const isCompletedAll = completedCount === 6;

                              return (
                                <tr
                                  key={topic.id}
                                  className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                                    topic.isHidden ? 'opacity-50 bg-slate-50 dark:bg-slate-950' : ''
                                  }`}
                                >
                                  {/* Sticky Chapter Name Column */}
                                  <td className="py-2.5 px-3 sticky left-0 bg-white dark:bg-slate-900 z-10 shadow-sm border-r border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center justify-between gap-2">
                                      <span
                                        className="font-medium text-slate-900 dark:text-white line-clamp-2 leading-snug"
                                        title={topic.title}
                                      >
                                        {topic.title}
                                      </span>
                                    </div>
                                  </td>

                                  {/* Overall Chapter Progress Indicator (0/6 to 6/6) */}
                                  <td className="py-2.5 px-2 text-center">
                                    <span
                                      className={`inline-block px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold tabular-nums ${
                                        isCompletedAll
                                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                          : completedCount > 0
                                          ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                      }`}
                                    >
                                      {completedCount}/6
                                    </span>
                                  </td>

                                  {/* Exact 6 Checkboxes in strict left-to-right column order */}
                                  {REVISION_CATEGORIES.map((cat) => {
                                    const rec = recordMap.get(
                                      `${topic.id}_${cat.id}`
                                    );
                                    const isChecked = Boolean(
                                      rec && rec.isCompleted
                                    );
                                    const hasNotesOrScore = Boolean(
                                      rec?.notes ||
                                        rec?.bookName ||
                                        rec?.pagesRead ||
                                        rec?.questionsSolved
                                    );

                                    return (
                                      <td
                                        key={cat.id}
                                        className="py-2.5 px-2 text-center"
                                      >
                                        <div className="flex items-center justify-center gap-1">
                                          {/* Checkbox button */}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleToggleCheckbox(
                                                group.subject.id,
                                                topic.id,
                                                cat.id
                                              )
                                            }
                                            title={`${cat.label} for "${topic.title}": Click to ${isChecked ? 'unmark' : 'complete'}`}
                                            className={`w-6 h-6 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                                              isChecked
                                                ? 'bg-blue-600 text-white shadow-xs hover:bg-blue-700 ring-2 ring-blue-500/20'
                                                : 'border-2 border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 bg-white dark:bg-slate-900'
                                            }`}
                                          >
                                            {isChecked && (
                                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                                            )}
                                          </button>

                                          {/* Quick detail indicator / open modal */}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              openDetailModal(
                                                group.subject,
                                                topic,
                                                cat.id
                                              )
                                            }
                                            title={`Edit details, notes, or score for ${cat.label}`}
                                            className={`p-1 rounded-md text-[10px] transition-colors cursor-pointer ${
                                              hasNotesOrScore
                                                ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 font-bold'
                                                : 'text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                            }`}
                                          >
                                            <Edit3 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </td>
                                    );
                                  })}

                                  {/* Row Actions (Hide / Rename) */}
                                  <td className="py-2.5 px-2 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRenamingTopic(topic);
                                          setNewCustomTitle(topic.title);
                                          setRenameModalOpen(true);
                                        }}
                                        title="Rename Chapter"
                                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleHideTopic(topic)}
                                        title={
                                          topic.isHidden
                                            ? 'Unhide Chapter'
                                            : 'Hide Chapter from matrix'
                                        }
                                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                                      >
                                        {topic.isHidden ? (
                                          <Eye className="w-3 h-3 text-blue-500" />
                                        ) : (
                                          <EyeOff className="w-3 h-3" />
                                        )}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* VIEW MODE 2: Recent History & Records Management */}
      {viewMode === 'records' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Recent Revision Activity Feed
              </h2>
              <p className="text-xs text-slate-500">
                Log of activities completed, pages read, scores, and revision notes
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              {records.length} Total Records
            </span>
          </div>

          {recentHistory.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 space-y-2">
              <History className="w-8 h-8 mx-auto text-slate-300" />
              <p>No revision activities logged yet.</p>
              <p>Tick any checkbox in the Checklist Matrix to record your first milestone!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Subject</th>
                    <th className="py-2.5 px-4">Chapter / Topic</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4">Details / Score</th>
                    <th className="py-2.5 px-4">Notes</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentHistory.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 tabular-nums">
                        {item.activityDate ||
                          (typeof item.updatedAt === 'string'
                            ? item.updatedAt.slice(0, 10)
                            : new Date(item.updatedAt).toISOString().slice(0, 10))}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold text-white truncate max-w-[120px]"
                          style={{
                            backgroundColor: item.subject?.color || '#2563EB',
                          }}
                        >
                          {item.subject?.name || 'Subject'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white max-w-[200px] truncate">
                        {item.topic?.title || 'Unknown Topic'}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {item.categoryMeta?.label || item.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-[11px] text-slate-600 dark:text-slate-300">
                        {item.bookName && <span>Book: {item.bookName} • </span>}
                        {item.pagesRead && <span>{item.pagesRead} pages • </span>}
                        {item.questionsSolved && (
                          <span>
                            {item.correctCount ?? item.questionsSolved}/
                            {item.questionsSolved} questions
                          </span>
                        )}
                        {!item.bookName &&
                          !item.pagesRead &&
                          !item.questionsSolved && (
                            <span className="text-slate-400">Completed</span>
                          )}
                      </td>
                      <td className="py-2.5 px-4 max-w-[200px] truncate text-slate-500 text-[11px]">
                        {item.notes || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (item.subject && item.topic) {
                              openDetailModal(
                                item.subject,
                                item.topic,
                                item.category
                              );
                            }
                          }}
                          className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold text-[10px] cursor-pointer"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 3: Revision Analytics */}
      {viewMode === 'analytics' && (
        <div className="space-y-6">
          {/* Top Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Subject Completion Chart */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    Revision Progress by Subject
                  </h3>
                  <p className="text-xs text-slate-500">
                    Calculated from all active chapters across all 6 categories
                  </p>
                </div>
                <Percent className="w-4 h-4 text-slate-400" />
              </div>

              <div className="space-y-3">
                {subjectStats.map((st) => (
                  <div key={st.subject.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {st.subject.name}
                      </span>
                      <span className="font-mono font-bold text-slate-600 dark:text-slate-400 tabular-nums">
                        {st.completedCount} / {st.totalPossible} ({st.percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${st.percentage}%`,
                          backgroundColor: st.subject.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Category Completion Distribution */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    Progress by Category (Exact 6 Order)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Distribution of completed study milestones
                  </p>
                </div>
                <TrendingUp className="w-4 h-4 text-slate-400" />
              </div>

              <div className="space-y-3">
                {REVISION_CATEGORIES.map((cat) => {
                  const count = stats.categoryCounts[cat.id];
                  const total = stats.totalChapters || 1;
                  const pct = Math.round((count / total) * 100);
                  const Icon = CATEGORY_ICONS[cat.id];

                  return (
                    <div key={cat.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5 text-blue-500" />
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {cat.label}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-slate-600 dark:text-slate-400 tabular-nums">
                          {count} / {total} chapters ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: cat.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Activity Detail / Edit Modal */}
      {detailModalOpen && activeDetailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  {activeDetailItem.subject.name}
                </span>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  {activeDetailItem.topic.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Category: <span className="font-semibold text-slate-700 dark:text-slate-300">{REVISION_CATEGORIES.find((c) => c.id === activeDetailItem.category)?.label}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs: Activity Log vs Chapter Resources */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setDetailTab('log')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  detailTab === 'log'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Activity Details
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('resources')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  detailTab === 'resources'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5 text-blue-500" />
                <span>Chapter Resources ({topicResources.length})</span>
              </button>
            </div>

            {detailTab === 'resources' ? (
              <div className="space-y-4 text-xs">
                {/* Existing Resources for this Topic */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Attached Chapter Bookmarks & Links
                  </h4>
                  {topicResources.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400">
                      No bookmarks saved yet. Add YouTube playlists, Drive PDFs, or book pages below.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {topicResources.map((res) => (
                        <div
                          key={res.id}
                          className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {res.resourceType === 'youtube' && <Video className="w-4 h-4 text-red-500 shrink-0" />}
                              {res.resourceType === 'drive' && <Bookmark className="w-4 h-4 text-amber-500 shrink-0" />}
                              {res.resourceType === 'pdf' && <FileText className="w-4 h-4 text-rose-500 shrink-0" />}
                              {res.resourceType === 'book_ref' && <BookOpen className="w-4 h-4 text-emerald-500 shrink-0" />}
                              {res.resourceType === 'link' && <LinkIcon className="w-4 h-4 text-blue-500 shrink-0" />}
                              <span className="truncate">{res.title}</span>
                            </div>
                            {res.pageReference && (
                              <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                                Ref: {res.pageReference}
                              </p>
                            )}
                            {res.notes && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {res.notes}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <a
                              href={res.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 transition-colors"
                              title="Open Resource Link"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => deleteResource(res.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                              title="Delete Link"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add Resource Form */}
                <form onSubmit={handleSaveResource} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
                  <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Add New Resource or Bookmark
                  </h5>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Resource Title
                      </label>
                      <input
                        type="text"
                        value={resTitle}
                        onChange={(e) => setResTitle(e.target.value)}
                        placeholder="e.g. YouTube Playlist, Lecture PDF"
                        required
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Resource Type
                      </label>
                      <select
                        value={resType}
                        onChange={(e) => setResType(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                      >
                        <option value="youtube">YouTube Video / Playlist</option>
                        <option value="drive">Google Drive Link</option>
                        <option value="pdf">PDF Document / Note</option>
                        <option value="book_ref">Textbook Page Reference</option>
                        <option value="link">Web Resource / Article</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      URL Link
                    </label>
                    <input
                      type="url"
                      value={resUrl}
                      onChange={(e) => setResUrl(e.target.value)}
                      placeholder="https://..."
                      required
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Page Reference (Optional)
                      </label>
                      <input
                        type="text"
                        value={resPageRef}
                        onChange={(e) => setResPageRef(e.target.value)}
                        placeholder="e.g. Page 120-145"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Notes (Optional)
                      </label>
                      <input
                        type="text"
                        value={resNotes}
                        onChange={(e) => setResNotes(e.target.value)}
                        placeholder="e.g. Best lecture for CQ solving"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={savingRes}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors"
                  >
                    {savingRes ? 'Saving Link...' : 'Save Chapter Bookmark'}
                  </button>
                </form>
              </div>
            ) : (
              <form onSubmit={handleSaveDetailModal} className="space-y-3.5 text-xs">
                {/* Completed Status Checkbox */}
                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={detailIsCompleted}
                    onChange={(e) => setDetailIsCompleted(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Mark this category activity as completed
                  </span>
                </label>

                {/* Activity Date */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Activity Date
                  </label>
                  <input
                    type="date"
                    value={detailActivityDate}
                    onChange={(e) => setDetailActivityDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-mono text-xs text-slate-900 dark:text-white"
                  />
                </div>

                {/* Category-Specific Detailed Fields */}
                {activeDetailItem.category === 'book_reading' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Book / Reference Name
                      </label>
                      <input
                        type="text"
                        value={detailBookName}
                        onChange={(e) => setDetailBookName(e.target.value)}
                        placeholder="e.g. হাজারী ও নাগ, সেলিনা হোসেন"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Pages Read
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={detailPagesRead}
                        onChange={(e) =>
                          setDetailPagesRead(
                            e.target.value === '' ? '' : Number(e.target.value)
                          )
                        }
                        placeholder="e.g. 24"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white tabular-nums"
                      />
                    </div>
                  </div>
                )}

                {activeDetailItem.category === 'mcq_exam' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Total MCQ Questions
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={detailQuestionsSolved}
                        onChange={(e) =>
                          setDetailQuestionsSolved(
                            e.target.value === '' ? '' : Number(e.target.value)
                          )
                        }
                        placeholder="e.g. 30"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Correct Answers
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={detailCorrectCount}
                        onChange={(e) =>
                          setDetailCorrectCount(
                            e.target.value === '' ? '' : Number(e.target.value)
                          )
                        }
                        placeholder="e.g. 27"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white tabular-nums"
                      />
                    </div>
                  </div>
                )}

                {activeDetailItem.category === 'cq_solve' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        CQ Questions Attempted
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={detailQuestionsSolved}
                        onChange={(e) =>
                          setDetailQuestionsSolved(
                            e.target.value === '' ? '' : Number(e.target.value)
                          )
                        }
                        placeholder="e.g. 8"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Correctly Solved
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={detailCorrectCount}
                        onChange={(e) =>
                          setDetailCorrectCount(
                            e.target.value === '' ? '' : Number(e.target.value)
                          )
                        }
                        placeholder="e.g. 7"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white tabular-nums"
                      />
                    </div>
                  </div>
                )}

                {activeDetailItem.category === 'test_paper_solving' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Questions / Sets Solved (On your own)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={detailQuestionsSolved}
                      onChange={(e) =>
                        setDetailQuestionsSolved(
                          e.target.value === '' ? '' : Number(e.target.value)
                        )
                      }
                      placeholder="e.g. 5 board sets"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white tabular-nums"
                    />
                  </div>
                )}

                {/* Revision Notes with KaTeX Preview */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Notes & Key Takeaways
                    </label>
                    <span className="text-[10px] text-slate-400">Math KaTeX supported e.g. $E = mc^2$</span>
                  </div>
                  <textarea
                    rows={3}
                    value={detailNotes}
                    onChange={(e) => setDetailNotes(e.target.value)}
                    placeholder="Formulas revised, tricky concepts, questions that need re-practice..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-mono"
                  />
                  {detailNotes && (
                    <div className="mt-1 p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block mb-0.5">Formula Preview:</span>
                      <MathRenderer content={detailNotes} />
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2">
                  {activeDetailItem.record ? (
                    <button
                      type="button"
                      onClick={handleDeleteRecord}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 font-semibold text-xs cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Reset Record</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailModalOpen(false)}
                      className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingDetail}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer disabled:opacity-50"
                    >
                      {isSavingDetail ? 'Saving...' : 'Save Activity'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: Add Custom Topic Modal */}
      {addTopicModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Add Custom Chapter / Topic
              </h3>
              <button
                type="button"
                onClick={() => setAddTopicModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTopic} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Chapter Title
                </label>
                <input
                  type="text"
                  required
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  placeholder="e.g. স্পেশাল মডেল টেস্ট রিভিশন, শর্ট সিলেবাস টপিক"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddTopicModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-600 text-white font-semibold cursor-pointer"
                >
                  Add Chapter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Add Custom Subject Modal */}
      {addSubjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Add Custom Academic Subject
              </h3>
              <button
                type="button"
                onClick={() => setAddSubjectModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubject} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Subject Name
                </label>
                <input
                  type="text"
                  required
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  placeholder="e.g. পরিসংখ্যান (Statistics), সমাজবিজ্ঞান"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Accent Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newSubjectColor}
                    onChange={(e) => setNewSubjectColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border cursor-pointer"
                  />
                  <span className="font-mono text-xs">{newSubjectColor}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddSubjectModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-600 text-white font-semibold cursor-pointer"
                >
                  Create Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Rename Topic Modal */}
      {renameModalOpen && renamingTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Rename Chapter
              </h3>
              <button
                type="button"
                onClick={() => setRenameModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenameTopic} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Custom Chapter Title
                </label>
                <input
                  type="text"
                  required
                  value={newCustomTitle}
                  onChange={(e) => setNewCustomTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRenameModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-600 text-white font-semibold cursor-pointer"
                >
                  Save Title
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
