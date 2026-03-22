'use client';
import { useState, useCallback, useEffect, useRef } from 'react';

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

interface UseNotificationPollingOptions {
  /** Whether the user is logged in (polling only runs when truthy) */
  user: { id: string } | null;
  /** Called when the polling detects a confirmed 401 */
  onAuthInvalid: () => void;
}

interface UseNotificationPollingReturn {
  notifications: Notification[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markingAsRead: boolean;
  isPollingPaused: boolean;
  retryNow: () => void;
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
}

export function useNotificationPolling({
  user,
  onAuthInvalid,
}: UseNotificationPollingOptions): UseNotificationPollingReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const markingAsReadRef = useRef(false);
  const [markingAsRead, setMarkingAsRead] = useState(false);
  const [isPollingPaused, setIsPollingPaused] = useState(false);

  const failureTimestampsRef = useRef<number[]>([]);
  const pollingStoppedRef = useRef(false);
  const lastFailureTimeRef = useRef(0);
  const breakerTrippedAtRef = useRef(0);
  const breakerTripCountRef = useRef(0);

  // Prevent state updates after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // AbortController ref so polling cleanup can cancel in-flight fetches
  const notificationAbortRef = useRef<AbortController | null>(null);

  // AbortController ref for the /api/auth/me confirmation request
  const meAbortRef = useRef<AbortController | null>(null);

  // Guard against overlapping fetches (e.g. rapid visibility changes)
  const isFetchingRef = useRef(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    // Abort any previous in-flight fetch
    notificationAbortRef.current?.abort();
    const controller = new AbortController();
    notificationAbortRef.current = controller;

    isFetchingRef.current = true;
    try {
      const response = await fetch('/api/notifications', {
        signal: controller.signal,
      });

      // Defensive check for when fetch returns undefined (e.g., in tests)
      if (!response) return;

      if (response.ok) {
        // Clear failure timestamps and unpause on success so backoff resets immediately
        failureTimestampsRef.current = [];
        pollingStoppedRef.current = false;
        if (breakerTripCountRef.current > 0) breakerTripCountRef.current = 0;
        setIsPollingPaused(false);
        const data = await response.json();

        // Deduplicate notifications by ID to prevent duplicate key warnings
        const notificationsArray = Array.isArray(data?.notifications) ? data.notifications : [];
        const uniqueNotifications = Array.from(
          new Map(notificationsArray.map((n: Notification) => [n.id, n])).values()
        ) as Notification[];

        if (!isMountedRef.current) return;
        setNotifications(uniqueNotifications);
        setUnreadCount(data.unreadCount || 0);
      } else if (response.status === 401) {
        // Confirm auth is truly invalid before destroying session.
        // Use a separate AbortController so aborting the notification controller
        // (e.g., on unmount) doesn't cancel this confirmation request.
        const meController = new AbortController();
        meAbortRef.current = meController;
        try {
          const meResp = await fetch('/api/auth/me', { signal: meController.signal });
          if (meResp.status === 401 && isMountedRef.current) {
            pollingStoppedRef.current = true;
            setIsPollingPaused(true);
            onAuthInvalid();
          } else if (!meResp.ok) {
            // Non-auth server error — treat as transient
            failureTimestampsRef.current.push(Date.now());
          }
        } catch {
          if (!isMountedRef.current) return;
          pollingStoppedRef.current = true;
          setIsPollingPaused(true);
          // Network error during auth confirmation — don't logout, just pause
        }
        return;
      } else {
        const now = Date.now();
        failureTimestampsRef.current.push(now);
        if (failureTimestampsRef.current.length > 20) {
          failureTimestampsRef.current = failureTimestampsRef.current.slice(-20);
        }
        // Only keep last 10 minutes of failure timestamps (sliding window)
        const tenMinAgo = now - 10 * 60 * 1000;
        failureTimestampsRef.current = failureTimestampsRef.current.filter((t) => t > tenMinAgo);
        lastFailureTimeRef.current = now;
        // Trip circuit breaker if 10+ failures in the sliding window
        if (failureTimestampsRef.current.length >= 10) {
          breakerTripCountRef.current = Math.min(breakerTripCountRef.current + 1, 10);
          pollingStoppedRef.current = true;
          if (!isMountedRef.current) return;
          setIsPollingPaused(true);
          breakerTrippedAtRef.current = Date.now();
        }
        console.error('Navigation: Failed to fetch notifications, status:', response.status);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      const now = Date.now();
      failureTimestampsRef.current.push(now);
      if (failureTimestampsRef.current.length > 20) {
        failureTimestampsRef.current = failureTimestampsRef.current.slice(-20);
      }
      const tenMinAgo = now - 10 * 60 * 1000;
      failureTimestampsRef.current = failureTimestampsRef.current.filter((t) => t > tenMinAgo);
      lastFailureTimeRef.current = now;
      if (failureTimestampsRef.current.length >= 10) {
        breakerTripCountRef.current = Math.min(breakerTripCountRef.current + 1, 10);
        pollingStoppedRef.current = true;
        if (!isMountedRef.current) return;
        setIsPollingPaused(true);
        breakerTrippedAtRef.current = Date.now();
      }
      console.error('Error fetching notifications:', error);
    } finally {
      // Always reset — isFetchingRef is a ref (not state), safe to set after abort
      isFetchingRef.current = false;
    }
  }, [user, onAuthInvalid]);

  // Polling effect with exponential backoff, visibility handling, and circuit breaker
  useEffect(() => {
    if (!user) return;

    const BASE_INTERVAL = 60_000; // 60s
    const MAX_INTERVAL = 5 * 60_000; // 5min cap

    let cancelled = false;

    // Clear previous user's data and reset backoff on login/user change
    setNotifications([]);
    setUnreadCount(0);
    failureTimestampsRef.current = [];
    pollingStoppedRef.current = false;
    breakerTrippedAtRef.current = 0;
    breakerTripCountRef.current = 0;
    setIsPollingPaused(false);
    if (!cancelled) fetchNotifications();

    const polling = { timeoutId: null as ReturnType<typeof setTimeout> | null };
    let visibilityTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const clearPolling = () => {
      if (polling.timeoutId) {
        clearTimeout(polling.timeoutId);
        polling.timeoutId = null;
      }
    };

    const scheduleNext = () => {
      if (cancelled) return;
      if (pollingStoppedRef.current) {
        // Exponential backoff cooldown: 5min * 2^(tripCount-1), capped at 30min.
        // tripCount is capped at 10 (see breaker trip code above), which would yield
        // 5min * 2^9 = 2560min, but the Math.min caps it at 30min. The tripCount cap
        // prevents unbounded growth if the breaker trips repeatedly.
        const cooldownMs = Math.min(
          5 * 60 * 1000 * Math.pow(2, breakerTripCountRef.current - 1),
          30 * 60 * 1000
        );
        if (Date.now() - breakerTrippedAtRef.current > cooldownMs) {
          // Auto-reset breaker after cooldown
          pollingStoppedRef.current = false;
          failureTimestampsRef.current = [];
          setIsPollingPaused(false);
        } else {
          return;
        }
      }
      clearPolling();
      const jitter = Math.random() * BASE_INTERVAL * 0.5;
      const backoffMs = Math.min(
        BASE_INTERVAL * (failureTimestampsRef.current.length + 1) + jitter,
        MAX_INTERVAL
      );
      polling.timeoutId = setTimeout(async () => {
        if (isFetchingRef.current) {
          scheduleNext();
          return;
        }
        await fetchNotifications();
        scheduleNext();
      }, backoffMs);
    };

    scheduleNext();

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearPolling();
        if (visibilityTimeoutId) {
          clearTimeout(visibilityTimeoutId);
          visibilityTimeoutId = null;
        }
      } else {
        // Guard: skip if unmounted or polling explicitly stopped
        if (!isMountedRef.current || pollingStoppedRef.current) return;

        // Clear any pending visibility timeout to prevent double-fetch on rapid tab switching
        if (visibilityTimeoutId) {
          clearTimeout(visibilityTimeoutId);
          visibilityTimeoutId = null;
        }
        if (!pollingStoppedRef.current) {
          // Normal case: breaker is not tripped, refresh on tab focus.
          // Failure timestamps are only cleared on successful fetch, not on visibility change.
          if (!isFetchingRef.current) {
            clearPolling();
            const jitter = Math.random() * 3000;
            visibilityTimeoutId = setTimeout(() => {
              visibilityTimeoutId = null;
              if (!isMountedRef.current) return;
              fetchNotifications();
              scheduleNext();
            }, jitter);
          }
        }
        // If breaker is tripped, let scheduleNext handle the 5-minute cooldown
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      clearPolling();
      if (visibilityTimeoutId) {
        clearTimeout(visibilityTimeoutId);
        visibilityTimeoutId = null;
      }
      notificationAbortRef.current?.abort();
      meAbortRef.current?.abort();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user, fetchNotifications]);

  const markAllAsRead = useCallback(async () => {
    if (!user || markingAsReadRef.current) return;

    try {
      markingAsReadRef.current = true;
      setMarkingAsRead(true);
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'X-Requested-With': 'fetch' },
      });

      if (response.ok) {
        setNotifications((prev) => prev.map((notif) => ({ ...notif, isRead: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    } finally {
      markingAsReadRef.current = false;
      setMarkingAsRead(false);
    }
  }, [user]);

  const retryNow = useCallback(() => {
    pollingStoppedRef.current = false;
    failureTimestampsRef.current = [];
    setIsPollingPaused(false);
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    fetchNotifications,
    markAllAsRead,
    markingAsRead,
    isPollingPaused,
    retryNow,
    setNotifications,
    setUnreadCount,
  };
}
