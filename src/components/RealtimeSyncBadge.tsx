'use client';

import React, { useState } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Radio, RefreshCw, Smartphone, Laptop, CheckCircle2 } from 'lucide-react';

export function RealtimeSyncBadge({
  variant = 'header',
}: {
  variant?: 'header' | 'sidebar' | 'drawer';
}) {
  const { syncStatus, lastSyncTime, refreshWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleManualSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setRefreshing(true);
      await refreshWorkspace();
    } finally {
      setRefreshing(false);
    }
  };

  const statusConfig = {
    connected: {
      dotClass: 'bg-emerald-500 animate-pulse',
      badgeClass:
        'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400',
      label: 'Live Sync',
      tooltip: 'Real-time SSE active across all devices',
    },
    connecting: {
      dotClass: 'bg-amber-500 animate-pulse',
      badgeClass:
        'border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400',
      label: 'Connecting...',
      tooltip: 'Re-establishing real-time connection...',
    },
    disconnected: {
      dotClass: 'bg-slate-400',
      badgeClass:
        'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400',
      label: 'Offline',
      tooltip: 'Sync paused',
    },
  }[syncStatus || 'disconnected'];

  const isSidebar = variant === 'sidebar';
  const isDrawer = variant === 'drawer';

  return (
    <div className="relative inline-block text-left shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title={statusConfig.tooltip}
        className={`flex items-center gap-1.5 rounded-full border font-medium transition-colors cursor-pointer shrink-0 ${
          isSidebar || isDrawer
            ? 'p-1.5 text-[10px]'
            : 'px-2 sm:px-2.5 py-1 text-[11px]'
        } ${statusConfig.badgeClass}`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Real-time sync status: ${statusConfig.label}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusConfig.dotClass}`} />
        <Radio className="w-3.5 h-3.5 shrink-0" />
        {!isSidebar && !isDrawer && (
          <span className="hidden md:inline font-semibold whitespace-nowrap">
            {statusConfig.label}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
          />
          <div
            className={`rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 z-[60] text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150 ${
              isSidebar
                ? 'absolute left-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)]'
                : 'fixed top-14 left-3 right-3 sm:left-auto sm:right-0 sm:top-full sm:absolute sm:mt-2 w-auto sm:w-80 max-w-sm mx-auto sm:mx-0'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold leading-tight">Zero-Cloud-Lag Sync</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    100% First-Party Native Real-Time
                  </p>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  syncStatus === 'connected'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                }`}
              >
                {syncStatus.toUpperCase()}
              </span>
            </div>

            <div className="py-3 space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-blue-500 shrink-0" />
                <span>Mobile & Desktop synced via Server-Sent Events</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Laptop className="w-4 h-4 text-purple-500 shrink-0" />
                <span>Tabs update in 0ms via BroadcastChannel</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Timer & Pomodoro state synced live</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400 truncate">
                {lastSyncTime
                  ? `Synced ${lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                  : 'Waiting for stream...'}
              </span>
              <button
                type="button"
                onClick={handleManualSync}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
export default RealtimeSyncBadge;
