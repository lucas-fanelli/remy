'use client';
import {
  CheckCircle,
  CloudUpload,
  ErrorOutline,
  InfoOutlined,
  KeyboardArrowUp,
} from '@mui/icons-material';
import { Box, Button, ButtonBase, Menu, MenuItem, Typography } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';
import NextLink from 'next/link';
import React, { useEffect, useId, useRef, useState } from 'react';
import { MAX_DAILY_RECIPES } from '@/lib/constants';
import { RecipeSubmitError, RecipeSubmitErrorCode } from '@/lib/errors/RecipeSubmitError';
import { attentionColor } from './formTokens';
import { RecipeFieldPath, RecipeFormMode, RecipeFormSection, RecipeIssue } from './types';
import type { RecipeFormApi } from './useRecipeForm';

/** 'Draft saved' stays in text.secondary for this long, then fades to text.disabled */
export const DRAFT_SAVED_FADE_MS = 2000;

/** Up to this many missing items are named ('Missing: cover photo, cook time') */
const NAMED_ISSUES_MAX = 2;

export type FormStatusForm = Pick<
  RecipeFormApi,
  'mode' | 'issues' | 'publishAttempted' | 'uploadsInFlight' | 'isDirty'
>;

export interface FormStatusProps {
  /** The RecipeFormApi (or the slice above) */
  form: FormStatusForm;
  /** The shell's jump: show `section`, then focus the control registered under `path` */
  goTo: (section: RecipeFormSection, path: RecipeFieldPath) => void;
  /** What the last Publish / Save rejected with (a RecipeSubmitError, or anything else) */
  submitError?: unknown;
  /** Renders [Try again] next to the 'Could not reach Remy' message */
  onRetry?: () => void;
  /** `useAuth().user` became null while the editor is open: same copy as a 401 */
  sessionExpired?: boolean;
  /** `useRecipeDraft().savedAt`: prints 'Draft saved' (polite) after every write */
  draftSavedAt?: number | null;
  /**
   * Bump it on every failed Publish so 'N things to fix' is announced again, once per
   * event. Without it the alert is announced only when `publishAttempted` turns true.
   */
  attempt?: number;
  /** Defaults to '/auth?next=create' (create) and '/auth' (edit) */
  loginHref?: string;
  /** Put it in the PublishButton's aria-describedby */
  id?: string;
  sx?: SxProps<Theme>;
}

const visuallyHidden = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: '1px',
  width: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
} as const;

const lineSx = { display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 } as const;

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

const thingsToFix = (count: number) => `${count} ${plural(count, 'thing', 'things')} to fix`;

const missingLabel = (issues: RecipeIssue[]): string => {
  if (issues.length > NAMED_ISSUES_MAX) return `Missing ${issues.length} things`;
  const labels = Array.from(new Set(issues.map((issue) => issue.label)));
  return `Missing: ${labels.join(', ')}`;
};

interface SubmitErrorView {
  message: string;
  action?: 'login' | 'retry';
}

// Anything that is not a typed error (a thrown TypeError...) reads as 'could not reach'
const codeOf = (error: unknown): RecipeSubmitErrorCode =>
  error instanceof RecipeSubmitError ? error.code : 'server';

const toSubmitErrorView = (
  code: RecipeSubmitErrorCode,
  error: unknown,
  mode: RecipeFormMode,
  hasIssues: boolean
): SubmitErrorView | null => {
  switch (code) {
    case 'unauthorized':
      return {
        message:
          mode === 'create'
            ? 'Your session expired. Your recipe is saved as a draft on this device.'
            : 'Your session expired. Log in again to save your changes.',
        action: 'login',
      };
    case 'daily_limit':
      return {
        message: `You have published ${MAX_DAILY_RECIPES} recipes in the last 24 hours. This one is saved as a draft - publish it tomorrow.`,
      };
    case 'rate_limited': {
      const seconds = error instanceof RecipeSubmitError ? error.retryAfter : undefined;
      const wait = seconds ? `${Math.ceil(seconds / 60)} min` : 'a minute';
      return { message: `Too many requests - try again in ${wait}` };
    }
    case 'validation':
      // The shell re-ran validate(): the fields say what is wrong. The server's own text is
      // only the fallback for a rule the client does not know
      if (hasIssues) return null;
      return {
        message:
          (error instanceof Error && error.message) || 'The recipe was rejected - check the fields',
      };
    default:
      return { message: 'Could not reach Remy. Nothing was lost.', action: 'retry' };
  }
};

function DraftSavedNote({ savedAt }: { savedAt: number }) {
  const [fresh, setFresh] = useState(true);

  useEffect(() => {
    setFresh(true);
    const timer = setTimeout(() => setFresh(false), DRAFT_SAVED_FADE_MS);
    return () => clearTimeout(timer);
  }, [savedAt]);

  return (
    <Typography
      role="status"
      variant="caption"
      sx={{
        flexShrink: 0,
        color: fresh ? 'text.secondary' : 'text.disabled',
        transition: (theme: Theme) => theme.transitions.create('color'),
      }}
    >
      Draft saved
    </Typography>
  );
}

/**
 * The ONE feedback channel while the recipe editor is open (no toasts inside it). Pin it
 * next to the PublishButton, outside the scrolling content. In the author's order:
 * a typed submit error (role=alert) > 'Waiting for N photos...' > 'N things to fix' after a
 * failed Publish (role=alert, once per event) > 'Missing: ...' > 'Ready to publish'.
 * While something is missing the whole line is a button that opens an upward menu with
 * one entry per issue; choosing one calls `goTo(section, path)`.
 */
export default function FormStatus({
  form,
  goTo,
  submitError,
  onRetry,
  sessionExpired = false,
  draftSavedAt,
  attempt = 0,
  loginHref,
  id,
  sx,
}: FormStatusProps) {
  const { mode, issues, publishAttempted, uploadsInFlight, isDirty } = form;
  const buttonId = useId();
  const menuId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [announced, setAnnounced] = useState<{ count: number; key: number } | null>(null);
  const pendingJump = useRef<RecipeIssue | null>(null);
  const goToRef = useRef(goTo);
  goToRef.current = goTo;
  const issueCount = issues.length;
  const issueCountRef = useRef(issueCount);
  issueCountRef.current = issueCount;

  let errorView: SubmitErrorView | null = null;
  if (sessionExpired) {
    errorView = toSubmitErrorView('unauthorized', null, mode, issueCount > 0);
  } else if (submitError != null) {
    errorView = toSubmitErrorView(codeOf(submitError), submitError, mode, issueCount > 0);
  }

  // A new failure is a new alert node, so the same sentence is announced again
  const errorKey = useRef(0);
  const lastError = useRef<unknown>(null);
  if (lastError.current !== submitError) {
    lastError.current = submitError;
    errorKey.current += 1;
  }

  const waiting = !errorView && uploadsInFlight > 0;
  const showIssues = !errorView && !waiting && issueCount > 0;
  const resting = showIssues && mode === 'create' && !isDirty && !publishAttempted;
  const showButton = showIssues && !resting;
  const menuOpen = Boolean(anchor) && showButton;

  // 'N things to fix' is announced once per failed Publish, not on every keystroke
  useEffect(() => {
    setAnnounced(
      publishAttempted && issueCountRef.current > 0
        ? { count: issueCountRef.current, key: attempt }
        : null
    );
  }, [publishAttempted, attempt]);

  // Once the author fixes (or breaks) something the announced count is history
  useEffect(() => {
    setAnnounced((current) => (current && current.count !== issueCount ? null : current));
  }, [issueCount]);

  // The button can leave while its menu is open (an upload finished, an error came in)
  useEffect(() => {
    if (!showButton) setAnchor(null);
  }, [showButton]);

  // The jump runs AFTER the menu has given the focus back to the button, otherwise the
  // menu's focus restore would steal the focus from the field the shell just focused
  useEffect(() => {
    if (menuOpen || !pendingJump.current) return;
    const issue = pendingJump.current;
    pendingJump.current = null;
    goToRef.current(issue.section, issue.path);
  }, [menuOpen]);

  const handleChoose = (issue: RecipeIssue) => {
    pendingJump.current = issue;
    setAnchor(null);
  };

  const renderLine = (): React.ReactNode => {
    if (waiting) {
      return (
        <Box sx={lineSx}>
          <CloudUpload fontSize="small" sx={{ color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">
            Waiting for {uploadsInFlight} {plural(uploadsInFlight, 'photo', 'photos')}...
          </Typography>
        </Box>
      );
    }
    if (resting) {
      return (
        <Typography variant="body2" color="text.secondary">
          Start with a title
        </Typography>
      );
    }
    if (issueCount === 0 && mode === 'edit' && !isDirty) {
      return (
        <Typography variant="body2" color="text.secondary">
          No changes yet
        </Typography>
      );
    }
    if (issueCount === 0) {
      return (
        <Box sx={lineSx}>
          <CheckCircle fontSize="small" sx={{ color: 'success.main' }} />
          <Typography variant="body2" color="text.primary">
            {mode === 'create' ? 'Ready to publish' : 'Ready to save'}
          </Typography>
        </Box>
      );
    }
    return null;
  };

  return (
    <Box
      id={id}
      sx={[
        { flex: '1 1 auto', minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
        {errorView && (
          <Box key={errorKey.current} role="alert" sx={{ ...lineSx, flexWrap: 'wrap' }}>
            <ErrorOutline fontSize="small" sx={{ color: 'error.main' }} />
            <Typography variant="body2" color="text.primary" sx={{ flex: '1 1 200px' }}>
              {errorView.message}
            </Typography>
            {errorView.action === 'login' && (
              <Button
                component={NextLink}
                href={loginHref ?? (mode === 'create' ? '/auth?next=create' : '/auth')}
                size="small"
              >
                Log in again
              </Button>
            )}
            {errorView.action === 'retry' && onRetry && (
              <Button type="button" size="small" onClick={onRetry}>
                Try again
              </Button>
            )}
          </Box>
        )}

        {/* Always mounted, so a change of state is announced politely */}
        <Box role="status">{!errorView && !showButton && renderLine()}</Box>

        {showButton && (
          <>
            <ButtonBase
              id={buttonId}
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen ? 'true' : undefined}
              aria-controls={menuOpen ? menuId : undefined}
              onClick={(event) => setAnchor(event.currentTarget)}
              sx={{
                ...lineSx,
                width: '100%',
                justifyContent: 'flex-start',
                textAlign: 'left',
                borderRadius: 1,
                px: 1,
                mx: -1,
                '&:hover': { bgcolor: 'action.hover' },
                '&:focus-visible': {
                  outline: '2px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: 2,
                },
              }}
            >
              {publishAttempted ? (
                <ErrorOutline fontSize="small" sx={{ color: 'error.main' }} />
              ) : (
                <InfoOutlined fontSize="small" sx={{ color: attentionColor }} />
              )}
              <Typography
                component="span"
                variant="body2"
                color="text.primary"
                noWrap
                sx={{ flex: '1 1 auto', minWidth: 0 }}
              >
                {publishAttempted ? thingsToFix(issueCount) : missingLabel(issues)}
              </Typography>
              <KeyboardArrowUp fontSize="small" sx={{ color: 'text.secondary' }} />
            </ButtonBase>
            <Menu
              id={menuId}
              anchorEl={anchor}
              open={menuOpen}
              onClose={() => setAnchor(null)}
              anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
              transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              MenuListProps={{ 'aria-labelledby': buttonId }}
              slotProps={{ paper: { sx: { maxWidth: 'calc(100vw - 32px)' } } }}
            >
              {issues.map((issue) => (
                <MenuItem
                  key={`${issue.path}:${issue.message}`}
                  onClick={() => handleChoose(issue)}
                  sx={{ whiteSpace: 'normal' }}
                >
                  {issue.message}
                </MenuItem>
              ))}
            </Menu>
          </>
        )}

        {showButton && announced !== null && (
          <Box key={announced.key} role="alert" sx={visuallyHidden}>
            {thingsToFix(announced.count)}
          </Box>
        )}
      </Box>

      {draftSavedAt != null && <DraftSavedNote savedAt={draftSavedAt} />}
    </Box>
  );
}
