'use client';
import React, { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import NextLink from 'next/link';
import {
  AppBar,
  Toolbar,
  Box,
  IconButton,
  Avatar,
  InputBase,
  Badge,
  useTheme,
  useMediaQuery,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Menu,
  MenuItem,
  ClickAwayListener,
  Breadcrumbs,
  Link,
  Typography,
  Container,
  Paper,
  ListItemAvatar,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  Home,
  HomeOutlined,
  Search,
  Explore,
  ExploreOutlined,
  Movie,
  MovieOutlined,
  Send,
  SendOutlined,
  FavoriteBorder,
  AddBox,
  Menu as MenuIcon,
  Logout,
  Settings,
  DarkMode,
  LightMode,
  Person,
  Kitchen,
  KitchenOutlined,
  ArrowBack,
  Edit,
  Delete,
  MoreVert,
  PersonAdd,
  ChatBubbleOutline,
  Star,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeMode } from '@/contexts/ThemeContext';
import { BRANDING } from '@/config/branding';
import SearchResults from './SearchResults';
import { formatDistanceToNow } from 'date-fns';

const MotionIconButton = motion(IconButton);

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

export default function Navigation() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallDesktop = useMediaQuery(theme.breakpoints.down('lg'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, token } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const [activeTab, setActiveTab] = useState('home');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mounted, setMounted] = useState(false);

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>({ users: [], recipes: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Notification states
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsAnchorEl, setNotificationsAnchorEl] = useState<null | HTMLElement>(null);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [markingAsRead, setMarkingAsRead] = useState(false);

  const navItems = [
    { id: 'home', icon: HomeOutlined, activeIcon: Home, label: 'Home' },
    { id: 'search', icon: Search, activeIcon: Search, label: 'Search' },
    { id: 'explore', icon: ExploreOutlined, activeIcon: Explore, label: 'Explore' },
    { id: 'pantry', icon: KitchenOutlined, activeIcon: Kitchen, label: 'Pantry' },
    { id: 'messages', icon: SendOutlined, activeIcon: Send, label: 'Messages' },
  ];

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);

    // Navigate to the appropriate route
    switch (tabId) {
      case 'home':
        router.push('/');
        break;
      case 'pantry':
        router.push('/pantry');
        break;
      case 'explore':
        // TODO: Add explore page
        break;
      case 'messages':
        // TODO: Add messages page
        break;
      case 'search':
        // Search is handled by the search input
        break;
      default:
        break;
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleMenuClose();
    router.push('/auth?tab=register');
  };

  // Set mounted to true on client to prevent hydration mismatches
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update active tab based on current pathname
  useEffect(() => {
    if (pathname === '/') {
      setActiveTab('home');
    } else if (pathname.startsWith('/pantry')) {
      setActiveTab('pantry');
    } else if (pathname.startsWith('/explore')) {
      setActiveTab('explore');
    } else if (pathname.startsWith('/messages')) {
      setActiveTab('messages');
    }
  }, [pathname]);

  // Fetch notification count and notifications
  const fetchNotifications = async () => {
    if (!token) {
      console.log('Navigation: No token, skipping notification fetch');
      return;
    }

    console.log('Navigation: Fetching notifications...');
    try {
      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('Navigation: Notifications response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Navigation: Notifications data:', data);
        console.log('Navigation: Setting unread count to:', data.unreadCount || 0);

        // Deduplicate notifications by ID to prevent duplicate key warnings
        const notificationsArray = data.notifications || [];
        const uniqueNotifications = Array.from(
          new Map(notificationsArray.map((n: Notification) => [n.id, n])).values()
        );

        setNotifications(uniqueNotifications);
        setUnreadNotifications(data.unreadCount || 0);
      } else {
        console.error('Navigation: Failed to fetch notifications, status:', response.status);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);

    return () => clearInterval(interval);
  }, [token]);

  // Search functionality
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      setShowSearchResults(true);
      setSearchLoading(true);

      // Debounce search
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
          if (response.ok) {
            const data = await response.json();
            setSearchResults(data);
          }
        } catch (error) {
          console.error('Search error:', error);
        } finally {
          setSearchLoading(false);
        }
      }, 300);
    } else {
      setShowSearchResults(false);
      setSearchResults({ users: [], recipes: [] });
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleCloseSearch = () => {
    setShowSearchResults(false);
    setSearchQuery('');
  };

  // Notification handlers
  const handleNotificationsOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationsAnchorEl(event.currentTarget);
  };

  const handleNotificationsClose = () => {
    setNotificationsAnchorEl(null);
  };

  const markAllAsRead = async () => {
    if (!token || markingAsRead) return;

    try {
      setMarkingAsRead(true);
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((notif) => ({ ...notif, isRead: true }))
        );
        setUnreadNotifications(0);
      }
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    } finally {
      setMarkingAsRead(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'follow':
        return <PersonAdd color="primary" />;
      case 'like':
        return <FavoriteBorder color="error" />;
      case 'comment':
        return <ChatBubbleOutline color="info" />;
      case 'rating':
        return <Star sx={{ color: 'warning.main' }} />;
      default:
        return null;
    }
  };

  const getNotificationText = (notification: Notification) => {
    const senderName = notification.sender.fullName || notification.sender.username;

    switch (notification.type) {
      case 'follow':
        return `${senderName} started following you`;
      case 'like':
        return `${senderName} liked your recipe`;
      case 'comment':
        return `${senderName} commented on your recipe`;
      case 'rating':
        return `${senderName} rated your recipe`;
      default:
        return 'You have a new notification';
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    handleNotificationsClose();
    if (notification.type === 'follow') {
      router.push(`/profile/${notification.sender.username}`);
    } else if (notification.postId) {
      router.push(`/recipe/${notification.postId}`);
    }
  };

  // Generate breadcrumbs based on current pathname
  const generateBreadcrumbs = () => {
    const pathSegments = pathname.split('/').filter((segment) => segment !== '');

    const breadcrumbs = [
      { label: 'Home', href: '/' }
    ];

    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;

      // Capitalize and format segment
      let label = segment.charAt(0).toUpperCase() + segment.slice(1);

      // Custom labels for specific routes
      if (segment === 'pantry') label = 'My Pantry';
      if (segment === 'profile') label = 'Profile';
      if (segment === 'recipe') label = 'Recipe';
      if (segment === 'settings') label = 'Settings';

      // For dynamic segments (like IDs), keep them short or fetch title if available
      if (segment.match(/^[0-9a-f-]{36}$/)) {
        label = 'Details';
      }

      breadcrumbs.push({
        label,
        href: currentPath,
      });
    });

    return breadcrumbs;
  };

  const renderDesktopNav = () => {
    const breadcrumbs = generateBreadcrumbs();

    // Determine if we're on a detail page (e.g., /recipe/[id])
    const isDetailPage = pathname.match(/^\/(recipe)\/[^/]+$/);
    const isRecipePage = pathname.startsWith('/recipe/');

    // Pages that need an Up button (profile pages excluded)
    const needsUpButton = pathname === '/pantry' || pathname === '/settings' || isDetailPage;

    // Use browser back for navigation
    const handleBackClick = () => {
      router.back();
    };

    // Show breadcrumbs on detail pages to make hierarchy tangible
    const showBreadcrumbs = needsUpButton;

    return (
      <AppBar
        position="fixed"
        sx={{
          backgroundColor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
          boxShadow: 'none',
        }}
      >
        <Toolbar sx={{
          justifyContent: 'space-between',
          maxWidth: { xs: '100%', md: '935px', lg: '1200px' },
          width: '100%',
          margin: '0 auto',
          px: { xs: 1, sm: 2, md: 3 }
        }}>
          {/* Left Side - Logo (always visible) with optional Up button */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
            {needsUpButton && (
              <IconButton
                onClick={handleBackClick}
                edge="start"
                sx={{ mr: 0.5 }}
                aria-label="Navigate back"
                size={isSmallDesktop ? 'small' : 'medium'}
              >
                <ArrowBack />
              </IconButton>
            )}
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
                    color: BRANDING.colors.primary,
                    cursor: 'pointer',
                    display: { xs: isSmallDesktop ? 'none' : 'block', lg: 'block' }
                  }}
                  onClick={() => router.push('/')}
                >
                  {BRANDING.name}
                </Box>
              </Box>
            </motion.div>
          </Box>

          {/* Search Bar */}
          <ClickAwayListener onClickAway={handleCloseSearch}>
            <Box sx={{
              position: 'relative',
              minWidth: { xs: 0, sm: 150, md: 200, lg: 300 },
              maxWidth: { xs: 'none', md: 400 },
              flex: { xs: 0, sm: '0 1 auto', md: 1 },
              mx: { xs: 0, sm: 1, md: 2 }
            }}>
              <Box
                sx={{
                  backgroundColor: 'background.default',
                  borderRadius: 2,
                  px: { xs: 1, sm: 1.5, md: 2 },
                  py: { xs: 0.5, sm: 0.75, md: 1 },
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Search sx={{ color: 'text.secondary', mr: { xs: 0.5, md: 1 }, fontSize: { xs: '1.25rem', md: '1.5rem' } }} />
                <InputBase
                  placeholder={isSmallDesktop ? "Search..." : "Search recipes or users..."}
                  value={searchQuery}
                  onChange={handleSearchChange}
                  sx={{
                    flex: 1,
                    fontSize: { xs: '0.875rem', md: '1rem' },
                    '& input::placeholder': {
                      fontSize: { xs: '0.875rem', md: '1rem' }
                    }
                  }}
                />
              </Box>
              {showSearchResults && (
                <SearchResults
                  query={searchQuery}
                  users={searchResults.users}
                  recipes={searchResults.recipes}
                  loading={searchLoading}
                  onClose={handleCloseSearch}
                />
              )}
            </Box>
          </ClickAwayListener>

          {/* Right Icons */}
          <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1, md: 2 }, alignItems: 'center' }}>
            {navItems.map((item) => {
              const Icon = activeTab === item.id ? item.activeIcon : item.icon;
              return (
                <MotionIconButton
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  size={isSmallDesktop ? 'small' : 'medium'}
                  sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                >
                  <Icon sx={{
                    color: activeTab === item.id ? 'text.primary' : 'text.secondary',
                    fontSize: { sm: '1.25rem', md: '1.5rem' }
                  }} />
                </MotionIconButton>
              );
            })}
            <MotionIconButton
              onClick={handleNotificationsOpen}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              size={isSmallDesktop ? 'small' : 'medium'}
            >
              <Badge badgeContent={unreadNotifications} color="error">
                <FavoriteBorder sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }} />
              </Badge>
            </MotionIconButton>
            <MotionIconButton
              onClick={handleMenuOpen}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              size={isSmallDesktop ? 'small' : 'medium'}
            >
              <Avatar sx={{ width: { xs: 20, md: 24 }, height: { xs: 20, md: 24 } }} src={user?.avatar || '/avatar.jpg'}>
                {user?.username?.charAt(0).toUpperCase()}
              </Avatar>
            </MotionIconButton>
          </Box>
        </Toolbar>
      </AppBar>
    );
  };

  const handleProfileClick = () => {
    if (user?.username) {
      router.push(`/profile/${user.username}`);
    }
    handleMenuClose();
  };

  const renderMenu = () => (
    <>
      {/* User Profile Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem disabled>
          <strong>@{user?.username}</strong>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleProfileClick}>
          <ListItemIcon>
            <Person fontSize="small" />
          </ListItemIcon>
          Profile
        </MenuItem>
        <MenuItem onClick={() => { router.push('/settings'); handleMenuClose(); }}>
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          Settings
        </MenuItem>
        <MenuItem onClick={() => { toggleTheme(); handleMenuClose(); }}>
          <ListItemIcon>
            {mode === 'dark' ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
          </ListItemIcon>
          {mode === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>

      {/* Notifications Dropdown Menu */}
      <Menu
      anchorEl={notificationsAnchorEl}
      open={Boolean(notificationsAnchorEl)}
      onClose={handleNotificationsClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      slotProps={{
        paper: {
          sx: {
            mt: 1.5,
            maxHeight: { xs: '70vh', sm: 500, md: 400 },
            width: { xs: 'calc(100vw - 32px)', sm: 400, md: 360 },
            maxWidth: { xs: 'calc(100vw - 32px)', sm: 400 },
            overflow: 'auto',
          },
        },
      }}
    >
      <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Notifications
        </Typography>
        {unreadNotifications > 0 && (
          <Button
            size="small"
            onClick={markAllAsRead}
            disabled={markingAsRead}
            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
          >
            {markingAsRead ? 'Marking...' : 'Mark all read'}
          </Button>
        )}
      </Box>

      {notifications.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No notifications yet
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            When someone follows you or interacts with your recipes, you'll see it here
          </Typography>
        </Box>
      ) : (
        <List sx={{ p: 0 }}>
          {notifications.slice(0, 10).map((notification, index) => (
            <React.Fragment key={notification.id}>
              <ListItemButton
                onClick={() => handleNotificationClick(notification)}
                sx={{
                  bgcolor: notification.isRead ? 'transparent' : 'action.hover',
                  '&:hover': {
                    bgcolor: 'action.selected',
                  },
                  transition: 'background-color 0.2s',
                  alignItems: 'flex-start',
                  py: 1.5,
                }}
              >
                <ListItemAvatar>
                  <Avatar
                    src={notification.sender.avatar || undefined}
                    alt={notification.sender.username}
                    sx={{ width: 40, height: 40 }}
                  >
                    {notification.sender.username.charAt(0).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {getNotificationIcon(notification.type)}
                      <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                        {getNotificationText(notification)}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    mounted ? (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                        })}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                        {new Date(notification.createdAt).toLocaleDateString()}
                      </Typography>
                    )
                  }
                />
              </ListItemButton>
              {index < notifications.length - 1 && <Divider variant="inset" component="li" />}
            </React.Fragment>
          ))}
        </List>
      )}

      {notifications.length > 10 && (
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', p: 1, textAlign: 'center' }}>
          <Button
            fullWidth
            size="small"
            onClick={() => {
              handleNotificationsClose();
              router.push('/notifications');
            }}
            sx={{ textTransform: 'none' }}
          >
            View all notifications
          </Button>
        </Box>
      )}
    </Menu>
    </>
  );

  const renderMobileNav = () => (
    <>
      <AppBar
        position="fixed"
        sx={{
          backgroundColor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
          boxShadow: 'none',
        }}
      >
        <Toolbar sx={{ px: { xs: 1, sm: 2 }, minHeight: { xs: 56, sm: 64 } }}>
          <IconButton edge="start" onClick={() => setDrawerOpen(true)} size="small">
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 0.5, sm: 1 } }}>
            <Box
              component="img"
              src={BRANDING.logo}
              alt={BRANDING.name}
              sx={{ height: { xs: 24, sm: 28 }, width: { xs: 24, sm: 28 } }}
            />
            <Box
              sx={{
                fontFamily: BRANDING.font,
                fontSize: { xs: '16px', sm: '20px' },
                fontWeight: 600,
                color: BRANDING.colors.primary,
              }}
            >
              {BRANDING.name}
            </Box>
          </Box>
          <IconButton onClick={handleNotificationsOpen} size="small">
            <Badge badgeContent={unreadNotifications} color="error">
              <FavoriteBorder sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
            </Badge>
          </IconButton>
        </Toolbar>
      </AppBar>

      <AppBar
        position="fixed"
        sx={{
          top: 'auto',
          bottom: 0,
          backgroundColor: 'background.paper',
          color: 'text.primary',
          borderTop: 1,
          borderColor: 'divider',
          boxShadow: 'none',
        }}
      >
        <Toolbar sx={{
          justifyContent: 'space-around',
          minHeight: { xs: 56, sm: 64 },
          px: { xs: 0.5, sm: 2 }
        }}>
          {navItems.map((item) => {
            const Icon = activeTab === item.id ? item.activeIcon : item.icon;
            return (
              <MotionIconButton
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                whileTap={{ scale: 0.9 }}
                size="small"
                sx={{ p: { xs: 0.5, sm: 1 } }}
              >
                <Icon sx={{
                  color: activeTab === item.id ? 'text.primary' : 'text.secondary',
                  fontSize: { xs: '1.25rem', sm: '1.5rem' }
                }} />
              </MotionIconButton>
            );
          })}
          <MotionIconButton
            whileTap={{ scale: 0.9 }}
            size="small"
            sx={{ p: { xs: 0.5, sm: 1 } }}
            onClick={handleProfileClick}
          >
            <Avatar sx={{ width: { xs: 20, sm: 24 }, height: { xs: 20, sm: 24 } }} src={user?.avatar || '/avatar.jpg'}>
              {user?.username?.charAt(0).toUpperCase()}
            </Avatar>
          </MotionIconButton>
        </Toolbar>
      </AppBar>

      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: { xs: 280, sm: 320 } }} role="presentation">
          <List>
            <ListItem sx={{ py: 2 }}>
              <ListItemIcon>
                <Avatar
                  src={user?.avatar || '/avatar.jpg'}
                  sx={{ width: { xs: 40, sm: 48 }, height: { xs: 40, sm: 48 } }}
                >
                  {user?.username?.charAt(0).toUpperCase()}
                </Avatar>
              </ListItemIcon>
              <ListItemText
                primary={user?.username || 'Your Profile'}
                secondary={`@${user?.username || 'username'}`}
                primaryTypographyProps={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}
                secondaryTypographyProps={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
              />
            </ListItem>
            <Divider />
            {navItems.map((item) => (
              <ListItemButton
                key={item.id}
                onClick={() => {
                  handleTabClick(item.id);
                  setDrawerOpen(false);
                }}
                sx={{ py: { xs: 1.5, sm: 2 } }}
              >
                <ListItemIcon>
                  <item.icon sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }} />
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}
                />
              </ListItemButton>
            ))}
            <Divider />
            <ListItemButton
              onClick={() => {
                router.push('/settings');
                setDrawerOpen(false);
              }}
              sx={{ py: { xs: 1.5, sm: 2 } }}
            >
              <ListItemIcon>
                <Settings sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }} />
              </ListItemIcon>
              <ListItemText
                primary="Settings"
                primaryTypographyProps={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}
              />
            </ListItemButton>
            <ListItemButton
              onClick={() => {
                toggleTheme();
                setDrawerOpen(false);
              }}
              sx={{ py: { xs: 1.5, sm: 2 } }}
            >
              <ListItemIcon>
                {mode === 'dark' ? <LightMode sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }} /> : <DarkMode sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }} />}
              </ListItemIcon>
              <ListItemText
                primary={mode === 'dark' ? 'Light Mode' : 'Dark Mode'}
                primaryTypographyProps={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}
              />
            </ListItemButton>
            <ListItemButton
              onClick={() => {
                handleLogout();
                setDrawerOpen(false);
              }}
              sx={{ py: { xs: 1.5, sm: 2 } }}
            >
              <ListItemIcon>
                <Logout sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }} />
              </ListItemIcon>
              <ListItemText
                primary="Logout"
                primaryTypographyProps={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}
              />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>
    </>
  );

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <>
        {renderDesktopNav()}
        {renderMenu()}
      </>
    );
  }

  return (
    <>
      {isMobile ? renderMobileNav() : renderDesktopNav()}
      {renderMenu()}
    </>
  );
}
