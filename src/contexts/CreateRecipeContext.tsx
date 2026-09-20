'use client';
import { useRouter } from 'next/navigation';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import CreateRecipeDialog from '@/components/navigation/CreateRecipeDialog';
import { useAuth } from '@/contexts/AuthContext';

/**
 * ONE 'New recipe' dialog for the whole app and ONE handler for every entry point (desktop
 * AppBar, mobile bottom nav, mobile drawer, feed button, empty-feed button, return from
 * login). The provider owns the only mount, so two instances can never edit the same draft.
 */

export interface CreateRecipeContextValue {
  /**
   * Opens the editor. A visitor who is not logged in goes to the login page first, with a
   * FIXED token - never a URL - that the auth page maps back to this call after login.
   */
  openCreate: () => void;
}

/** `/auth?next=create`: the only value of `next` the auth page understands */
export const CREATE_INTENT = 'create';
export const CREATE_LOGIN_HREF = `/auth?next=${CREATE_INTENT}`;

// Outside the provider (an isolated component test, a page rendered on its own) the entry
// points simply do nothing
const FALLBACK: CreateRecipeContextValue = { openCreate: () => undefined };

const CreateRecipeContext = createContext<CreateRecipeContextValue>(FALLBACK);

export function CreateRecipeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const [isCreateOpen, setCreateOpen] = useState(false);

  const openCreate = useCallback(() => {
    if (!user) {
      router.push(CREATE_LOGIN_HREF);
      return;
    }
    setCreateOpen(true);
  }, [user, router]);

  const closeCreate = useCallback(() => setCreateOpen(false), []);

  // Only the handler: whether the dialog is open is nobody else's business, and keeping it
  // out of the value keeps the navigation and the feed from rendering again on every toggle
  const value = useMemo(() => ({ openCreate }), [openCreate]);

  return (
    <CreateRecipeContext.Provider value={value}>
      {children}
      <CreateRecipeDialog open={isCreateOpen} onClose={closeCreate} />
    </CreateRecipeContext.Provider>
  );
}

export function useCreateRecipeDialog(): CreateRecipeContextValue {
  return useContext(CreateRecipeContext);
}
