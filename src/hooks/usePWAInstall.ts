'use client';

import { useEffect, useState, useCallback } from 'react';
import { isBridgeAvailable } from './useAndroidBridge';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    __deferredPwaPrompt?: BeforeInstallPromptEvent | null;
  }
}

export type PWAPlatform =
  | 'ios-safari'
  | 'android-chrome'
  | 'desktop-edge'
  | 'desktop-chrome'
  | 'other';

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(() =>
      typeof window !== 'undefined' ? window.__deferredPwaPrompt || null : null
    );
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      isBridgeAvailable() ||
      (typeof navigator !== 'undefined' && /ScholarPulseAndroid/i.test(navigator.userAgent))
    );
  });
  const [isStandalone, setIsStandalone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      isBridgeAvailable() ||
      (typeof navigator !== 'undefined' && /ScholarPulseAndroid/i.test(navigator.userAgent))
    );
  });
  const [platform, setPlatform] = useState<PWAPlatform>('desktop-chrome');
  const [isInIframe, setIsInIframe] = useState<boolean>(false);
  const [swRegistered, setSwRegistered] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 0. Detect if running inside native Android shell
    const isNativeApp =
      isBridgeAvailable() ||
      (typeof navigator !== 'undefined' && /ScholarPulseAndroid/i.test(navigator.userAgent));

    if (isNativeApp) {
      setIsStandalone(true);
      setIsInstalled(true);
      return;
    }

    // 1. Check standalone mode
    const checkStandalone = () => {
      const standaloneMatch =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: window-controls-overlay)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone ===
          true;
      setIsStandalone(standaloneMatch);
      if (standaloneMatch) {
        setIsInstalled(true);
      }
    };
    checkStandalone();

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches);
      if (e.matches) setIsInstalled(true);
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    }

    // 2. Check if running inside an iframe (e.g., preview iframe)
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }

    // 3. Detect platform
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (window.navigator.platform === 'MacIntel' &&
        window.navigator.maxTouchPoints > 1);
    const isAndroidDevice = /android/.test(ua);
    const isEdgeBrowser = /edg\//.test(ua);
    const isChromeBrowser =
      /chrome|crios/.test(ua) && !isEdgeBrowser && !/opr\//.test(ua);

    if (isIOSDevice) {
      setPlatform('ios-safari');
    } else if (isAndroidDevice) {
      setPlatform('android-chrome');
    } else if (isEdgeBrowser) {
      setPlatform('desktop-edge');
    } else if (isChromeBrowser) {
      setPlatform('desktop-chrome');
    } else {
      setPlatform('other');
    }

    // 4. Sync with early window.__deferredPwaPrompt or subsequent events
    if (window.__deferredPwaPrompt) {
      setDeferredPrompt(window.__deferredPwaPrompt);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__deferredPwaPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleCustomPromptReady = () => {
      if (window.__deferredPwaPrompt) {
        setDeferredPrompt(window.__deferredPwaPrompt);
      }
    };

    const handleAppInstalled = () => {
      window.__deferredPwaPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    // 5. Check service worker status
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        setSwRegistered(!!reg);
      });
      navigator.serviceWorker.ready.then(() => {
        setSwRegistered(true);
      });
    }

    // 6. Online/offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener(
      'scholarpulse:pwa-prompt-ready',
      handleCustomPromptReady
    );
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('scholarpulse:pwa-installed', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange);
      }
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener(
        'scholarpulse:pwa-prompt-ready',
        handleCustomPromptReady
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener(
        'scholarpulse:pwa-installed',
        handleAppInstalled
      );
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const openInstallModal = useCallback(
    (initialTab: 'guide' | 'benefits' = 'guide') => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('scholarpulse:open-pwa-modal', {
            detail: { tab: initialTab },
          })
        );
      }
    },
    []
  );

  const triggerInstall = useCallback(async (): Promise<
    'accepted' | 'dismissed' | 'fallback-modal'
  > => {
    const promptEvent =
      deferredPrompt ||
      (typeof window !== 'undefined' ? window.__deferredPwaPrompt : null);
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
          if (typeof window !== 'undefined') {
            window.__deferredPwaPrompt = null;
          }
          setDeferredPrompt(null);
          setIsInstalled(true);
          return 'accepted';
        }
        return 'dismissed';
      } catch (err) {
        console.warn('Native install prompt failed, showing guide:', err);
        openInstallModal('guide');
        return 'fallback-modal';
      }
    }

    // When native prompt is unavailable (e.g., iOS Safari, already dismissed, or inside preview iframe)
    openInstallModal('guide');
    return 'fallback-modal';
  }, [deferredPrompt, openInstallModal]);

  return {
    canTriggerNativePrompt: !!deferredPrompt,
    isInstalled,
    isStandalone,
    isIOS: platform === 'ios-safari',
    platform,
    isInIframe,
    swRegistered,
    isOnline,
    triggerInstall,
    openInstallModal,
  };
}
