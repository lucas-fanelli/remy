'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

/**
 * Motion Context - Tracks navigation source for conditional page transitions
 * 
 * Scenario A (feed): Hero/shared element animation from recipe card image
 * Scenario B (search): Simple fade/slide animation
 */

type SourceType = 'feed' | 'search' | null;

interface MotionContextValue {
    // Navigation source
    sourceType: SourceType;

    // ID of the recipe being navigated to
    recipeId: string | null;

    // Layout ID for shared element animation (only used in 'feed' scenario)
    layoutId: string | null;

    // Set the navigation source before pushing to recipe detail
    setSource: (type: 'feed' | 'search', recipeId: string, layoutId?: string) => void;

    // Clear the source after animation completes or on unrelated navigation
    clearSource: () => void;
}

const MotionContext = createContext<MotionContextValue | undefined>(undefined);

interface MotionProviderProps {
    children: ReactNode;
}

export function MotionProvider({ children }: MotionProviderProps) {
    const [sourceType, setSourceType] = useState<SourceType>(null);
    const [recipeId, setRecipeId] = useState<string | null>(null);
    const [layoutId, setLayoutId] = useState<string | null>(null);

    const setSource = useCallback((type: 'feed' | 'search', id: string, lid?: string) => {
        setSourceType(type);
        setRecipeId(id);
        setLayoutId(lid || null);
    }, []);

    const clearSource = useCallback(() => {
        setSourceType(null);
        setRecipeId(null);
        setLayoutId(null);
    }, []);

    return (
        <MotionContext.Provider
            value={{
                sourceType,
                recipeId,
                layoutId,
                setSource,
                clearSource,
            }}
        >
            {children}
        </MotionContext.Provider>
    );
}

export function useMotionContext(): MotionContextValue {
    const context = useContext(MotionContext);
    if (!context) {
        // Return default values if used outside provider (graceful fallback)
        return {
            sourceType: null,
            recipeId: null,
            layoutId: null,
            setSource: () => { },
            clearSource: () => { },
        };
    }
    return context;
}
