'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';

// Type for the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Constants
const DISMISS_KEY = 'pwa-install-dismissed';
const PROMPT_SHOWN_KEY = 'pwa-install-prompt-shown-session';
const DISMISS_DURATION_DAYS = 7;

interface PwaContextType {
    // State
    canInstall: boolean;
    isInstalled: boolean;
    isIOSSafari: boolean;
    isDesktopChrome: boolean;
    showInstallPrompt: boolean;
    promptAvailable: boolean;

    // Actions
    triggerInstall: () => Promise<boolean>;
    dismissInstallPrompt: () => void;
    resetDismissal: () => void;
}

const PwaContext = createContext<PwaContextType | undefined>(undefined);

/**
 * Detects if the user is on iOS Safari (not in standalone mode)
 */
function detectIOSSafari(): boolean {
    if (typeof window === 'undefined') return false;

    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
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
 * Checks if the app is already installed (running in standalone mode)
 */
function detectAppInstalled(): boolean {
    if (typeof window === 'undefined') return false;

    // Check display-mode media query
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    // Check iOS standalone property
    const isIOSStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    return isStandalone || isIOSStandalone;
}

/**
 * Checks if the user dismissed the prompt within the last N days
 */
function isDismissedRecently(): boolean {
    if (typeof window === 'undefined') return true;

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) return false;

    const dismissedTime = parseInt(dismissed, 10);
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

    return daysSinceDismissed < DISMISS_DURATION_DAYS;
}

/**
 * Checks if the prompt was already shown this session
 */
function wasPromptShownThisSession(): boolean {
    if (typeof window === 'undefined') return true;
    return sessionStorage.getItem(PROMPT_SHOWN_KEY) === 'true';
}

/**
 * Marks the prompt as shown for this session
 */
function markPromptShownThisSession(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(PROMPT_SHOWN_KEY, 'true');
}

interface PwaProviderProps {
    children: ReactNode;
}

export function PwaProvider({ children }: PwaProviderProps) {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isIOSSafari, setIsIOSSafari] = useState(false);
    const [isDesktopChrome, setIsDesktopChrome] = useState(false);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [promptAvailable, setPromptAvailable] = useState(false);

    // Use ref to track if we've already shown the prompt this mount
    const hasShownPrompt = useRef(false);
    const hasInitialized = useRef(false);

    // Initialize detection on mount (only once)
    useEffect(() => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;

        const installed = detectAppInstalled();
        setIsInstalled(installed);
        setIsIOSSafari(detectIOSSafari());
        setIsDesktopChrome(detectDesktopChrome());

        // If already installed, don't show anything
        if (installed) return;

        // Check if dismissed recently or already shown this session
        if (isDismissedRecently() || wasPromptShownThisSession()) {
            return;
        }

        // For iOS Safari, show instructions immediately (once per session)
        if (detectIOSSafari() && !hasShownPrompt.current) {
            hasShownPrompt.current = true;
            markPromptShownThisSession();
            setShowInstallPrompt(true);
        }
    }, []);

    // Handle the beforeinstallprompt event (only capture, don't auto-show)
    useEffect(() => {
        if (isInstalled) return;

        const handleBeforeInstallPrompt = (e: Event) => {
            // Prevent the mini-infobar from appearing
            e.preventDefault();
            // Stash the event for later use
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setPromptAvailable(true);

            // Only show the prompt if not dismissed and not shown this session
            if (!isDismissedRecently() && !wasPromptShownThisSession() && !hasShownPrompt.current) {
                hasShownPrompt.current = true;
                markPromptShownThisSession();
                setShowInstallPrompt(true);
            }
        };

        // Listen for app installed
        const handleAppInstalled = () => {
            setIsInstalled(true);
            setShowInstallPrompt(false);
            setDeferredPrompt(null);
            setPromptAvailable(false);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, [isInstalled]);

    // Trigger the install prompt
    const triggerInstall = useCallback(async (): Promise<boolean> => {
        if (!deferredPrompt) return false;

        try {
            // Show the install prompt
            await deferredPrompt.prompt();

            // Wait for the user's choice
            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === 'accepted') {
                setShowInstallPrompt(false);
                setDeferredPrompt(null);
                setPromptAvailable(false);
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error triggering install prompt:', error);
            return false;
        }
    }, [deferredPrompt]);

    // Dismiss the install prompt (stores for 7 days)
    const dismissInstallPrompt = useCallback(() => {
        localStorage.setItem(DISMISS_KEY, Date.now().toString());
        markPromptShownThisSession();
        setShowInstallPrompt(false);
    }, []);

    // Reset dismissal (for testing or if user wants to see prompt again)
    const resetDismissal = useCallback(() => {
        localStorage.removeItem(DISMISS_KEY);
        sessionStorage.removeItem(PROMPT_SHOWN_KEY);
        hasShownPrompt.current = false;
        if (deferredPrompt || isIOSSafari) {
            setShowInstallPrompt(true);
        }
    }, [deferredPrompt, isIOSSafari]);

    const value: PwaContextType = {
        canInstall: !!deferredPrompt || isIOSSafari,
        isInstalled,
        isIOSSafari,
        isDesktopChrome,
        showInstallPrompt,
        promptAvailable: !!deferredPrompt,
        triggerInstall,
        dismissInstallPrompt,
        resetDismissal,
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
