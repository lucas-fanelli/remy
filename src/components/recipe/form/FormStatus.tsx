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
import { useTranslations } from 'next-intl';
import React, { useEffect, useId, useRef, useState } from 'react';
import { text, useTextDescriptor } from '@/i18n/text';
import { MAX_DAILY_RECIPES } from '@/lib/constants';
import { RecipeSubmitError, RecipeSubmitErrorCode } from '@/lib/errors/RecipeSubmitError';
import { attentionColor } from './formTokens';
import { RecipeFieldPath, RecipeFormMode, RecipeFormSection, RecipeIssue } from './types';
import type { RecipeFormApi } from './useRecipeForm';
import type { TextDescriptor } from '@/i18n/text';

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
   * Nothing keeps this recipe on the device (`useRecipeDraft().saveFailed`, or a session with
   * no draft of its own): no message may say 'saved as a draft' then
   */
  draftFailed?: boolean;
  /**
   * Bump it on every failed Publish so 'N things to fix' is announced again, once per
   * event. Without it the alert is announced only when `publishAttempted` turns true.
   */
  attempt?: number;
  /**
   * Runs when [Log in again] is activated, before the link navigates. A shell that is a
   * dialog closes itself here: a dialog owned by the layout would stay on top of the login
   * form. `event.preventDefault()` keeps the link from navigating - the shell that has to
   * ask before work is lost goes to `loginHref(mode)` itself once the author has answered
   */
  onLogin?: (event: React.MouseEvent<HTMLElement>) => void;
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

interface SubmitErrorView {
  message: TextDescriptor;
  /** The API's own sentence, shown instead of `message` when it sent one */
  serverMessage?: string;
  action?: 'login' | 'retry';
}

/** Create comes back to 'New recipe' and its draft; Edit has nothing stored */
export const loginHref = (mode: RecipeFormMode): string =>
  mode === 'create' ? '/auth?next=create' : '/auth';

interface SubmitErrorContext {
  mode: RecipeFormMode;
  hasIssues: boolean;
  isDirty: boolean;
  draftFailed: boolean;
}

// [Log in again] leaves the editor. Only a stored draft survives that: Edit has none, and
// neither has Create on a device that could not write one - the copy never says otherwise
const sessionExpiredMessage = ({
  mode,
  isDirty,
  draftFailed,
}: SubmitErrorContext): TextDescriptor => {
  if (mode === 'edit') {
    return isDirty
      ? text('recipeForm.submit.sessionExpiredEditDirty')
      : text('recipeForm.submit.sessionExpiredEdit');
  }
  return draftFailed
    ? text('recipeForm.submit.sessionExpiredDraftFailed')
    : text('recipeForm.submit.sessionExpired');
};

// Anything that is not a typed error (a thrown TypeError...) reads as 'could not reach'
const codeOf = (error: unknown): RecipeSubmitErrorCode =>
  error instanceof RecipeSubmitError ? error.code : 'server';

const toSubmitErrorView = (
  code: RecipeSubmitErrorCode,
  error: unknown,
  context: SubmitErrorContext
): SubmitErrorView | null => {
  switch (code) {
    case 'unauthorized':
      return { message: sessionExpiredMessage(context), action: 'login' };
    case 'daily_limit':
      return {
        message: context.draftFailed
          ? text('recipeForm.submit.dailyLimitDraftFailed', { max: MAX_DAILY_RECIPES })
          : text('recipeForm.submit.dailyLimit', { max: MAX_DAILY_RECIPES }),
      };
    case 'rate_limited': {
      const seconds = error instanceof RecipeSubmitError ? error.retryAfter : undefined;
      return {
        message: seconds
          ? text('recipeForm.submit.rateLimitedMinutes', { minutes: Math.ceil(seconds / 60) })
          : text('recipeForm.submit.rateLimited'),
      };
    }
    case 'validation': {
      // The shell re-ran validate(): the fields say what is wrong. The SERVER's own sentence
      // is the only fallback for a rule the client does not know - and the only text here
      // this module does not write itself, so it is the only one it does not translate
      if (context.hasIssues) return null;
      const sent =
        error instanceof RecipeSubmitError && error.fromServer ? error.message : undefined;
      return { message: text('recipeForm.submit.rejected'), serverMessage: sent };
    }
    default:
      return { message: text('recipeForm.submit.unreachable'), action: 'retry' };
  }
};

function DraftSavedNote({ savedAt }: { savedAt: number }) {
  const t = useTranslations('recipeForm');
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
      {t('status.draftSaved')}
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
  draftFailed = false,
  attempt = 0,
  onLogin,
  id,
  sx,
}: FormStatusProps) {
  const t = useTranslations('recipeForm');
  const tCommon = useTranslations('common');
  const renderText = useTextDescriptor();
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

  const errorContext = { mode, hasIssues: issueCount > 0, isDirty, draftFailed };
  let errorView: SubmitErrorView | null = null;
  if (sessionExpired) {
    errorView = toSubmitErrorView('unauthorized', null, errorContext);
  } else if (submitError != null) {
    errorView = toSubmitErrorView(codeOf(submitError), submitError, errorContext);
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

  const thingsToFix = (count: number) => t('status.thingsToFix', { count });

  /** 'Missing: cover photo, cook time' - a list of nouns, never a glued-together sentence */
  const missingLabel = (): string => {
    if (issues.length > NAMED_ISSUES_MAX) return t('status.missingCount', { count: issues.length });
    const labels = Array.from(new Set(issues.map((issue) => renderText(issue.label))));
    return t('status.missingNamed', { count: labels.length, labels: labels.join(', ') });
  };

  const renderLine = (): React.ReactNode => {
    if (waiting) {
      return (
        <Box sx={lineSx}>
          <CloudUpload fontSize="small" sx={{ color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">
            {t('status.waitingPhotos', { count: uploadsInFlight })}
          </Typography>
        </Box>
      );
    }
    if (resting) {
      return (
        <Typography variant="body2" color="text.secondary">
          {t('status.startWithTitle')}
        </Typography>
      );
    }
    if (issueCount === 0 && mode === 'edit' && !isDirty) {
      return (
        <Typography variant="body2" color="text.secondary">
          {t('status.noChanges')}
        </Typography>
      );
    }
    // Only reached with nothing missing: with issues the line is the menu button
    return (
      <Box sx={lineSx}>
        <CheckCircle fontSize="small" sx={{ color: 'success.main' }} />
        <Typography variant="body2" color="text.primary">
          {t('status.ready', { mode })}
        </Typography>
      </Box>
    );
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
              {errorView.serverMessage ?? renderText(errorView.message)}
            </Typography>
            {errorView.action === 'login' && (
              <Button component={NextLink} href={loginHref(mode)} size="small" onClick={onLogin}>
                {t('status.logInAgain')}
              </Button>
            )}
            {errorView.action === 'retry' && onRetry && (
              <Button type="button" size="small" onClick={onRetry}>
                {tCommon('actions.tryAgain')}
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
                {publishAttempted ? thingsToFix(issueCount) : missingLabel()}
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
                  key={`${issue.path}:${issue.message.key}`}
                  onClick={() => handleChoose(issue)}
                  sx={{ whiteSpace: 'normal' }}
                >
                  {renderText(issue.message)}
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
