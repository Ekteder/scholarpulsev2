'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { WorkspaceData } from '@/types';
import { calculateGamification } from './gamification';

export function generatePdfDossier(data: WorkspaceData) {
  if (typeof window === 'undefined') return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const profile = data.profile;
  const gamification = calculateGamification(data);
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Color palette
  const primaryBlue = [37, 99, 235] as [number, number, number]; // #2563EB
  const darkNavy = [15, 23, 42] as [number, number, number]; // #0F172A
  const slateGrey = [100, 116, 139] as [number, number, number]; // #64748B

  // 1. Header Banner
  doc.setFillColor(...primaryBlue);
  doc.rect(0, 0, 210, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('SCHOLARPULSE ACADEMIC DOSSIER', 14, 15);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('OFFICIAL STUDY PERFORMANCE & SYLLABUS AUDIT', 14, 20);
  doc.text(`Generated: ${dateFormatted}`, 196, 20, { align: 'right' });

  // 2. Student Info Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 30, 182, 28, 3, 3, 'FD');

  doc.setTextColor(...darkNavy);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(profile.fullName || 'Student Scholar', 20, 38);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...slateGrey);
  doc.text(`Email: ${profile.email}`, 20, 44);
  doc.text(`Target Exam: ${profile.targetExamName || 'HSC 2026'} (Target: ${profile.targetExamDate || '2026-06-15'})`, 20, 50);

  doc.text(`Scholar Rank: ${gamification.rank.rankTitle} (Lv.${gamification.rank.level})`, 120, 38);
  doc.text(`Total Gamification XP: ${gamification.totalXp} XP`, 120, 44);
  doc.text(`Daily Study Target: ${profile.dailyStudyTargetMinutes} min/day`, 120, 50);

  // 3. KPI Highlights Summary
  const totalSeconds = data.studySessions.reduce((acc, s) => acc + s.durationSeconds, 0);
  const totalHours = (totalSeconds / 3600).toFixed(1);
  const totalSessionsCount = data.studySessions.length;
  const completedTasksCount = data.tasks.filter((t) => t.status === 'completed').length;
  const totalCards = (data.flashcards || []).length;

  const kpis = [
    { label: 'TOTAL STUDY TIME', val: `${totalHours} hrs` },
    { label: 'RECORDED SESSIONS', val: `${totalSessionsCount}` },
    { label: 'COMPLETED TASKS', val: `${completedTasksCount}` },
    { label: 'FLASHCARDS IN DECK', val: `${totalCards}` },
  ];

  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * 47;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(x, 64, 42, 18, 2, 2, 'F');

    doc.setFontSize(7.5);
    doc.setTextColor(...slateGrey);
    doc.setFont('helvetica', 'bold');
    doc.text(kpi.label, x + 21, 70, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(...primaryBlue);
    doc.setFont('helvetica', 'bold');
    doc.text(kpi.val, x + 21, 78, { align: 'center' });
  });

  // 4. Subject Performance Breakdown Table
  doc.setFontSize(11);
  doc.setTextColor(...darkNavy);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Subject Performance Breakdown', 14, 91);

  const subjectRows = data.subjects.map((sub) => {
    const subSessions = data.studySessions.filter((s) => s.subjectId === sub.id);
    const subSeconds = subSessions.reduce((acc, s) => acc + s.durationSeconds, 0);
    const subHours = (subSeconds / 3600).toFixed(1);
    const subTasks = data.tasks.filter((t) => t.subjectId === sub.id);
    const doneTasks = subTasks.filter((t) => t.status === 'completed').length;
    const subCards = (data.flashcards || []).filter((f) => f.subjectId === sub.id).length;

    return [
      sub.name,
      `${subHours} hrs`,
      `${subSessions.length}`,
      `${doneTasks} / ${subTasks.length}`,
      `${subCards} cards`,
      `${sub.dailyTargetMinutes} min/day`,
    ];
  });

  autoTable(doc, {
    startY: 94,
    head: [['Subject Name', 'Hours Studied', 'Sessions', 'Tasks (Done/Total)', 'Flashcards', 'Target Pace']],
    body: subjectRows.length > 0 ? subjectRows : [['No subjects configured', '-', '-', '-', '-', '-']],
    theme: 'striped',
    headStyles: {
      fillColor: primaryBlue,
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
    },
    margin: { left: 14, right: 14 },
  });

  // 5. Weekly Schedule & Routine Compliance
  // @ts-expect-error autoTable adds lastAutoTable to doc
  let finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 160;

  if (finalY > 230) {
    doc.addPage();
    finalY = 20;
  }

  doc.setFontSize(11);
  doc.setTextColor(...darkNavy);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Weekly Timetable & Habit Schedule', 14, finalY);

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const scheduleRows = data.schedules.map((sch) => {
    const sub = data.subjects.find((s) => s.id === sch.subjectId);
    return [
      days[sch.dayOfWeek] || `Day ${sch.dayOfWeek}`,
      sub?.name || 'General',
      `${sch.startTime} - ${sch.endTime}`,
      sch.description || 'Focused Study Session',
    ];
  });

  autoTable(doc, {
    startY: finalY + 4,
    head: [['Day of Week', 'Subject', 'Time Window', 'Session Activity']],
    body: scheduleRows.length > 0 ? scheduleRows : [['No timetable slots created', '-', '-', '-']],
    theme: 'grid',
    headStyles: {
      fillColor: [71, 85, 105],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
    },
    margin: { left: 14, right: 14 },
  });

  // 6. Running Page Footers & Official Seal across all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(203, 213, 225);
    doc.line(14, 284, 196, 284);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...slateGrey);
    doc.text(
      'ScholarPulse Academic Engine • Cloud-Synchronized Study Dossier • Official Performance Record',
      14,
      289
    );
    doc.text(`Page ${i} of ${totalPages}`, 196, 289, { align: 'right' });
  }

  // Save the PDF
  const filename = `ScholarPulse_Dossier_${profile.fullName?.replace(/\s+/g, '_') || 'Scholar'}_${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
