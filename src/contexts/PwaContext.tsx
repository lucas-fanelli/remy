'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// Type for the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Constants
const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_DURATION_DAYS = 7;

interface PwaContextType {
    // State
    canInstall: boolean;
    isInstalled: boolean;
    isIOSSafari: boolean;
    showInstallPrompt: boolean;

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
 * Checks if the app is already installed (running in standalone mode)
 */
function detectAppInstalled(): boolean {
    if (typeof window === 'undefined') return false;

    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
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

interface PwaProviderProps {
    children: ReactNode;
}

export function PwaProvider({ children }: PwaProviderProps) {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isIOSSafari, setIsIOSSafari] = useState(false);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);

    // Initialize on mount
    useEffect(() => {
        setIsInstalled(detectAppInstalled());
        setIsIOSSafari(detectIOSSafari());
    }, []);

    // Handle the beforeinstallprompt event
    useEffect(() => {
        if (isInstalled || isDismissedRecently()) {
            return;
        }

        // Show iOS instructions immediately if on iOS Safari
        if (detectIOSSafari()) {
            setShowInstallPrompt(true);
            return;
        }

        const handleBeforeInstallPrompt = (e: Event) => {
            // Prevent the mini-infobar from appearing
            e.preventDefault();
            // Stash the event for later use
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            // Show our custom UI
            setShowInstallPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Listen for app installed
        const handleAppInstalled = () => {
            setIsInstalled(true);
            setShowInstallPrompt(false);
            setDeferredPrompt(null);
        };

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
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error triggering install prompt:', error);
            return false;
        }
    }, [deferredPrompt]);

    // Dismiss the install prompt
    const dismissInstallPrompt = useCallback(() => {
        localStorage.setItem(DISMISS_KEY, Date.now().toString());
        setShowInstallPrompt(false);
    }, []);

    // Reset dismissal (for testing or if user wants to see prompt again)
    const resetDismissal = useCallback(() => {
        localStorage.removeItem(DISMISS_KEY);
        if (deferredPrompt || isIOSSafari) {
            setShowInstallPrompt(true);
        }
    }, [deferredPrompt, isIOSSafari]);

    const value: PwaContextType = {
        canInstall: !!deferredPrompt || isIOSSafari,
        isInstalled,
        isIOSSafari,
        showInstallPrompt,
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
