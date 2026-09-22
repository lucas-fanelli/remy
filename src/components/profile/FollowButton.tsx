'use client';
import { Button } from '@mui/material';
import { useTranslations } from 'next-intl';
import React, { useState } from 'react';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { followActionFor, type FollowAction } from '@/lib/follows/client/followAction';
import type { FollowState } from '@/domain/types/follow';

export interface FollowButtonProps {
  /** Where the viewer stands. A signed-out reader is 'none': the caller sends them to sign in. */
  state: FollowState;
  /** Decides what "Seguir" does — follow at once, or send a request — and whether unfollowing asks first. */
  isPrivate: boolean;
  /** Who, as the confirmation names them: "¿Dejar de seguir a {name}?" */
  name: string;
  /** What the tap means, already confirmed where it needed to be. */
  onAction: (action: FollowAction) => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const LABEL = {
  none: 'actions.follow',
  requested: 'actions.requested',
  following: 'actions.following',
} as const;

/**
 * "Seguir", "Solicitado" or "Siguiendo" — one button for every place that follows people:
 * the profile header and both people lists.
 *
 * - 'none' is the call to action, so it is the only filled one. On a private account it
 *   sends a request rather than following.
 * - 'requested' taps to take the request back; 'following' taps to unfollow. Neither asks
 *   first, with one exception: unfollowing a PRIVATE account. That one locks its recipes
 *   again, and getting them back is not another tap but another request the owner has to
 *   accept — so it is said before it happens, as Instagram does. Cancelling a request loses
 *   nothing, and a public account can be followed again with one tap.
 *
 * The button is not keyed on the state, unlike the one it replaces. A key remounts it on
 * every change, and the remount throws keyboard focus back to the page: a reader who
 * pressed Enter on "Seguir" was left nowhere. Kept mounted, focus stays on it and the new
 * label is its new name.
 *
 * The accessible name is the visible label, so what a voice-control user says is what they
 * see. Whose button it is comes from the row or header it sits in.
 */
export default function FollowButton({
  state,
  isPrivate,
  name,
  onAction,
  disabled = false,
  size = 'small',
}: FollowButtonProps) {
  const t = useTranslations('profile');
  const [confirming, setConfirming] = useState(false);

  const handleClick = () => {
    const action = followActionFor(state, isPrivate);
    if (action === 'unfollow' && isPrivate) {
      setConfirming(true);
      return;
    }
    onAction(action);
  };

  const confirmUnfollow = () => {
    setConfirming(false);
    // Asked about a follow that has since ended — undone in another tab, or the owner
    // removed the reader — there is nothing left to unfollow.
    if (state === 'following') onAction('unfollow');
  };

  return (
    <>
      <Button
        variant={state === 'none' ? 'contained' : 'outlined'}
        size={size}
        onClick={handleClick}
        disabled={disabled}
        // A floor under the width, so the three labels — which differ by a few letters —
        // do not nudge the row around each time one replaces another under the finger.
        sx={{ minWidth: 100, transition: 'all 0.2s ease-in-out' }}
      >
        {t(LABEL[state])}
      </Button>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={confirmUnfollow}
        title={t('unfollowPrivate.title', { name })}
        message={t('unfollowPrivate.body')}
        confirmText={t('unfollowPrivate.confirm')}
        confirmColor="error"
      />
    </>
  );
}
