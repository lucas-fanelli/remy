# Motion Architecture Plan

## Overview

This document defines the technical architecture for page transitions in the Remy's Recipe app. There are **two distinct transition scenarios** that require different animation strategies.

---

## Scenario A: Home Feed → Recipe Detail

### Description
When a user clicks on a **Recipe Card** in the Home Feed, the card's image should **expand and morph** into the Recipe Detail page header. This creates a "Shared Element" or "Hero Transition" effect.

### User Experience
1. User sees recipe cards in the feed
2. User taps on a card
3. The card's **image smoothly scales up** and repositions to become the detail page header
4. Other elements (title, description) fade in around the image
5. Navigation back reverses the animation - the header shrinks back into the card

### Technical Requirements

#### Entry Point: RecipeCard Component
- Must provide a unique `layoutId` to the image element
- Must use `framer-motion`'s `motion.div` with `layoutId` for the image container
- Must share state with the destination page

#### Destination: Recipe Detail Page
- Must receive and use the **same `layoutId`** on the header image container
- Must be wrapped in `AnimatePresence` at the layout level
- Must use `motion.img` or `motion.div` for the header image

#### Shared State Requirements
- Need a **Motion Context** or similar to:
  - Track which recipe is being animated
  - Store the source card's `layoutId`
  - Know the entry point for conditional animations

### Implementation Strategy

```tsx
// Context to track animation source
interface MotionContextValue {
  sourceType: 'feed' | 'search' | null;
  recipeId: string | null;
  layoutId: string | null;
}

// In RecipeCard.tsx
<motion.div layoutId={`recipe-image-${recipe.id}`}>
  <img src={recipe.imageUrl} />
</motion.div>

// In RecipeDetail page
<motion.div layoutId={`recipe-image-${recipe.id}`}>
  <img src={recipe.imageUrl} />
</motion.div>
```

### Key Files to Modify
- `src/components/recipe/RecipeCard.tsx` - Add `layoutId` to image
- `src/app/recipe/[id]/page.tsx` - Add matching `layoutId` to header
- `src/app/template.tsx` - Wrap with `AnimatePresence`
- `src/contexts/MotionContext.tsx` - NEW: Track animation source

---

## Scenario B: Search Dropdown → Recipe Detail

### Description
When a user clicks on a recipe result in the **Search Dropdown**, there is **no shared image** to animate from. The transition should be a simple **fade/slide** instead.

### User Experience
1. User types in search bar
2. Live results appear in dropdown
3. User clicks on a recipe result
4. Current view **fades out**
5. Recipe detail page **fades/slides in**
6. No shared element animation

### Technical Requirements

#### Entry Point: PersistentSearchBar Component
- Does NOT have a full recipe image to animate
- Only has an icon/emoji and text
- Sets `sourceType: 'search'` in Motion Context

#### Destination: Recipe Detail Page
- Detects that `sourceType === 'search'`
- **Skips** the `layoutId` animation
- Uses a simple fade/slide animation instead

### Implementation Strategy

```tsx
// In PersistentSearchBar when clicking a recipe result
const handleRecipeClick = (recipeId: string) => {
  motionContext.setSource('search', recipeId, null); // No layoutId
  router.push(`/recipe/${recipeId}`);
};

// In RecipeDetail page
const { sourceType, layoutId } = useMotionContext();

// Conditional rendering based on source
{sourceType === 'feed' && layoutId ? (
  <motion.div layoutId={layoutId}>
    <img src={recipe.imageUrl} />
  </motion.div>
) : (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <img src={recipe.imageUrl} />
  </motion.div>
)}
```

---

## Technical Architecture

### Next.js App Router Integration

#### Option 1: template.tsx (Recommended)
- `template.tsx` re-renders on every navigation
- Wrap children with `AnimatePresence`
- Suitable for page-level transitions

```tsx
// src/app/template.tsx
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div key={usePathname()}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

#### Option 2: Layout Context
- Use a context to track navigation state
- More control but more complexity
- Needed for shared element animations

### Motion Context Design

```tsx
// src/contexts/MotionContext.tsx
interface MotionContextValue {
  // Source of navigation
  sourceType: 'feed' | 'search' | 'direct' | null;
  
  // Recipe being animated
  recipeId: string | null;
  
  // Layout ID for shared element animation
  layoutId: string | null;
  
  // Methods
  setSource: (type: 'feed' | 'search', recipeId: string, layoutId?: string) => void;
  clearSource: () => void;
}
```

---

## Animation Specifications

### Shared Element (Scenario A)
| Property | Value |
|----------|-------|
| Duration | 0.4s |
| Easing | spring(stiffness: 400, damping: 30) |
| Image Scale | Card (200px) → Header (100vw) |
| Position | In-place transform |

### Fade/Slide (Scenario B)
| Property | Value |
|----------|-------|
| Duration | 0.3s |
| Easing | easeOut |
| Initial | opacity: 0, y: 20px |
| Animate | opacity: 1, y: 0 |

---

## Implementation Order

### Phase 1: Motion Context
1. Create `src/contexts/MotionContext.tsx`
2. Add provider to `template.tsx` or root layout
3. Export hooks for easy access

### Phase 2: Scenario B (Search → Recipe)
1. Update `PersistentSearchBar` to set source on click
2. Update recipe detail page to read source
3. Implement fade/slide animation
4. Test and verify

### Phase 3: Scenario A (Feed → Recipe)
1. Add `layoutId` to `RecipeCard.tsx` image
2. Add matching `layoutId` to recipe detail header
3. Implement conditional animation based on source
4. Test shared element transition
5. Handle back navigation

### Phase 4: Polish
1. Add loading states during transition
2. Handle edge cases (fast clicks, navigation interrupts)
3. Performance optimization
4. Accessibility (respect `prefers-reduced-motion`)

---

## Risks and Considerations

### Performance
- Shared element animations can be expensive
- May need to disable on low-power devices
- Consider using `will-change` CSS property

### SSR Compatibility
- `layoutId` requires client-side hydration
- May see brief layout shift on initial load
- Use `useLayoutEffect` carefully

### Browser Support
- Modern browsers only
- Need fallback for Safari issues with layout animations

### State Management
- Motion context must persist across navigations
- Clear state on unrelated navigations
- Handle browser back/forward buttons

---

## Success Criteria

- [ ] Clicking recipe card in feed triggers smooth image expansion
- [ ] Clicking recipe in search triggers fade/slide (no shared element)
- [ ] Back navigation reverses animations appropriately
- [ ] No visual glitches or layout shifts
- [ ] Works on mobile and desktop
- [ ] Respects `prefers-reduced-motion`

---

## Summary

| Scenario | Entry Point | Animation Type | Shared Element |
|----------|-------------|----------------|----------------|
| A | Home Feed RecipeCard | Layout Animation | YES - Image |
| B | Search Dropdown | Fade/Slide | NO |

**DO NOT implement until this plan is approved.**
