'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';

interface User {
  id: string;
  username: string;
  fullName: string | null;
  avatar: string | null;
  bio: string | null;
  location?: string;
  website?: string;
  createdAt: string;
}

interface Recipe {
  id: string;
  title: string;
  imageUrl: string;
  difficulty: string;
  likesCount: number;
  commentsCount: number;
}

interface ProfileStats {
  recipesCount: number;
  followersCount: number;
  followingCount: number;
}

// Fetch user profile
async function fetchProfile(username: string): Promise<User> {
  const response = await fetch(`/api/users/${username}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('User not found');
    }
    throw new Error('Failed to load profile');
  }

  const data = await response.json();
  // Handle different response formats
  return data.user || data.data?.user || data;
}

export function useProfile(username: string) {
  return useQuery({
    queryKey: ['profile', username],
    queryFn: () => fetchProfile(username),
    placeholderData: keepPreviousData, // Keep old profile visible while loading new one
    enabled: !!username,
    staleTime: 60 * 1000, // 1 minute
  });
}

// Fetch profile stats
async function fetchProfileStats(username: string): Promise<ProfileStats> {
  const response = await fetch(`/api/users/${username}/stats`);

  if (!response.ok) {
    return { recipesCount: 0, followersCount: 0, followingCount: 0 };
  }

  return response.json();
}

export function useProfileStats(username: string) {
  return useQuery({
    queryKey: ['profile-stats', username],
    queryFn: () => fetchProfileStats(username),
    enabled: !!username,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Fetch user's recipes
async function fetchUserRecipes(username: string): Promise<Recipe[]> {
  const response = await fetch(`/api/users/${username}/recipes`);

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.recipes || [];
}

export function useUserRecipes(username: string) {
  return useQuery({
    queryKey: ['user-recipes', username],
    queryFn: () => fetchUserRecipes(username),
    enabled: !!username,
    staleTime: 60 * 1000, // 1 minute
  });
}

// Fetch saved recipes (for own profile)
async function fetchSavedRecipes(username: string, token: string | null): Promise<Recipe[]> {
  if (!token) return [];

  const response = await fetch(`/api/users/${username}/saved`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.recipes || [];
}

export function useSavedRecipes(username: string, token: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['saved-recipes', username, token],
    queryFn: () => fetchSavedRecipes(username, token),
    enabled: !!username && !!token && enabled,
    staleTime: 60 * 1000, // 1 minute
  });
}

// Check following status
async function fetchFollowingStatus(username: string, token: string | null): Promise<boolean> {
  if (!token) return false;

  const response = await fetch(`/api/users/${username}/is-following`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return false;

  const data = await response.json();
  return data.isFollowing;
}

export function useFollowingStatus(
  username: string,
  token: string | null,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['following-status', username, token],
    queryFn: () => fetchFollowingStatus(username, token),
    enabled: !!username && !!token && enabled,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export type { User, Recipe, ProfileStats };
