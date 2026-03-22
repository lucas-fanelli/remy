'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function useAdminGuard() {
  const router = useRouter();
  const { user, isAdmin, isLoading } = useAuth();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin) && !redirectedRef.current) {
      redirectedRef.current = true;
      router.push('/');
    }
  }, [user, isAdmin, isLoading, router]);

  return { isReady: !isLoading && isAdmin, isLoading };
}
