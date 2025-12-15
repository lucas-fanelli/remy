'use client';

/**
 * Global Template - Passthrough
 * 
 * Animation is handled by individual pages after their data loads.
 * This allows deferred navigation to work:
 * 1. User clicks link
 * 2. loading.tsx returns null, keeping current page visible
 * 3. LoadingBar shows progress
 * 4. When data loads, new page renders with its own entrance animation
 */
export default function Template({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
