'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Drawer,
    Box,
    Typography,
    Button,
    IconButton,
    useTheme,
    alpha,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import GetAppIcon from '@mui/icons-material/GetApp';
import IosShareIcon from '@mui/icons-material/IosShare';
import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined';

// Type for the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Constants
const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_DURATION_DAYS = 7;

/**
 * Detects if the user is on iOS Safari (not in standalone mode)
 */
function isIOSSafari(): boolean {
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
function isAppInstalled(): boolean {
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

/**
 * InstallPrompt Component
 * 
 * Shows a bottom drawer prompting users to install the PWA.
 * Handles both standard beforeinstallprompt and iOS Safari instructions.
 */
export default function InstallPrompt() {
    const theme = useTheme();
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [showIOSInstructions, setShowIOSInstructions] = useState(false);

    // Handle the beforeinstallprompt event
    useEffect(() => {
        // Don't show if already installed or recently dismissed
        if (isAppInstalled() || isDismissedRecently()) {
            return;
        }

        // Check for iOS Safari
        if (isIOSSafari()) {
            setShowIOSInstructions(true);
            setShowPrompt(true);
            return;
        }

        const handleBeforeInstallPrompt = (e: Event) => {
            // Prevent the mini-infobar from appearing
            e.preventDefault();
            // Stash the event for later use
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            // Show our custom UI
            setShowPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    // Handle install button click
    const handleInstall = useCallback(async () => {
        if (!deferredPrompt) return;

        // Show the install prompt
        await deferredPrompt.prompt();

        // Wait for the user's choice
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setShowPrompt(false);
        }

        // Clear the deferred prompt
        setDeferredPrompt(null);
    }, [deferredPrompt]);

    // Handle dismiss
    const handleDismiss = useCallback(() => {
        localStorage.setItem(DISMISS_KEY, Date.now().toString());
        setShowPrompt(false);
    }, []);

    if (!showPrompt) return null;

    return (
        <Drawer
            anchor="bottom"
            open={showPrompt}
            onClose={handleDismiss}
            PaperProps={{
                sx: {
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    maxWidth: 500,
                    mx: 'auto',
                    pb: 'env(safe-area-inset-bottom)',
                },
            }}
            slotProps={{
                backdrop: {
                    sx: { backgroundColor: alpha(theme.palette.common.black, 0.5) },
                },
            }}
        >
            <Box sx={{ p: 3, position: 'relative' }}>
                {/* Close button */}
                <IconButton
                    onClick={handleDismiss}
                    sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        color: 'text.secondary',
                    }}
                    aria-label="Close install prompt"
                >
                    <CloseIcon />
                </IconButton>

                {/* Icon */}
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        mb: 2,
                    }}
                >
                    <Box
                        sx={{
                            width: 64,
                            height: 64,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <GetAppIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                    </Box>
                </Box>

                {/* Title */}
                <Typography
                    variant="h6"
                    component="h2"
                    align="center"
                    gutterBottom
                    sx={{ fontWeight: 600 }}
                >
                    Get the Full Experience
                </Typography>

                {/* Description */}
                <Typography
                    variant="body2"
                    color="text.secondary"
                    align="center"
                    sx={{ mb: 3 }}
                >
                    Install Remy&apos;s App for faster access, offline browsing, and a native app experience.
                </Typography>

                {showIOSInstructions ? (
                    // iOS Instructions
                    <Box sx={{ mb: 2 }}>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            align="center"
                            sx={{ mb: 2 }}
                        >
                            To install on your device:
                        </Typography>
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1.5,
                                bgcolor: alpha(theme.palette.primary.main, 0.05),
                                borderRadius: 2,
                                p: 2,
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <IosShareIcon sx={{ color: 'primary.main' }} />
                                <Typography variant="body2">
                                    1. Tap the <strong>Share</strong> button in Safari
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <AddBoxOutlinedIcon sx={{ color: 'primary.main' }} />
                                <Typography variant="body2">
                                    2. Select <strong>&quot;Add to Home Screen&quot;</strong>
                                </Typography>
                            </Box>
                        </Box>
                        <Button
                            fullWidth
                            variant="outlined"
                            onClick={handleDismiss}
                            sx={{ mt: 2 }}
                        >
                            Got it
                        </Button>
                    </Box>
                ) : (
                    // Standard install button
                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        startIcon={<GetAppIcon />}
                        onClick={handleInstall}
                        sx={{
                            py: 1.5,
                            borderRadius: 2,
                            textTransform: 'none',
                            fontSize: '1rem',
                        }}
                    >
                        Install App
                    </Button>
                )}

                {/* Dismiss link */}
                {!showIOSInstructions && (
                    <Button
                        fullWidth
                        variant="text"
                        onClick={handleDismiss}
                        sx={{
                            mt: 1,
                            color: 'text.secondary',
                            textTransform: 'none',
                        }}
                    >
                        Not now
                    </Button>
                )}
            </Box>
        </Drawer>
    );
}
