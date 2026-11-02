'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  BookOpen,
  Edit,
  FileText,
  Filter,
  Layers,
  ListPlus,
  Plus,
  RefreshCw,
  Search,
  Trash2,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getAdminSubjectsAction,
  saveAdminSubjectAction,
  deleteAdminSubjectAction,
  getAdminPapersAction,
  saveAdminPaperAction,
  deleteAdminPaperAction,
  getAdminTopicsAction,
  saveAdminTopicAction,
  deleteAdminTopicAction,
} from '@/actions/admin';
import type { CurriculumSubject, CurriculumPaper, CurriculumTopic } from '@/types/index';

export function AdminSubjectsView() {
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [papers, setPapers] = useState<CurriculumPaper[]>([]);
  const [topics, setTopics] = useState<CurriculumTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'subjects' | 'papers' | 'topics'>('subjects');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog State: Subject
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<CurriculumSubject | null>(null);
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectColor, setSubjectColor] = useState('#2563EB');
  const [subjectIcon, setSubjectIcon] = useState('BookOpen');
  const [subjectOrder, setSubjectOrder] = useState<number>(0);
  const [subjectDescription, setSubjectDescription] = useState('');
  const [subjectFormError, setSubjectFormError] = useState<string | null>(null);
  const [isSavingSubject, setIsSavingSubject] = useState(false);

  // Dialog State: Paper
  const [paperDialogOpen, setPaperDialogOpen] = useState(false);
  const [editingPaper, setEditingPaper] = useState<CurriculumPaper | null>(null);
  const [paperSubjectId, setPaperSubjectId] = useState('');
  const [paperTitle, setPaperTitle] = useState('');
  const [paperCode, setPaperCode] = useState('');
  const [paperOrder, setPaperOrder] = useState<number>(0);
  const [isSavingPaper, setIsSavingPaper] = useState(false);

  // Dialog State: Topic
  const [topicDialogOpen, setTopicDialogOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<CurriculumTopic | null>(null);
  const [topicSubjectId, setTopicSubjectId] = useState('');
  const [topicPaperId, setTopicPaperId] = useState('');
  const [topicTitle, setTopicTitle] = useState('');
  const [topicChapterNumber, setTopicChapterNumber] = useState<number>(1);
  const [topicOrder, setTopicOrder] = useState<number>(0);
  const [isSavingTopic, setIsSavingTopic] = useState(false);

  // Delete Alert State
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'subject' | 'paper' | 'topic';
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [subsRes, papsRes, topsRes] = await Promise.all([
        getAdminSubjectsAction(),
        getAdminPapersAction(),
        getAdminTopicsAction(),
      ]);
      if (subsRes.success) setSubjects(subsRes.subjects);
      if (papsRes.success) setPapers(papsRes.papers);
      if (topsRes.success) setTopics(topsRes.topics);
    } catch (err) {
      console.error('Failed to load curriculum entities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered lists
  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return subjects;
    const q = searchQuery.toLowerCase();
    return subjects.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.code && s.code.toLowerCase().includes(q))
    );
  }, [subjects, searchQuery]);

  const filteredPapers = useMemo(() => {
    if (!searchQuery.trim()) return papers;
    const q = searchQuery.toLowerCase();
    return papers.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.paperCode && p.paperCode.toLowerCase().includes(q))
    );
  }, [papers, searchQuery]);

  const filteredTopics = useMemo(() => {
    if (!searchQuery.trim()) return topics;
    const q = searchQuery.toLowerCase();
    return topics.filter((t) => t.title.toLowerCase().includes(q));
  }, [topics, searchQuery]);

  // Subject Form Handlers
  const openNewSubjectDialog = () => {
    setEditingSubject(null);
    setSubjectName('');
    setSubjectCode('');
    setSubjectColor('#2563EB');
    setSubjectIcon('BookOpen');
    setSubjectOrder(subjects.length);
    setSubjectDescription('');
    setSubjectFormError(null);
    setSubjectDialogOpen(true);
  };

  const openEditSubjectDialog = (sub: CurriculumSubject) => {
    setEditingSubject(sub);
    setSubjectName(sub.name);
    setSubjectCode(sub.code || '');
    setSubjectColor(sub.color || '#2563EB');
    setSubjectIcon(sub.icon || 'BookOpen');
    setSubjectOrder(sub.displayOrder || 0);
    setSubjectDescription('');
    setSubjectFormError(null);
    setSubjectDialogOpen(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingSubject) return; // Prevent rapid duplicate calls

    const cleanName = subjectName.trim();
    if (!cleanName) {
      setSubjectFormError('Subject name is required');
      return;
    }

    // Validate color HEX format loosely or fall back
    const validColor = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(subjectColor)
      ? subjectColor
      : '#2563EB';

    setIsSavingSubject(true);
    setSubjectFormError(null);

    try {
      const res = await saveAdminSubjectAction({
        id: editingSubject?.id,
        name: cleanName,
        code: subjectCode.trim() || undefined,
        color: validColor,
        icon: subjectIcon || 'BookOpen',
        displayOrder: Number(subjectOrder) || 0,
      });

      if (res.success) {
        setSubjectDialogOpen(false);
        await loadData();
      }
    } catch (err: any) {
      console.error('Failed to save subject:', err);
      setSubjectFormError(err.message || 'Error saving subject');
    } finally {
      setIsSavingSubject(false);
    }
  };

  // Paper Form Handlers
  const openNewPaperDialog = () => {
    setEditingPaper(null);
    setPaperSubjectId(subjects[0]?.id || '');
    setPaperTitle('');
    setPaperCode('');
    setPaperOrder(papers.length);
    setPaperDialogOpen(true);
  };

  const handleSavePaper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingPaper || !paperTitle.trim() || !paperSubjectId) return;

    setIsSavingPaper(true);
    try {
      const res = await saveAdminPaperAction({
        id: editingPaper?.id,
        subjectId: paperSubjectId,
        title: paperTitle.trim(),
        paperCode: paperCode.trim() || undefined,
        displayOrder: Number(paperOrder) || 0,
      });
      if (res.success) {
        setPaperDialogOpen(false);
        await loadData();
      }
    } catch (err) {
      console.error('Failed to save paper:', err);
    } finally {
      setIsSavingPaper(false);
    }
  };

  // Topic Form Handlers
  const openNewTopicDialog = () => {
    setEditingTopic(null);
    const firstSubId = subjects[0]?.id || '';
    const firstPaper = papers.find((p) => p.subjectId === firstSubId) || papers[0];
    setTopicSubjectId(firstSubId);
    setTopicPaperId(firstPaper?.id || '');
    setTopicTitle('');
    setTopicChapterNumber(1);
    setTopicOrder(topics.length);
    setTopicDialogOpen(true);
  };

  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingTopic || !topicTitle.trim() || !topicPaperId || !topicSubjectId) return;

    setIsSavingTopic(true);
    try {
      const res = await saveAdminTopicAction({
        id: editingTopic?.id,
        subjectId: topicSubjectId,
        paperId: topicPaperId,
        title: topicTitle.trim(),
        chapterNumber: Number(topicChapterNumber) || 1,
        displayOrder: Number(topicOrder) || 0,
      });
      if (res.success) {
        setTopicDialogOpen(false);
        await loadData();
      }
    } catch (err) {
      console.error('Failed to save topic:', err);
    } finally {
      setIsSavingTopic(false);
    }
  };

  // Delete Action Execution
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.type === 'subject') {
        await deleteAdminSubjectAction(deleteTarget.id);
      } else if (deleteTarget.type === 'paper') {
        await deleteAdminPaperAction(deleteTarget.id);
      } else if (deleteTarget.type === 'topic') {
        await deleteAdminTopicAction(deleteTarget.id);
      }
      await loadData();
    } catch (err) {
      console.error('Failed to delete entity:', err);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            Academic Curriculum Subjects & Taxonomy
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Configure global subjects, papers, and chapters. Updates reflect instantly across student Revision Trackers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={openNewSubjectDialog}
            className="gap-1.5 text-xs shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Subject
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-8 gap-1 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
          className="w-full sm:w-auto"
        >
          <TabsList>
            <TabsTrigger value="subjects" className="text-xs gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Subjects ({subjects.length})
            </TabsTrigger>
            <TabsTrigger value="papers" className="text-xs gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Papers ({papers.length})
            </TabsTrigger>
            <TabsTrigger value="topics" className="text-xs gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Topics ({topics.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search / Filter Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search subjects, papers, topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs h-9 bg-card"
          />
        </div>
      </div>

      {/* Tab 1: Subjects Table */}
      {activeTab === 'subjects' && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Global Academic Subjects</CardTitle>
                <CardDescription className="text-xs">
                  Standard curriculum subjects displayed across student apps.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                {filteredSubjects.length} subjects
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Subject Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Color Pill</TableHead>
                  <TableHead className="text-center">Papers Count</TableHead>
                  <TableHead className="text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                      No subjects found. Click &quot;Add Subject&quot; above to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubjects.map((sub, index) => {
                    const subPapersCount = papers.filter((p) => p.subjectId === sub.id).length;
                    return (
                      <TableRow key={sub.id} className="hover:bg-muted/50">
                        <TableCell className="text-center font-mono text-xs text-muted-foreground">
                          {sub.displayOrder ?? index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: sub.color || '#2563EB' }}
                            />
                            <span className="font-semibold text-foreground text-xs sm:text-sm">
                              {sub.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {sub.code || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-[11px] font-mono"
                            style={{ borderColor: sub.color || '#2563EB', color: sub.color || '#2563EB' }}
                          >
                            {sub.color || '#2563EB'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="text-xs">
                            {subPapersCount} {subPapersCount === 1 ? 'Paper' : 'Papers'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditSubjectDialog(sub)}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="Edit Subject"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setDeleteTarget({
                                  type: 'subject',
                                  id: sub.id,
                                  name: sub.name,
                                })
                              }
                              className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              title="Delete Subject"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Papers Table */}
      {activeTab === 'papers' && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Curriculum Papers</CardTitle>
                <CardDescription className="text-xs">
                  Syllabus papers under each subject (e.g., 1st Paper, 2nd Paper).
                </CardDescription>
              </div>
              <Button size="sm" onClick={openNewPaperDialog} className="h-8 gap-1 text-xs">
                <Plus className="w-3.5 h-3.5" />
                Add Paper
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Paper Title</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Paper Code</TableHead>
                  <TableHead className="text-center">Topics Count</TableHead>
                  <TableHead className="text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPapers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                      No papers found. Click &quot;Add Paper&quot; to configure syllabus papers.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPapers.map((pap, index) => {
                    const parentSub = subjects.find((s) => s.id === pap.subjectId);
                    const papTopicsCount = topics.filter((t) => t.paperId === pap.id).length;
                    return (
                      <TableRow key={pap.id} className="hover:bg-muted/50">
                        <TableCell className="text-center font-mono text-xs text-muted-foreground">
                          {pap.displayOrder ?? index + 1}
                        </TableCell>
                        <TableCell className="font-semibold text-xs sm:text-sm">
                          {pap.title}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {parentSub?.name || pap.subjectId}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {pap.paperCode || '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="text-xs">
                            {papTopicsCount} Topics
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setDeleteTarget({
                                  type: 'paper',
                                  id: pap.id,
                                  name: pap.title,
                                })
                              }
                              className="h-8 w-8 text-rose-600 hover:text-rose-700"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Topics Table */}
      {activeTab === 'topics' && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Syllabus Chapters & Topics</CardTitle>
                <CardDescription className="text-xs">
                  Individual syllabus topics rendered on student revision matrix cards.
                </CardDescription>
              </div>
              <Button size="sm" onClick={openNewTopicDialog} className="h-8 gap-1 text-xs">
                <Plus className="w-3.5 h-3.5" />
                Add Topic
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-center">Chapter</TableHead>
                  <TableHead>Topic Title</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Paper</TableHead>
                  <TableHead className="text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTopics.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                      No topics found. Click &quot;Add Topic&quot; to add chapters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTopics.map((top) => {
                    const parentSub = subjects.find((s) => s.id === top.subjectId);
                    const parentPap = papers.find((p) => p.id === top.paperId);
                    return (
                      <TableRow key={top.id} className="hover:bg-muted/50">
                        <TableCell className="text-center font-mono text-xs font-semibold">
                          Ch {top.chapterNumber ?? '—'}
                        </TableCell>
                        <TableCell className="font-medium text-xs sm:text-sm">
                          {top.title}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {parentSub?.name || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {parentPap?.title || '—'}
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setDeleteTarget({
                                type: 'topic',
                                id: top.id,
                                name: top.title,
                              })
                            }
                            className="h-8 w-8 text-rose-600 hover:text-rose-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog: Add/Edit Subject */}
      <Dialog open={subjectDialogOpen} onOpenChange={setSubjectDialogOpen}>
        <DialogContent className="max-w-md w-full break-words overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editingSubject ? 'Edit Subject' : 'Add Academic Subject'}</DialogTitle>
            <DialogDescription className="text-xs">
              Configure curriculum subject details, branding color, and display sequence.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSubject} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-xs font-semibold text-foreground">
                Subject Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="name"
                name="name"
                required
                placeholder="e.g. Higher Mathematics"
                value={subjectName}
                onChange={(e) => {
                  setSubjectName(e.target.value);
                  setSubjectFormError(null);
                }}
                className="text-xs"
              />
              {subjectFormError && (
                <span data-slot="form-message" className="text-destructive text-[11px] block">
                  {subjectFormError}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="code" className="text-xs font-semibold text-foreground">
                  Subject Code
                </label>
                <Input
                  id="code"
                  name="code"
                  placeholder="e.g. HMATH"
                  value={subjectCode}
                  onChange={(e) => setSubjectCode(e.target.value)}
                  className="text-xs font-mono uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="displayOrder" className="text-xs font-semibold text-foreground">
                  Display Order
                </label>
                <Input
                  id="displayOrder"
                  name="displayOrder"
                  type="number"
                  min="0"
                  value={subjectOrder}
                  onChange={(e) => setSubjectOrder(parseInt(e.target.value) || 0)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="color" className="text-xs font-semibold text-foreground">
                Accent Color (HEX)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={subjectColor.startsWith('#') && subjectColor.length === 7 ? subjectColor : '#2563EB'}
                  onChange={(e) => setSubjectColor(e.target.value)}
                  className="w-9 h-9 p-0.5 rounded border border-border cursor-pointer bg-transparent shrink-0"
                />
                <Input
                  id="color"
                  name="color"
                  placeholder="#2563EB"
                  value={subjectColor}
                  onChange={(e) => setSubjectColor(e.target.value)}
                  className="text-xs font-mono uppercase"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="description" className="text-xs font-semibold text-foreground">
                Description & Notes
              </label>
              <Input
                id="description"
                name="description"
                placeholder="Optional syllabus overview..."
                value={subjectDescription}
                onChange={(e) => setSubjectDescription(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSubjectDialogOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingSubject}
                className="text-xs"
              >
                {isSavingSubject ? 'Saving...' : editingSubject ? 'Update Subject' : 'Save Subject'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Add Paper */}
      <Dialog open={paperDialogOpen} onOpenChange={setPaperDialogOpen}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle>Add Curriculum Paper</DialogTitle>
            <DialogDescription className="text-xs">
              Configure a paper under an existing academic subject.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePaper} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Parent Subject</label>
              <select
                value={paperSubjectId}
                onChange={(e) => setPaperSubjectId(e.target.value)}
                className="w-full text-xs h-9 rounded-md border border-input bg-card px-3 text-foreground"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Paper Title <span className="text-destructive">*</span>
              </label>
              <Input
                required
                placeholder="e.g. Higher Math 1st Paper"
                value={paperTitle}
                onChange={(e) => setPaperTitle(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Paper Code</label>
                <Input
                  placeholder="e.g. 1st Paper"
                  value={paperCode}
                  onChange={(e) => setPaperCode(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Display Order</label>
                <Input
                  type="number"
                  min="0"
                  value={paperOrder}
                  onChange={(e) => setPaperOrder(parseInt(e.target.value) || 0)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPaperDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSavingPaper}>
                {isSavingPaper ? 'Saving...' : 'Save Paper'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Add Topic */}
      <Dialog open={topicDialogOpen} onOpenChange={setTopicDialogOpen}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle>Add Syllabus Topic</DialogTitle>
            <DialogDescription className="text-xs">
              Create a chapter topic rendered in the student revision matrix.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveTopic} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Subject</label>
                <select
                  value={topicSubjectId}
                  onChange={(e) => {
                    const newSubId = e.target.value;
                    setTopicSubjectId(newSubId);
                    const matchedPaper = papers.find((p) => p.subjectId === newSubId);
                    if (matchedPaper) setTopicPaperId(matchedPaper.id);
                  }}
                  className="w-full text-xs h-9 rounded-md border border-input bg-card px-3 text-foreground"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Paper</label>
                <select
                  value={topicPaperId}
                  onChange={(e) => setTopicPaperId(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-card px-3 text-foreground"
                >
                  {papers
                    .filter((p) => !topicSubjectId || p.subjectId === topicSubjectId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Topic / Chapter Title <span className="text-destructive">*</span>
              </label>
              <Input
                required
                placeholder="e.g. Vectors & Coordinate Geometry"
                value={topicTitle}
                onChange={(e) => setTopicTitle(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Chapter Number</label>
                <Input
                  type="number"
                  min="1"
                  value={topicChapterNumber}
                  onChange={(e) => setTopicChapterNumber(parseInt(e.target.value) || 1)}
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Display Order</label>
                <Input
                  type="number"
                  min="0"
                  value={topicOrder}
                  onChange={(e) => setTopicOrder(parseInt(e.target.value) || 0)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setTopicDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSavingTopic}>
                {isSavingTopic ? 'Saving...' : 'Save Topic'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Alert Dialog for Deletion */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete {deleteTarget?.type} &quot;{deleteTarget?.name}&quot;?
              This action cannot be undone and will cascade to child records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs"
            >
              {isDeleting ? 'Deleting...' : 'Confirm Deletion'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
