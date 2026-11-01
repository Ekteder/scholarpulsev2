"use client";
import React, { useEffect, useState } from 'react';
import {
  Download,
  CheckCircle2,
  Smartphone,
  Monitor,
  Share,
  PlusSquare,
  MoreVertical,
  Sparkles,
  Zap,
  ShieldCheck,
  Layout,
  ExternalLink,
  Info,
  X,
  WifiOff,
} from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'auth' | 'sidebar' | 'header' | 'settings';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'sidebar',
  className = '',
}) => {
  const {
    canTriggerNativePrompt,
    isInstalled,
    isStandalone,
    isIOS,
    triggerInstall,
    openInstallModal,
  } = usePWAInstall();

  // Hide install button in sidebar/header/auth when already installed or running in standalone mode
  if ((isInstalled || isStandalone) && variant !== 'settings') {
    return null;
  }

  if (variant === 'auth') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <button
          type="button"
          onClick={triggerInstall}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm shadow-blue-600/20 transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isIOS ? 'Install on iPhone / iPad' : 'Install App'}</span>
          <span className="sm:hidden">Install</span>
          {canTriggerNativePrompt && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
          )}
        </button>
        <button
          type="button"
          onClick={() => openInstallModal('benefits')}
          title="Why install ScholarPulse?"
          className="inline-flex items-center justify-center p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-800/60 transition-colors cursor-pointer"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (variant === 'header') {
    return (
      <button
        type="button"
        onClick={triggerInstall}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800/70 bg-blue-50/80 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold transition-colors cursor-pointer ${className}`}
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Install App</span>
      </button>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div
        className={`rounded-xl p-3 bg-gradient-to-br from-blue-50/90 to-slate-50 dark:from-blue-950/40 dark:to-slate-900 border border-blue-200/70 dark:border-blue-800/50 ${className}`}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Download className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                Install ScholarPulse
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {canTriggerNativePrompt
                  ? 'Ready for 1-click install'
                  : isIOS
                  ? 'Add to iOS Home Screen'
                  : 'Desktop & Mobile App'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openInstallModal('benefits')}
            title="App installation benefits & guide"
            className="p-1 rounded-md text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={triggerInstall}
          className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install App</span>
        </button>
      </div>
    );
  }

  // Settings variant
  if (isInstalled || isStandalone) {
    return (
      <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        <span>ScholarPulse Installed (Standalone App Active)</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2.5 ${className}`}>
      <button
        type="button"
        onClick={triggerInstall}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
      >
        <Download className="w-4 h-4" />
        <span>
          {canTriggerNativePrompt
            ? 'Install ScholarPulse Now'
            : isIOS
            ? 'Install on iPhone / iPad'
            : 'Install App'}
        </span>
      </button>
      <button
        type="button"
        onClick={() => openInstallModal('benefits')}
        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
      >
        <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        <span>Benefits & Browser Guide</span>
      </button>
    </div>
  );
};

export const OfflineConnectivityBanner: React.FC = () => {
  const { isOnline } = usePWAInstall();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg border border-amber-400/40">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>
        Offline Mode — Cached shell active. Completed timer sessions will queue and sync when back online.
      </span>
    </div>
  );
};

export const PWAInstallModal: React.FC = () => {
  const {
    canTriggerNativePrompt,
    isInstalled,
    isStandalone,
    isIOS,
    platform,
    isInIframe,
    swRegistered,
    triggerInstall,
  } = usePWAInstall();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlatformTab, setSelectedPlatformTab] = useState<
    'desktop' | 'android' | 'ios'
  >('desktop');

  useEffect(() => {
    if (isIOS) {
      setSelectedPlatformTab('ios');
    } else if (platform === 'android-chrome') {
      setSelectedPlatformTab('android');
    } else {
      setSelectedPlatformTab('desktop');
    }
  }, [isIOS, platform]);

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
    };
    window.addEventListener('scholarpulse:open-pwa-modal', handleOpen);
    return () => {
      window.removeEventListener('scholarpulse:open-pwa-modal', handleOpen);
    };
  }, []);

  if (!isOpen) return null;

  const topLevelUrl = typeof window !== 'undefined' ? window.location.href : '/';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-4 bg-gradient-to-r from-blue-50/70 via-white to-slate-50 dark:from-blue-950/40 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/25 shrink-0">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold font-display text-slate-900 dark:text-white">
                  Install ScholarPulse App
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wider">
                  PWA
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Install ScholarPulse on your device for a fast, dedicated academic workspace.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
          {/* Status Banner if already installed */}
          {(isInstalled || isStandalone) && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="text-xs text-emerald-800 dark:text-emerald-200">
                <p className="font-bold">ScholarPulse is installed on this device!</p>
                <p className="mt-0.5 opacity-90">
                  You can launch ScholarPulse directly from your home screen, desktop, or applications dock.
                </p>
              </div>
            </div>
          )}

          {/* Direct Native Install Trigger if available */}
          {canTriggerNativePrompt && !isInstalled && !isStandalone && (
            <div className="p-4 rounded-xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Ready for One-Click Installation
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Your browser supports native PWA installation. Click below to open the install prompt.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const res = await triggerInstall();
                  if (res === 'accepted') setIsOpen(false);
                }}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shrink-0 shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Install Now</span>
              </button>
            </div>
          )}

          {/* Notice when inside a preview iframe */}
          {isInIframe && !canTriggerNativePrompt && !isInstalled && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-amber-900 dark:text-amber-200">
                <p className="font-bold">Viewing Inside Preview Frame</p>
                <p className="mt-0.5 text-amber-800 dark:text-amber-300/90">
                  Browsers require opening the app in a standalone browser tab to enable the native address-bar install prompt.
                </p>
              </div>
              <a
                href={topLevelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shrink-0 transition-colors"
              >
                <span>Open in New Tab</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* Benefits Grid */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
              Why Install ScholarPulse?
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Layout className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    Dedicated App Window
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Runs in a clean, distraction-free standalone window without cluttered browser tabs.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    1-Tap Home Screen & Dock Launch
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Pin ScholarPulse to your phone home screen, Windows taskbar, or Mac Dock.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    Faster Study Timer Access
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Pre-caches application assets locally for instant startup and offline timer queueing.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    Private & Cloud-Synced
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Caches UI assets only—never stores private study records or tokens in shared caches.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Platform-Specific Instructions */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                How to Install on Your Device
              </h4>
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {swRegistered ? 'Service Worker Active' : 'PWA Manifest Ready'}
              </span>
            </div>

            {/* Platform Selector Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 mb-4">
              <button
                type="button"
                onClick={() => setSelectedPlatformTab('desktop')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  selectedPlatformTab === 'desktop'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Desktop (Chrome / Edge)</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedPlatformTab('android')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  selectedPlatformTab === 'android'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Android Chrome</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedPlatformTab('ios')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  selectedPlatformTab === 'ios'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Share className="w-3.5 h-3.5" />
                <span>iPhone / iPad (iOS)</span>
              </button>
            </div>

            {/* Instructions Content */}
            {selectedPlatformTab === 'desktop' && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <p>
                    Open ScholarPulse in <strong>Google Chrome</strong> or{' '}
                    <strong>Microsoft Edge</strong> in a full browser tab.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <p>
                    Click the <strong>Install App</strong> button in ScholarPulse, or click the{' '}
                    <strong>Install icon</strong> (<Download className="w-3.5 h-3.5 inline text-blue-600 dark:text-blue-400" />) on the right side of your browser&apos;s address bar.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <p>
                    Alternatively, open the browser menu (<strong>⋮</strong> in Chrome or{' '}
                    <strong>⋯</strong> in Edge) → select{' '}
                    <strong>Cast, save, and share</strong> (or <strong>Apps</strong>) → click{' '}
                    <strong>Install ScholarPulse</strong>.
                  </p>
                </div>
              </div>
            )}

            {selectedPlatformTab === 'android' && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <p>
                    Open ScholarPulse in <strong>Chrome for Android</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <p>
                    Tap the <strong>Install App</strong> button, or tap the three-dot menu (
                    <MoreVertical className="w-3.5 h-3.5 inline text-blue-600 dark:text-blue-400" />
                    ) in the top-right corner of Chrome.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <p>
                    Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>) and confirm to add ScholarPulse to your app drawer.
                  </p>
                </div>
              </div>
            )}

            {selectedPlatformTab === 'ios' && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <p>
                    Open ScholarPulse in <strong>Safari</strong> on your iPhone or iPad.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <p>
                    Tap the <strong>Share</strong> button (
                    <Share className="w-3.5 h-3.5 inline text-blue-600 dark:text-blue-400" />
                    ) in the Safari toolbar.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <p>
                    Scroll down and tap <strong>Add to Home Screen</strong> (
                    <PlusSquare className="w-3.5 h-3.5 inline text-blue-600 dark:text-blue-400" />
                    ), then tap <strong>Add</strong> in the top-right corner.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
