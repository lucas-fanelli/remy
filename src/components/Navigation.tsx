'use client';
import {
  Home,
  HomeOutlined,
  Search,
  FavoriteBorder,
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
import { motion } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { BRANDING } from '@/config/branding';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeMode } from '@/contexts/ThemeContext';
import { CreateRecipeDTO } from '@/domain/types/recipe';
import { useCreateRecipe } from '@/hooks/useCreateRecipe';
import { useNotificationPolling } from '@/hooks/useNotificationPolling';
import SlideUp from './common/SlideUp';
import CreateRecipeDialog from './navigation/CreateRecipeDialog';
import DesktopMenu from './navigation/DesktopMenu';
import MobileBottomNav from './navigation/MobileBottomNav';
import MobileDrawer from './navigation/MobileDrawer';
import NotificationDropdown from './navigation/NotificationDropdown';
import PersistentSearchBar from './search/PersistentSearchBar';

interface Notification {
  id: string;
  type: 'follow' | 'like' | 'comment' | 'rating';
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

const desktopNavItems = [
  { id: 'home', icon: HomeOutlined, activeIcon: Home, label: 'Home' },
  { id: 'pantry', icon: KitchenOutlined, activeIcon: Kitchen, label: 'Pantry' },
  { id: 'add', icon: AddBox, activeIcon: AddBox, label: 'Create Recipe' },
];

const mobileNavItems = [
  { id: 'home', icon: HomeOutlined, activeIcon: Home, label: 'Home' },
  { id: 'search', icon: Search, activeIcon: Search, label: 'Search' },
  { id: 'add', icon: AddBox, activeIcon: AddBox, label: 'Add' },
  { id: 'pantry', icon: KitchenOutlined, activeIcon: Kitchen, label: 'Pantry' },
];

export default function Navigation() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallDesktop = useMediaQuery(theme.breakpoints.down('lg'));
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isAdmin } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const createRecipe = useCreateRecipe(() => router.refresh());
  const [activeTab, setActiveTab] = useState('home');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mounted, setMounted] = useState(false);

  const {
    notifications,
    unreadCount: unreadNotifications,
    fetchNotifications: _fetchNotifications,
    markAllAsRead,
    markingAsRead,
    isPollingPaused,
    retryNow,
    setNotifications,
    setUnreadCount: setUnreadNotifications,
  } = useNotificationPolling({ user, onAuthInvalid: logout });
  const [notificationsAnchorEl, setNotificationsAnchorEl] = useState<null | HTMLElement>(null);

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [createRecipeOpen, setCreateRecipeOpen] = useState(false);
  const [logoutWarning, setLogoutWarning] = useState(false);

  // Listen for failed logout cookie clear to show a user-facing warning
  useEffect(() => {
    const handler = () => setLogoutWarning(true);
    window.addEventListener('auth:logout-failed', handler);
    return () => window.removeEventListener('auth:logout-failed', handler);
  }, []);

  const handleTabClick = (tabId: string) => {
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
      case 'add':
        if (!user) {
          router.push('/auth');
          return;
        }
        setCreateRecipeOpen(true);
        break;
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleLogout = () => {
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
      try {
        const response = await fetch(`/api/notifications/${notification.id}`, {
          method: 'PATCH',
          headers: { 'X-Requested-With': 'fetch' },
        });
        if (response.ok) {
          setNotifications((prev) =>
            prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
          );
          setUnreadNotifications((prev) => Math.max(0, prev - 1));
        }
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }
    if (notification.type === 'follow') {
      router.push(`/profile/${notification.sender.username}`);
    } else if (notification.postId) {
      router.push(`/recipe/${notification.postId}`);
    }
  };

  const handleCreateRecipe = async (data: CreateRecipeDTO) => {
    await createRecipe(data);
    setCreateRecipeOpen(false);
    router.push('/');
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
                src={BRANDING.logo}
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
            placeholder={isSmallDesktop ? 'Search...' : 'Search recipes, ingredients...'}
            showSuggestions={true}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1, md: 2 }, alignItems: 'center' }}>
          {desktopNavItems.map((item) => {
            const Icon = activeTab === item.id ? item.activeIcon : item.icon;
            return (
              <motion.div key={item.id} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <IconButton
                  onClick={() => handleTabClick(item.id)}
                  size={isSmallDesktop ? 'small' : 'medium'}
                  sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                >
                  <Icon
                    sx={{
                      color: activeTab === item.id ? 'text.primary' : 'text.secondary',
                      fontSize: { sm: '1.25rem', md: '1.5rem' },
                    }}
                  />
                </IconButton>
              </motion.div>
            );
          })}
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
            <Tooltip title={isPollingPaused ? 'Notifications temporarily paused' : ''}>
              <IconButton
                onClick={handleNotificationsOpen}
                size={isSmallDesktop ? 'small' : 'medium'}
              >
                <Badge badgeContent={unreadNotifications} color="error">
                  <FavoriteBorder
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
              Retry
            </Typography>
          )}
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
            <IconButton onClick={handleMenuOpen} size={isSmallDesktop ? 'small' : 'medium'}>
              <Avatar
                sx={{ width: { xs: 20, md: 24 }, height: { xs: 20, md: 24 } }}
                src={user?.avatar || undefined}
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
            mobileNavItems={mobileNavItems}
            onTabClick={handleTabClick}
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
              aria-label="close"
            >
              <Close />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
              Search
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
              placeholder="Search recipes, ingredients..."
              showSuggestions={true}
              onResultClick={() => setMobileSearchOpen(false)}
            />
          </Box>
        </Box>
      </Dialog>

      <CreateRecipeDialog
        open={createRecipeOpen}
        onClose={() => setCreateRecipeOpen(false)}
        onSubmit={handleCreateRecipe}
      />

      {/* Warning shown when server-side logout cookie clear fails */}
      <Snackbar
        open={logoutWarning}
        autoHideDuration={8000}
        onClose={() => setLogoutWarning(false)}
      >
        <Alert severity="warning" onClose={() => setLogoutWarning(false)}>
          Could not fully sign out. Your session may persist until the cookie expires.
        </Alert>
      </Snackbar>
    </>
  );
}
