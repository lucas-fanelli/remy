'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useRef,
} from 'react';

// Type for the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Type for navigator with getInstalledRelatedApps
interface NavigatorWithRelatedApps extends Navigator {
  getInstalledRelatedApps?: () => Promise<Array<{ platform: string; url: string }>>;
}

/**
 * What Settings needs to offer installing the app, and nothing more.
 *
 * Nothing here asks on its own. The provider used to open an install banner by itself, on
 * iOS the moment the site loaded and in Chrome as soon as the browser offered an install,
 * once a session unless it had been dismissed within the week. Lucas found it unbearable,
 * so it is gone: installing is something a reader goes to Settings for.
 */
interface PwaContextType {
  // State
  canInstall: boolean;
  isInstalled: boolean; // App is installed (detected via related apps API or running in standalone)
  isRunningStandalone: boolean; // Currently running in standalone/PWA mode
  isIOSSafari: boolean;
  isDesktopChrome: boolean;
  promptAvailable: boolean;

  // Actions
  triggerInstall: () => Promise<boolean>;
  openApp: () => void;
}

const PwaContext = createContext<PwaContextType | undefined>(undefined);

/**
 * Detects if the user is on iOS Safari (not in standalone mode)
 */
function detectIOSSafari(): boolean {
  if (typeof window === 'undefined') return false;

  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|mercury/.test(ua);

  return isIOS && isSafari && !isStandalone;
}

/**
 * Detects if the user is on Desktop Chrome/Edge (supports beforeinstallprompt)
 */
function detectDesktopChrome(): boolean {
  if (typeof window === 'undefined') return false;

  const ua = window.navigator.userAgent;
  const isChromium = /Chrome|Chromium|Edg/.test(ua);
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  return isChromium && !isMobile;
}

/**
 * Checks if the app is running in standalone mode (PWA mode)
 */
function detectRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;

  // Check display-mode media query
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  // Check iOS standalone property
  const isIOSStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  return isStandalone || isIOSStandalone;
}

/**
 * Checks if the app is installed using getInstalledRelatedApps API (Desktop Chrome)
 */
async function checkInstalledRelatedApps(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const nav = navigator as NavigatorWithRelatedApps;
  if (!nav.getInstalledRelatedApps) return false;

  try {
    const relatedApps = await nav.getInstalledRelatedApps();
    return relatedApps.length > 0;
  } catch (error) {
    console.warn('getInstalledRelatedApps failed:', error);
    return false;
  }
}

interface PwaProviderProps {
  children: ReactNode;
}

export function PwaProvider({ children }: PwaProviderProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isRunningStandalone, setIsRunningStandalone] = useState(false);
  const [isIOSSafari, setIsIOSSafari] = useState(false);
  const [isDesktopChrome, setIsDesktopChrome] = useState(false);

  const hasInitialized = useRef(false);

  // Initialize detection on mount (only once)
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const runningStandalone = detectRunningStandalone();
    setIsRunningStandalone(runningStandalone);
    setIsIOSSafari(detectIOSSafari());
    setIsDesktopChrome(detectDesktopChrome());

    // If running in standalone, mark as installed and don't show anything
    if (runningStandalone) {
      setIsInstalled(true);
      return;
    }

    // Check for installed related apps (async)
    checkInstalledRelatedApps().then((installed) => {
      if (installed) setIsInstalled(true);
    });
  }, []);

  // Keep the browser's install offer for Settings. Nothing is shown when it arrives.
  useEffect(() => {
    // Don't listen if already installed or running in standalone
    if (isInstalled || isRunningStandalone) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      // Chrome's own mini-infobar is an install banner too: keep it from appearing
      e.preventDefault();
      // Stash the event for Settings' install button
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isInstalled, isRunningStandalone]);

  // Trigger the install prompt
  const triggerInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;

    try {
      // Show the install prompt
      await deferredPrompt.prompt();

      // Wait for the user's choice
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error triggering install prompt:', error);
      return false;
    }
  }, [deferredPrompt]);

  // Open App - uses hard navigation to trigger OS intent
  const openApp = useCallback(() => {
    // Force hard navigation to give OS a chance to intercept with installed PWA
    window.location.href = '/?source=pwa-open';
  }, []);

  const value: PwaContextType = {
    canInstall: !!deferredPrompt || isIOSSafari,
    isInstalled,
    isRunningStandalone,
    isIOSSafari,
    isDesktopChrome,
    promptAvailable: !!deferredPrompt,
    triggerInstall,
    openApp,
  };

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export function usePwa(): PwaContextType {
  const context = useContext(PwaContext);
  if (context === undefined) {
    throw new Error('usePwa must be used within a PwaProvider');
  }
  return context;
}

// Optional hook for checking if inside provider (for conditional usage)
export function usePwaOptional(): PwaContextType | null {
  return useContext(PwaContext) ?? null;
}
