'use client';
import {
  ArrowForward,
  CheckCircle,
  ErrorOutline,
  Visibility,
  WarningAmber,
} from '@mui/icons-material';
import { Box, Button, Tab, Tabs, useTheme } from '@mui/material';
import { AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import FormDialog from '@/components/common/FormDialog';
import { MotionBox } from '@/components/motion';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Recipe } from '@/domain/types/recipe';
import { useCreateRecipe } from '@/hooks/useCreateRecipe';
import { useUpdateRecipe } from '@/hooks/useUpdateRecipe';
import { RecipeSubmitError } from '@/lib/errors/RecipeSubmitError';
import CheckTab from './CheckTab';
import DraftRestoredBar from './DraftRestoredBar';
import { fadeMotion } from './formMotion';
import FormStatus from './FormStatus';
import { attentionColor } from './formTokens';
import { isBlankIngredientRow } from './formValues';
import PublishButton from './PublishButton';
import RecipePreviewDialog from './RecipePreviewDialog';
import { toPayload } from './toPayload';
import { RecipeFieldPath, RecipeFormMode, RecipeFormSection } from './types';
import { useFieldRegistry } from './useFieldRegistry';
import {
  DraftStorage,
  RecipeDraft,
  useRecipeDraft,
  useUnsavedChangesWarning,
} from './useRecipeDraft';
import { useRecipeForm } from './useRecipeForm';
import { useTextCapture } from './useTextCapture';
import WriteTab from './WriteTab';
import type { ImageUploadHandle } from '@/components/common/ImageUpload';

export const RECIPE_EDITOR_TABS = ['write', 'check'] as const;
export type RecipeEditorTab = (typeof RECIPE_EDITOR_TABS)[number];

/** The title is written on 'Write'; every other field lives on the structured tab */
export const tabForPath = (path: RecipeFieldPath): RecipeEditorTab =>
  path === 'title' ? 'write' : 'check';

/** Where an [Edit] of the preview lands when it names a section but no field */
const FIRST_PATH: Record<RecipeFormSection, RecipeFieldPath> = {
  basics: 'title',
  ingredients: 'ingredients',
  steps: 'steps',
  presentation: 'imageUrl',
};

export const DRAFT_SAVED_TOAST = 'Draft saved - open New recipe to continue';

export interface RecipeTextFirstDialogProps {
  mode: RecipeFormMode;
  open: boolean;
  onClose: () => void;
  /** Edit: the recipe to change */
  recipe?: Recipe | null;
  /**
   * Every opening is a fresh editing session (in Create it starts from the stored draft),
   * and so is a change of this key while open. Never the identity of `recipe`: a parent may
   * hand over a new object for the same recipe on every render.
   */
  resetKey?: string;
  /** Edit: called with the updated recipe before the dialog closes. The caller shows the toast */
  onSuccess?: (recipe: Recipe) => void;
  /** Injectable draft storage (tests); defaults to window.localStorage */
  draftStorage?: DraftStorage | null;
}

interface PanelProps {
  id: string;
  labelledBy: string;
  /** Runs when the panel has MOUNTED - with `mode="wait"` that is after the old one left */
  onShown: () => void;
  children: React.ReactNode;
}

/**
 * Scroll reset and focus after a tab change hang on this mount effect, never on an animation
 * callback: the Jest motion mock has none, and reduced motion may skip them.
 */
function EditorPanel({ id, labelledBy, onShown, children }: PanelProps) {
  const onShownRef = useRef(onShown);
  onShownRef.current = onShown;
  useEffect(() => {
    onShownRef.current();
  }, []);

  return (
    <MotionBox {...fadeMotion} role="tabpanel" id={id} aria-labelledby={labelledBy}>
      {children}
    </MotionBox>
  );
}

const visuallyHiddenSx = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  m: '-1px',
  p: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

const tabSx = {
  minHeight: 48,
  minWidth: 0,
  px: { xs: 1, sm: 2 },
  textTransform: 'none',
  fontWeight: 600,
  whiteSpace: 'nowrap',
} as const;

// ' - 2 to check' next to the tab's name. A phone has no room for it: there the icon stands
// alone and the words stay for assistive tech (CSS only, no width flag)
const statusTextSx = {
  typography: 'caption',
  color: 'text.secondary',
  ml: 0.5,
  position: { xs: 'absolute', sm: 'static' },
  width: { xs: '1px', sm: 'auto' },
  height: { xs: '1px', sm: 'auto' },
  overflow: { xs: 'hidden', sm: 'visible' },
  clip: { xs: 'rect(0 0 0 0)', sm: 'auto' },
} as const;

type SessionProps = Omit<RecipeTextFirstDialogProps, 'resetKey'>;

function EditorSession({ mode, open, onClose, recipe, onSuccess, draftStorage }: SessionProps) {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { showSuccess, showInfo } = useToast();
  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();

  const form = useRecipeForm({ initial: mode === 'edit' ? recipe : null, resetKey: 'session' });
  const capture = useTextCapture(form);
  const { registerField, focusField } = useFieldRegistry();

  // An existing recipe already is rows, so Edit opens on the structured tab
  const [tab, setTab] = useState<RecipeEditorTab>(mode === 'edit' ? 'check' : 'write');
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [attempts, setAttempts] = useState(0);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [coverBroken, setCoverBroken] = useState(false);
  // Once the author has moved between tabs the title no longer grabs the focus on mount
  const [hasSwitchedTab, setSwitchedTab] = useState(false);

  const draft = useRecipeDraft({
    // Edit has no stored draft: without a user id the hook is inert
    userId: mode === 'create' ? user?.id : null,
    values: form.values,
    text: capture.draftText,
    section: tab,
    sections: RECIPE_EDITOR_TABS,
    storage: draftStorage,
  });

  const baseId = useId();
  const statusId = `${baseId}-status`;
  const tabId = (name: RecipeEditorTab) => `${baseId}-tab-${name}`;
  const panelId = (name: RecipeEditorTab) => `${baseId}-panel-${name}`;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const previewButtonRef = useRef<HTMLButtonElement | null>(null);
  const coverHandleRef = useRef<ImageUploadHandle | null>(null);
  const pendingFocus = useRef<{ path?: RecipeFieldPath } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Shows a tab and moves the focus to `path`, or to the heading of the panel it opens */
  const showTab = (next: RecipeEditorTab, path?: RecipeFieldPath) => {
    if (next === tab) {
      // Only a jump to a field asks for the tab it is already on
      if (path) focusField(path);
      return;
    }
    pendingFocus.current = { path };
    setSwitchedTab(true);
    setTab(next);
  };

  const selectTab = (next: RecipeEditorTab, path?: RecipeFieldPath) => {
    // Rows edited by hand since the text was read: the text says the same again
    if (next === 'write' && tab !== 'write') capture.syncFromRows();
    showTab(next, path);
  };
  const selectTabRef = useRef(selectTab);
  selectTabRef.current = selectTab;

  const handlePanelShown = () => {
    const request = pendingFocus.current;
    pendingFocus.current = null;
    // The first panel of a session: TitleField's own fine-pointer autofocus is enough
    if (!request) return;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    if (request.path) focusField(request.path);
    else headingRef.current?.focus();
  };

  // Automatic restore, once per draft found, and never over something already typed
  const restoredDraft = useRef<RecipeDraft | null>(null);
  const formRef = useRef(form);
  formRef.current = form;
  const captureRef = useRef(capture);
  captureRef.current = capture;
  useEffect(() => {
    const found = draft.draft;
    if (!found || restoredDraft.current === found || formRef.current.isDirty) return;
    restoredDraft.current = found;
    captureRef.current.load(found.values, found.text);
    setTab(found.section as RecipeEditorTab);
    setRestoredAt(found.savedAt);
  }, [draft.draft]);

  // Closing inside the autosave debounce must not lose the last keystrokes. Declared after
  // useRecipeDraft, so its effect has already queued the write this one flushes
  const { flush } = draft;
  useEffect(() => {
    if (!open) flush();
  }, [open, flush, form.values, capture.draftText]);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    },
    []
  );

  useUnsavedChangesWarning(open && form.isDirty && (draft.saveFailed || mode === 'edit'));

  // The preview closes without MUI's focus restore, so an [Edit] can send the focus to a
  // field; a plain close gives it back to the Preview button
  const previewReturn = useRef<'button' | { path: RecipeFieldPath } | null>(null);
  useEffect(() => {
    const target = previewReturn.current;
    if (previewOpen || !target) return;
    previewReturn.current = null;
    if (target === 'button') previewButtonRef.current?.focus();
    else selectTabRef.current(tabForPath(target.path), target.path);
  }, [previewOpen]);

  const closePreview = () => {
    previewReturn.current = 'button';
    setPreviewOpen(false);
  };

  const editFromPreview = (section: RecipeFormSection, path?: RecipeFieldPath) => {
    previewReturn.current = { path: path ?? FIRST_PATH[section] };
    setPreviewOpen(false);
  };

  const goTo = useCallback((_section: RecipeFormSection, path: RecipeFieldPath) => {
    selectTabRef.current(tabForPath(path), path);
  }, []);

  const handleClose = () => {
    // Nothing keeps these changes: Edit has no draft, and neither has Create once storage fails
    if (form.isDirty && (mode === 'edit' || draft.saveFailed)) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
    if (mode === 'create' && form.isDirty) {
      // A toast inside the editor would cover the pinned button: it waits for the dialog to leave
      toastTimer.current = setTimeout(
        () => showInfo(DRAFT_SAVED_TOAST),
        theme.transitions.duration.leavingScreen
      );
    }
  };

  const handleDiscard = () => {
    coverHandleRef.current?.cancel();
    setConfirmDiscard(false);
    onClose();
  };

  const handleStartOver = () => {
    coverHandleRef.current?.cancel();
    draft.clearDraft();
    form.reset();
    capture.clear();
    setRestoredAt(null);
    setSubmitError(null);
    // Not selectTab: the texts were just emptied, there is nothing to write from the rows
    showTab('write', 'title');
  };

  const jumpToFirstIssue = (): boolean => {
    const [first] = form.validate();
    if (!first) return false;
    setAttempts((count) => count + 1);
    selectTab(tabForPath(first.path), first.path);
    return true;
  };

  const handlePublish = async () => {
    if (jumpToFirstIssue()) return;
    if (coverBroken) {
      selectTab('check', 'imageUrl');
      return;
    }
    // FormStatus already says that the session expired
    if (!user) return;

    setSubmitError(null);
    setSubmitting(true);
    try {
      if (mode === 'edit' && recipe) {
        const result = await updateRecipe(recipe.id, toPayload(form.values, 'edit'));
        onSuccess?.(result.recipe);
        onClose();
      } else {
        const result = await createRecipe(toPayload(form.values, 'create'));
        draft.clearDraft();
        onClose();
        showSuccess('Recipe published');
        const id: unknown = result?.recipe?.id;
        router.push(typeof id === 'string' ? `/recipe/${id}` : '/');
      }
    } catch (error) {
      setSubmitError(error);
      // The server found something the form should have: say it on the field if we can
      if (error instanceof RecipeSubmitError && error.code === 'validation') jumpToFirstIssue();
    } finally {
      setSubmitting(false);
    }
  };

  const { values, issues, publishAttempted } = form;
  const writeComplete =
    values.title.trim() !== '' &&
    values.ingredients.some((row) => !isBlankIngredientRow(row)) &&
    values.steps.some((row) => row.description.trim() !== '');
  const failedOn = (name: RecipeEditorTab) =>
    publishAttempted ? issues.filter((issue) => tabForPath(issue.path) === name).length : 0;
  const writeFailed = failedOn('write');
  const checkFailed = failedOn('check');

  // Status adornments are an icon plus words, never a colour alone
  const writeLabel = (
    <Box component="span">
      Write
      {writeFailed > 0 && (
        <Box component="span" sx={statusTextSx}>
          - {writeFailed} to fix
        </Box>
      )}
      {writeFailed === 0 && writeComplete && (
        <Box component="span" sx={visuallyHiddenSx}>
          {' '}
          - complete
        </Box>
      )}
    </Box>
  );
  const checkName = mode === 'edit' ? 'Check & save' : 'Check & publish';
  const checkLabel = (
    <Box component="span">
      {checkName}
      {checkFailed > 0 && (
        <Box component="span" sx={statusTextSx}>
          - {checkFailed} to fix
        </Box>
      )}
      {checkFailed === 0 && capture.checkCount > 0 && (
        <Box component="span" sx={statusTextSx}>
          - {capture.checkCount} to check
        </Box>
      )}
    </Box>
  );
  const statusIcon = (failed: number, fallback: React.ReactElement | undefined) =>
    failed > 0 ? <ErrorOutline fontSize="small" sx={{ color: 'error.main' }} /> : fallback;

  const tabs = (
    <Tabs
      value={tab}
      onChange={(_event, next: RecipeEditorTab) => selectTab(next)}
      variant="fullWidth"
      aria-label="Recipe editor"
      sx={{ borderBottom: 1, borderColor: 'divider' }}
    >
      <Tab
        value="write"
        id={tabId('write')}
        aria-controls={panelId('write')}
        label={writeLabel}
        icon={statusIcon(
          writeFailed,
          writeComplete ? (
            <CheckCircle fontSize="small" sx={{ color: 'success.main' }} />
          ) : undefined
        )}
        iconPosition="end"
        sx={tabSx}
      />
      <Tab
        value="check"
        id={tabId('check')}
        aria-controls={panelId('check')}
        label={checkLabel}
        icon={statusIcon(
          checkFailed,
          capture.checkCount > 0 ? (
            <WarningAmber fontSize="small" sx={{ color: attentionColor }} />
          ) : undefined
        )}
        iconPosition="end"
        sx={tabSx}
      />
    </Tabs>
  );

  const primarySx = { flex: { xs: 1, sm: 'none' }, minHeight: 48 } as const;
  const actions = (
    <>
      <FormStatus
        id={statusId}
        form={form}
        goTo={goTo}
        submitError={submitError}
        onRetry={handlePublish}
        sessionExpired={!user}
        draftSavedAt={draft.savedAt}
        attempt={attempts}
      />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        {tab === 'check' && (
          <Button type="button" onClick={() => selectTab('write')} disabled={isSubmitting}>
            Back
          </Button>
        )}
        {mode === 'create' && tab === 'write' ? (
          <Button
            key="next"
            type="button"
            variant="contained"
            size="large"
            endIcon={<ArrowForward />}
            onClick={() => selectTab('check')}
            sx={primarySx}
          >
            Next: Check &amp; publish
          </Button>
        ) : (
          // Its own keyed node: it never inherits the DOM position of 'Next'
          <PublishButton
            key="publish"
            mode={mode}
            pending={isSubmitting}
            disabled={form.uploadsInFlight > 0}
            aria-describedby={statusId}
            onPublish={handlePublish}
            sx={primarySx}
          />
        )}
      </Box>
    </>
  );

  return (
    <>
      <FormDialog
        ref={scrollRef}
        open={open}
        title={mode === 'edit' ? 'Edit recipe' : 'New recipe'}
        onClose={handleClose}
        dirty={form.isDirty}
        busy={isSubmitting}
        maxWidth="md"
        headerSlot={tabs}
        titleActions={
          <Button
            ref={previewButtonRef}
            type="button"
            size="small"
            aria-label="Preview"
            startIcon={<Visibility />}
            onClick={() => setPreviewOpen(true)}
            // One control at every width: the word is dropped on phones, by CSS
            sx={{ minWidth: 44, '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 }, ml: 0 } }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              Preview
            </Box>
          </Button>
        }
        actions={actions}
      >
        {restoredAt !== null && (
          <DraftRestoredBar
            savedAt={restoredAt}
            onStartOver={handleStartOver}
            onDismiss={() => {
              setRestoredAt(null);
              headingRef.current?.focus();
            }}
            disabled={isSubmitting}
            sx={{ mb: 2 }}
          />
        )}

        <Box
          component="fieldset"
          disabled={isSubmitting}
          sx={{
            border: 0,
            p: 0,
            m: 0,
            minWidth: 0,
            opacity: isSubmitting ? 0.6 : 1,
            transition: (t) => t.transitions.create('opacity'),
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <EditorPanel
              key={tab}
              id={panelId(tab)}
              labelledBy={tabId(tab)}
              onShown={handlePanelShown}
            >
              {tab === 'write' ? (
                <WriteTab
                  form={form}
                  capture={capture}
                  registerField={registerField}
                  disabled={isSubmitting}
                  headingRef={headingRef}
                  autoFocusTitle={!hasSwitchedTab}
                  onCheckRow={(rowId) => selectTab('check', `ingredients.${rowId}.name`)}
                />
              ) : (
                <CheckTab
                  form={form}
                  capture={capture}
                  registerField={registerField}
                  disabled={isSubmitting}
                  headingRef={headingRef}
                  coverHandleRef={coverHandleRef}
                  onCoverBrokenChange={setCoverBroken}
                />
              )}
            </EditorPanel>
          </AnimatePresence>
        </Box>
      </FormDialog>

      <RecipePreviewDialog
        open={open && previewOpen}
        onClose={closePreview}
        payload={form.toPayload()}
        onEditSection={editFromPreview}
      />

      <ConfirmDialog
        open={open && confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={handleDiscard}
        title="Discard your changes?"
        message={
          mode === 'edit'
            ? 'The changes you made to this recipe will be lost.'
            : 'This device could not save a draft, so closing now loses what you wrote.'
        }
        confirmText="Discard"
        cancelText="Keep editing"
        confirmColor="error"
      />
    </>
  );
}

/**
 * Proposal C - 'Write it like a note'. ONE dialog for Create and Edit with two freely
 * switchable tabs over the same recipe: 'Write' (title + two text boxes, parsed live into
 * rows) and 'Check & publish' (the shared structured editors). Only Publish / Save
 * validates; tabs are never blocked.
 *
 * This outer component only decides when an editing SESSION starts: on every opening, and
 * when `resetKey` changes while open. The session is a keyed child, so all of its state -
 * form, texts, tab, errors - starts clean, and the closing dialog keeps its session until
 * the exit transition is over.
 */
export default function RecipeTextFirstDialog({ resetKey, ...props }: RecipeTextFirstDialogProps) {
  const { open, mode } = props;
  const key = resetKey ?? mode;
  const [stored, setStored] = useState(() => ({ id: open ? 1 : 0, open, key }));

  let session = stored;
  if (stored.open !== open || stored.key !== key) {
    const startsNew = open && (!stored.open || stored.key !== key);
    session = { id: startsNew ? stored.id + 1 : stored.id, open, key };
    setStored(session);
  }

  // Never opened yet: no form, no storage read
  if (session.id === 0) return null;
  return <EditorSession key={session.id} {...props} />;
}
