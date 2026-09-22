'use client';
import {
  Home,
  HomeOutlined,
  Search,
  NotificationsNone,
  AddBox,
  Kitchen,
  KitchenOutlined,
  Close,
} from '@mui/icons-material';
import {
  AppBar,
  Toolbar,
  Box,
  IconButton,
  Avatar,
  Badge,
  Tooltip,
  useTheme,
  useMediaQuery,
  Typography,
  Dialog,
  Snackbar,
  Alert,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BRANDING } from '@/config/branding';
import { useBrandLogo } from '@/config/useBrandLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateRecipeDialog } from '@/contexts/CreateRecipeContext';
import { useThemeMode } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { applyNotificationsToCache, type NotificationNews } from '@/hooks/notificationsToCache';
import { FOLLOW_REQUESTS_PATH, afterRequestAccepted } from '@/hooks/useFollowRequests';
import { useNotificationPolling } from '@/hooks/useNotificationPolling';
import { useApiErrorMessage } from '@/lib/api/translateApiError';
import { cloudinaryImage } from '@/lib/utils/cloudinary';
import SlideUp from './common/SlideUp';
import DesktopMenu from './navigation/DesktopMenu';
import MobileBottomNav from './navigation/MobileBottomNav';
import MobileDrawer from './navigation/MobileDrawer';
import NotificationDropdown from './navigation/NotificationDropdown';
import { clearRecipeDraft, recipeDraftKey } from './recipe/form/useRecipeDraft';
import PersistentSearchBar from './search/PersistentSearchBar';
import type { NotificationType } from '@/domain/types/notification';

interface Notification {
  id: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  sender: {
    id: string;
    username: string;
    fullName: string | null;
    avatar: string | null;
  };
  postId?: string | null;
  commentId?: string | null;
}

// The labels are not here any more: each item's `id` IS its key under nav.items, and the
// ids are a closed union, which is the one case where a key may be built from a variable.
const DESKTOP_NAV_ITEMS = [
  { id: 'home', icon: HomeOutlined, activeIcon: Home },
  { id: 'pantry', icon: KitchenOutlined, activeIcon: Kitchen },
  { id: 'add', icon: AddBox, activeIcon: AddBox },
] as const;

const MOBILE_NAV_ITEMS = [
  { id: 'home', icon: HomeOutlined, activeIcon: Home },
  { id: 'search', icon: Search, activeIcon: Search },
  { id: 'add', icon: AddBox, activeIcon: AddBox },
  { id: 'pantry', icon: KitchenOutlined, activeIcon: Kitchen },
] as const;

export default function Navigation() {
  const brandLogo = useBrandLogo();
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const tNotifications = useTranslations('notifications');
  const apiErrorMessage = useApiErrorMessage();
  const { showError } = useToast();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallDesktop = useMediaQuery(theme.breakpoints.down('lg'));
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, logout, isAdmin } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const { openCreate } = useCreateRecipeDialog();
  const [activeTab, setActiveTab] = useState('home');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mounted, setMounted] = useState(false);

  const {
    notifications,
    unreadCount: unreadNotifications,
    pendingRequestsCount,
    fetchNotifications: _fetchNotifications,
    markAllAsRead,
    markingAsRead,
    isPollingPaused,
    retryNow,
    setNotifications,
    setUnreadCount: setUnreadNotifications,
  } = useNotificationPolling({
    user,
    onAuthInvalid: logout,
    // The hook reports; this decides what the app says. Before this the rejection was
    // swallowed and every dot stayed put with nothing said.
    onMarkAllFailed: useCallback(
      (body: unknown) => showError(apiErrorMessage(body, tNotifications('markAllFailed'))),
      [showError, apiErrorMessage, tNotifications]
    ),
    // What other people did, reaching the screens it changed: see notificationsToCache.
    onNewNotifications: useCallback(
      (fresh: NotificationNews[]) => applyNotificationsToCache(queryClient, fresh, user?.username),
      [queryClient, user?.username]
    ),
  });
  const [notificationsAnchorEl, setNotificationsAnchorEl] = useState<null | HTMLElement>(null);

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [logoutWarning, setLogoutWarning] = useState(false);

  const desktopNavItems = useMemo(
    () => DESKTOP_NAV_ITEMS.map((item) => ({ ...item, label: t(`items.${item.id}`) })),
    [t]
  );
  const mobileNavItems = useMemo(
    () => MOBILE_NAV_ITEMS.map((item) => ({ ...item, label: t(`items.${item.id}`) })),
    [t]
  );

  // Listen for failed logout cookie clear to show a user-facing warning
  useEffect(() => {
    const handler = () => setLogoutWarning(true);
    window.addEventListener('auth:logout-failed', handler);
    return () => window.removeEventListener('auth:logout-failed', handler);
  }, []);

  const handleTabClick = (tabId: string) => {
    // 'New recipe' opens a dialog over the current page: it is not a place to be "on", so
    // it never becomes the active tab (the icon would stay highlighted after closing)
    if (tabId === 'add') {
      openCreate();
      return;
    }
    setActiveTab(tabId);
    switch (tabId) {
      case 'home':
        router.push('/');
        break;
      case 'pantry':
        router.push('/pantry');
        break;
      case 'search':
        if (isMobile) setMobileSearchOpen(true);
        break;
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleLogout = () => {
    // A deliberate logout takes the recipe draft with it. The silent one (notification
    // polling finding the session gone) keeps it: the editor then says 'saved as a draft'
    if (user) clearRecipeDraft(recipeDraftKey(user.id));
    logout();
    handleMenuClose();
    router.push('/auth?tab=register');
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (pathname === '/') setActiveTab('home');
    else if (pathname.startsWith('/pantry')) setActiveTab('pantry');
  }, [pathname]);

  const handleNotificationsOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationsAnchorEl(event.currentTarget);
  };
  const handleNotificationsClose = () => setNotificationsAnchorEl(null);

  const handleNotificationClick = async (notification: Notification) => {
    handleNotificationsClose();
    if (!notification.isRead && user) {
      // Best effort, and deliberately quiet: the reader is navigating away, so a message
      // about it would land on the page they just left. What this does NOT do any more is
      // disagree with the notifications page, which marks its own copy read regardless of
      // the answer — one screen showed the dot gone and the other showed it still there
      // for the same failure. If the write really did fail the dot returns on the next
      // poll, which is the honest outcome and self-correcting.
      try {
        await fetch(`/api/notifications/${notification.id}`, {
          method: 'PATCH',
          headers: { 'X-Requested-With': 'fetch' },
        });
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
      setUnreadNotifications((prev) => Math.max(0, prev - 1));
    }
    // /notifications routes the same way; the two lists open the same rows.
    if (notification.type === 'follow_request') {
      // The inbox, where requests are answered. Never buttons on this row: it is a button.
      router.push(FOLLOW_REQUESTS_PATH);
    } else if (notification.type === 'follow' || notification.type === 'follow_accepted') {
      // An accepted request opens a profile the cache last saw locked: see afterRequestAccepted.
      if (notification.type === 'follow_accepted') {
        afterRequestAccepted(queryClient, notification.sender.username, user?.username);
      }
      router.push(`/profile/${notification.sender.username}`);
    } else if (notification.postId) {
      router.push(`/recipe/${notification.postId}`);
    }
  };

  const handleProfileClick = () => {
    if (user?.username) router.push(`/profile/${user.username}`);
    else router.push('/auth');
    handleMenuClose();
  };

  const handleNavigate = (path: string) => router.push(path);

  const renderDesktopNav = () => (
    <AppBar
      position="fixed"
      sx={{
        backgroundColor: (theme) => theme.palette.background.paper,
        color: 'text.primary',
        borderBottom: 1,
        borderColor: 'divider',
        boxShadow: 'none',
      }}
    >
      <Toolbar
        sx={{
          justifyContent: 'space-between',
          maxWidth: { xs: '100%', md: '935px', lg: '1200px' },
          width: '100%',
          margin: '0 auto',
          px: { xs: 1, sm: 2, md: 3 },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1, md: 1.5 } }}>
              <Box
                component="img"
                src={brandLogo}
                alt={BRANDING.name}
                sx={{
                  height: { xs: 36, sm: 40, md: 48 },
                  width: { xs: 36, sm: 40, md: 48 },
                  cursor: 'pointer',
                }}
                onClick={() => router.push('/')}
              />
              <Box
                sx={{
                  fontFamily: BRANDING.font,
                  fontSize: { xs: '18px', sm: '20px', md: '24px' },
                  fontWeight: 600,
                  color: (theme) =>
                    theme.palette.mode === 'dark'
                      ? theme.palette.primary.main
                      : BRANDING.colors.primary,
                  cursor: 'pointer',
                  display: { xs: isSmallDesktop ? 'none' : 'block', lg: 'block' },
                }}
                onClick={() => router.push('/')}
              >
                {BRANDING.name}
              </Box>
            </Box>
          </motion.div>
        </Box>

        <Box
          sx={{
            position: 'relative',
            flex: { xs: 0, sm: '0 1 auto', md: 1 },
            mx: { xs: 0, sm: 1, md: 2 },
            maxWidth: 500,
            display: { xs: 'none', md: 'block' },
          }}
        >
          <PersistentSearchBar
            placeholder={isSmallDesktop ? t('search.placeholderShort') : t('search.placeholder')}
            showSuggestions={true}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1, md: 2 }, alignItems: 'center' }}>
          {desktopNavItems.map((item) => {
            const Icon = activeTab === item.id ? item.activeIcon : item.icon;
            return (
              <motion.div key={item.id} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <Tooltip title={item.label}>
                  <IconButton
                    onClick={() => handleTabClick(item.id)}
                    size={isSmallDesktop ? 'small' : 'medium'}
                    aria-label={item.label}
                    sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                  >
                    <Icon
                      sx={{
                        color: activeTab === item.id ? 'text.primary' : 'text.secondary',
                        fontSize: { sm: '1.25rem', md: '1.5rem' },
                      }}
                    />
                  </IconButton>
                </Tooltip>
              </motion.div>
            );
          })}
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
            <Tooltip title={isPollingPaused ? t('notificationsPaused') : ''}>
              <IconButton
                onClick={handleNotificationsOpen}
                size={isSmallDesktop ? 'small' : 'medium'}
                // The mobile bar already names this button; the desktop one had only a
                // conditional tooltip, so a screen reader announced nothing at all
                aria-label={t('menu.notifications')}
              >
                <Badge badgeContent={unreadNotifications} color="error">
                  {/* A bell, not a heart: the outlined heart means "like" on every card,
                      so the same glyph was carrying three meanings in one screen */}
                  <NotificationsNone
                    sx={{
                      fontSize: { xs: '1.25rem', md: '1.5rem' },
                      opacity: isPollingPaused ? 0.5 : 1,
                    }}
                  />
                </Badge>
              </IconButton>
            </Tooltip>
          </motion.div>
          {isPollingPaused && (
            <Typography
              variant="caption"
              sx={{
                cursor: 'pointer',
                color: 'primary.main',
                fontWeight: 600,
                '&:hover': { textDecoration: 'underline' },
              }}
              onClick={retryNow}
            >
              {tCommon('actions.retry')}
            </Typography>
          )}
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
            <IconButton onClick={handleMenuOpen} size={isSmallDesktop ? 'small' : 'medium'}>
              <Avatar
                sx={{ width: { xs: 20, md: 24 }, height: { xs: 20, md: 24 } }}
                src={cloudinaryImage(user?.avatar, 'avatar') || undefined}
              >
                {user?.username?.charAt(0).toUpperCase()}
              </Avatar>
            </IconButton>
          </motion.div>
        </Box>
      </Toolbar>
    </AppBar>
  );

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <>
        {renderDesktopNav()}
        <DesktopMenu
          anchorEl={anchorEl}
          onClose={handleMenuClose}
          user={user}
          isAdmin={isAdmin}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
        <NotificationDropdown
          anchorEl={notificationsAnchorEl}
          onClose={handleNotificationsClose}
          notifications={notifications}
          unreadCount={unreadNotifications}
          pendingRequestsCount={pendingRequestsCount}
          markAllAsRead={markAllAsRead}
          markingAsRead={markingAsRead}
          mounted={mounted}
          onNotificationClick={handleNotificationClick}
        />
      </>
    );
  }

  return (
    <>
      {isMobile ? (
        <>
          <MobileBottomNav
            activeTab={activeTab}
            mobileNavItems={mobileNavItems}
            user={user}
            unreadNotifications={unreadNotifications}
            onTabClick={handleTabClick}
            onProfileClick={handleProfileClick}
            onDrawerOpen={() => setDrawerOpen(true)}
            onNotificationsOpen={handleNotificationsOpen}
            onNavigateHome={() => router.push('/')}
          />
          <MobileDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            user={user}
            isAdmin={isAdmin}
            mode={mode}
            onToggleTheme={toggleTheme}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        </>
      ) : (
        renderDesktopNav()
      )}

      <DesktopMenu
        anchorEl={anchorEl}
        onClose={handleMenuClose}
        user={user}
        isAdmin={isAdmin}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />
      <NotificationDropdown
        anchorEl={notificationsAnchorEl}
        onClose={handleNotificationsClose}
        notifications={notifications}
        unreadCount={unreadNotifications}
        pendingRequestsCount={pendingRequestsCount}
        markAllAsRead={markAllAsRead}
        markingAsRead={markingAsRead}
        mounted={mounted}
        onNotificationClick={handleNotificationClick}
      />

      {/* Mobile Search Dialog */}
      <Dialog
        fullScreen
        open={mobileSearchOpen}
        onClose={() => setMobileSearchOpen(false)}
        TransitionComponent={SlideUp}
      >
        <AppBar sx={{ position: 'relative' }}>
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => setMobileSearchOpen(false)}
              aria-label={tCommon('actions.close')}
            >
              <Close />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
              {t('search.title')}
            </Typography>
          </Toolbar>
        </AppBar>
        <Box sx={{ p: 2 }}>
          <Box
            sx={{
              backgroundColor: 'background.default',
              borderRadius: 2,
              px: 2,
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <PersistentSearchBar
              placeholder={t('search.placeholder')}
              showSuggestions={true}
              onResultClick={() => setMobileSearchOpen(false)}
            />
          </Box>
        </Box>
      </Dialog>

      {/* Warning shown when server-side logout cookie clear fails */}
      <Snackbar
        open={logoutWarning}
        autoHideDuration={8000}
        onClose={() => setLogoutWarning(false)}
      >
        <Alert severity="warning" onClose={() => setLogoutWarning(false)}>
          {t('logoutWarning')}
        </Alert>
      </Snackbar>
    </>
  );
}
