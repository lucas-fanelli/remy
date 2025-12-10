'use client';

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
import { usePwa } from '@/contexts/PwaContext';

/**
 * InstallPrompt Component
 * 
 * Shows a bottom drawer prompting users to install the PWA.
 * Consumes the PwaContext for state management.
 */
export default function InstallPrompt() {
    const theme = useTheme();
    const {
        showInstallPrompt,
        isIOSSafari,
        triggerInstall,
        dismissInstallPrompt
    } = usePwa();

    if (!showInstallPrompt) return null;

    return (
        <Drawer
            anchor="bottom"
            open={showInstallPrompt}
            onClose={dismissInstallPrompt}
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
                    onClick={dismissInstallPrompt}
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

                {isIOSSafari ? (
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
                            onClick={dismissInstallPrompt}
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
                        onClick={triggerInstall}
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
                {!isIOSSafari && (
                    <Button
                        fullWidth
                        variant="text"
                        onClick={dismissInstallPrompt}
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
