'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  BookOpen,
  BookOpenCheck,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Database,
  Layers,
  LayoutDashboard,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  getAdminSubjectsAction,
  getAdminCurriculumStagesAction,
  getAdminGoalTemplatesAction,
  getAdminScheduleTemplatesAction,
  getAdminAchievementsAction,
  getAdminAllowlistAction,
  getAdminSystemConfigsAction,
} from '@/actions/admin';

export function AdminOverviewView() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    subjectsCount: 0,
    stagesCount: 0,
    goalsCount: 0,
    schedulesCount: 0,
    badgesCount: 0,
    allowlistCount: 0,
    configsCount: 0,
  });

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const [subs, stg, gls, sch, bdg, alw, cfg] = await Promise.allSettled([
        getAdminSubjectsAction(),
        getAdminCurriculumStagesAction(),
        getAdminGoalTemplatesAction(),
        getAdminScheduleTemplatesAction(),
        getAdminAchievementsAction(),
        getAdminAllowlistAction(),
        getAdminSystemConfigsAction(),
      ]);

      setStats({
        subjectsCount: subs.status === 'fulfilled' && subs.value.success ? subs.value.subjects.length : 0,
        stagesCount: stg.status === 'fulfilled' && stg.value.success ? stg.value.stages.length : 0,
        goalsCount: gls.status === 'fulfilled' && gls.value.success ? gls.value.templates.length : 0,
        schedulesCount: sch.status === 'fulfilled' && sch.value.success ? sch.value.templates.length : 0,
        badgesCount: bdg.status === 'fulfilled' && bdg.value.success ? bdg.value.achievements.length : 0,
        allowlistCount: alw.status === 'fulfilled' && alw.value.success ? alw.value.allowlist.length : 0,
        configsCount: cfg.status === 'fulfilled' && cfg.value.success ? cfg.value.configs.length : 0,
      });
    } catch (err) {
      console.error('Failed to load admin overview metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const metricCards = [
    {
      title: 'Academic Subjects',
      count: stats.subjectsCount,
      href: '/admin/subjects',
      icon: BookOpen,
      desc: 'Global curriculum & taxonomy',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-600/10',
    },
    {
      title: 'Revision Stages',
      count: stats.stagesCount,
      href: '/admin/checklist',
      icon: BookOpenCheck,
      desc: '6-stage checklist taxonomy',
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-600/10',
    },
    {
      title: 'Goal Templates',
      count: stats.goalsCount,
      href: '/admin/goals',
      icon: Target,
      desc: 'Preset target benchmarks',
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-600/10',
    },
    {
      title: 'Timetable Presets',
      count: stats.schedulesCount,
      href: '/admin/timetable',
      icon: Calendar,
      desc: 'Routine & slot presets',
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-600/10',
    },
    {
      title: 'Achievement Badges',
      count: stats.badgesCount,
      href: '/admin/badges',
      icon: Award,
      desc: 'Gamification badge catalog',
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-600/10',
    },
    {
      title: 'Admin Allowlist',
      count: stats.allowlistCount,
      href: '/admin/system',
      icon: ShieldCheck,
      desc: 'Authorized OAuth accounts',
      color: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-600/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-foreground flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-blue-600" />
            ScholarPulse Admin Dashboard & Entity Overview
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Centralized administration, taxonomy controls, and dynamic entity management.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 py-1 text-xs">
            <Database className="w-3.5 h-3.5 text-emerald-500" />
            PostgreSQL Live
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={loadMetrics}
            disabled={loading}
            className="h-8 gap-1 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Aggregate Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {metricCards.map((m) => {
          const Icon = m.icon;
          return (
            <Link key={m.title} href={m.href} className="group">
              <Card className="h-full transition-all hover:border-primary/50 hover:shadow-xs">
                <CardHeader className="p-3.5 pb-2">
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-lg ${m.bgColor} ${m.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </CardHeader>
                <CardContent className="p-3.5 pt-0">
                  <div className="text-xl sm:text-2xl font-bold font-display tracking-tight text-foreground">
                    {loading ? '—' : m.count}
                  </div>
                  <p className="text-xs font-semibold text-foreground/80 mt-0.5 truncate">{m.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{m.desc}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Module Navigation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              Subjects & Topics Management
            </CardTitle>
            <CardDescription className="text-xs">
              Manage curriculum subjects, papers (1st / 2nd paper), and chapter taxonomies. Changes reflect instantly in student Revision Tracker.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/subjects">
              <Button variant="default" size="sm" className="w-full text-xs">
                Manage Subjects & Topics
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpenCheck className="w-4 h-4 text-indigo-600" />
              Revision Checklist Stages
            </CardTitle>
            <CardDescription className="text-xs">
              Configure revision workflow stages, progress weights, colors, badges, and ordering for student progress matrices.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/checklist">
              <Button variant="default" size="sm" className="w-full text-xs">
                Configure Checklist Stages
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-600" />
              Goals & Routine Presets
            </CardTitle>
            <CardDescription className="text-xs">
              Create recommended goal templates and timetable schedule presets that students can import into their personal planner.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Link href="/admin/goals" className="flex-1">
              <Button variant="outline" size="sm" className="w-full text-xs">
                Goal Presets
              </Button>
            </Link>
            <Link href="/admin/timetable" className="flex-1">
              <Button variant="outline" size="sm" className="w-full text-xs">
                Timetables
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-600" />
              Gamification & Badges
            </CardTitle>
            <CardDescription className="text-xs">
              Curate achievement badges, XP milestones, streak awards, and deep-focus unlocks displayed on student profiles.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/badges">
              <Button variant="default" size="sm" className="w-full text-xs">
                Manage Achievement Badges
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              System Config & Exam Dates
            </CardTitle>
            <CardDescription className="text-xs">
              Customize platform parameters, target HSC exam dates, default Pomodoro timers, and maintenance mode status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/system">
              <Button variant="default" size="sm" className="w-full text-xs">
                Configure System Settings
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-rose-600" />
              Admin Allowlist Security
            </CardTitle>
            <CardDescription className="text-xs">
              Control administrative access. Only allowlisted Google OAuth accounts can access this console and execute server actions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/system">
              <Button variant="outline" size="sm" className="w-full text-xs">
                View Admin Allowlist
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
