'use client';
import { AddPhotoAlternate, BrokenImage, Close } from '@mui/icons-material';
import {
  Box,
  Button,
  ButtonBase,
  FormHelperText,
  FormLabel,
  IconButton,
  LinearProgress,
  Typography,
} from '@mui/material';
import { alpha, type Theme } from '@mui/material/styles';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { MAX_UPLOAD_SIZE } from '@/lib/constants';
import {
  ACCEPT_ATTRIBUTE,
  GENERIC_UPLOAD_ERROR,
  INVALID_TYPE_MESSAGE,
  NETWORK_UPLOAD_ERROR,
  downscaleImage,
  firstFileFrom,
  isAcceptedImage,
  readJsonSafely,
  tooLargeMessage,
  uploadErrorMessage,
} from './imageUploadUtils';

export interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  required?: boolean;
  /** Width / height of the tile on sm+ and of every preview. Defaults to 4:3. */
  aspectRatio?: number;
  /** Alias of `variant="inline"`, kept for the existing call sites. */
  compact?: boolean;
  /** Validation state owned by the form. Nothing is red until this is true. */
  error?: boolean;
  helperText?: string;
  /** 'cover' = dashed tile; 'inline' = "Add photo" text button + 96x72 thumbnail. */
  variant?: 'cover' | 'inline';
  /** Painted over the FILLED cover (difficulty chip, time pill). Never blocks clicks. */
  overlay?: React.ReactNode;
  /** true when an upload starts, false when it settles - also after an unmount. */
  onUploadingChange?: (busy: boolean) => void;
  /** A `<fieldset disabled>` does not disable a non-form trigger, so pass this too. */
  disabled?: boolean;
  /** The stored `value` could not be loaded (e.g. a restored draft whose asset is gone). */
  onBrokenChange?: (broken: boolean) => void;
}

/** Imperative API: lets a form focus the field and feed it a pasted / dropped file. */
export interface ImageUploadHandle {
  focus: () => void;
  scrollIntoView: (options?: ScrollIntoViewOptions) => void;
  openPicker: () => void;
  uploadFile: (file: File) => void;
}

type Phase = 'idle' | 'uploading' | 'failed';
type View = 'rest' | 'uploading' | 'failed' | 'broken' | 'filled';
type FocusTarget = 'trigger' | 'action' | null;

export const BROKEN_IMAGE_MESSAGE = 'This photo could not be loaded - Replace';

// The one allowed pair of literal colours: these sit on top of a photo, so they
// must look the same in both themes (same as RecipeCard's badges).
const PHOTO_SCRIM = 'rgba(0,0,0,0.6)';
const PHOTO_SCRIM_HOVER = 'rgba(0,0,0,0.8)';
const PHOTO_SCRIM_LIGHT = 'rgba(0,0,0,0.4)';
const ON_PHOTO_SCRIM = '#fff';

const visuallyHidden: React.CSSProperties = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: 1,
  width: 1,
  margin: -1,
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
};

const focusRing = {
  outline: '2px solid',
  outlineColor: 'primary.main',
  outlineOffset: 2,
};

function createPreviewUrl(file: File): string | null {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
  try {
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

function revokePreviewUrl(url: string | null) {
  if (!url || typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
  URL.revokeObjectURL(url);
}

interface ScrimButtonProps {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Pill on a photo. The 44/40px minimum from globals.css applies to the button
 * itself (the touch target); the visible pill inside stays 32px tall.
 */
const ScrimButton = forwardRef<HTMLButtonElement, ScrimButtonProps>(function ScrimButton(
  { label, children, onClick, disabled },
  ref
) {
  return (
    <ButtonBase
      ref={ref}
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      sx={{
        borderRadius: 16,
        '&:hover > span': { bgcolor: PHOTO_SCRIM_HOVER },
        '&:focus-visible > span': {
          outline: '2px solid',
          outlineColor: ON_PHOTO_SCRIM,
          outlineOffset: 2,
        },
        '&.Mui-disabled': { opacity: 0.5 },
      }}
    >
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          height: 32,
          px: 1.5,
          borderRadius: 16,
          bgcolor: PHOTO_SCRIM,
          color: ON_PHOTO_SCRIM,
          typography: 'caption',
          fontWeight: 600,
        }}
      >
        {children}
      </Box>
    </ButtonBase>
  );
});

const ImageUpload = forwardRef<ImageUploadHandle, ImageUploadProps>(function ImageUpload(
  {
    value,
    onChange,
    label = 'Cover photo',
    required = true,
    aspectRatio = 4 / 3,
    compact = false,
    error = false,
    helperText,
    variant,
    overlay,
    onUploadingChange,
    disabled = false,
    onBrokenChange,
  },
  ref
) {
  const inline = (variant ?? (compact ? 'inline' : 'cover')) === 'inline';

  const [phase, setPhase] = useState<Phase>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [retryable, setRetryable] = useState(false);
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileRef = useRef<File | null>(null);
  const previewRef = useRef<string | null>(null);
  const uploadSeq = useRef(0);
  const busyRef = useRef(false);
  const pendingFocus = useRef<FocusTarget>(null);
  const reportedBroken = useRef(false);

  // Uploads outlive renders (and even the component): always talk to the latest props.
  const latest = useRef({ onChange, onUploadingChange, onBrokenChange, disabled });
  useEffect(() => {
    latest.current = { onChange, onUploadingChange, onBrokenChange, disabled };
  });

  const baseId = useId();
  const labelId = `${baseId}-label`;
  const promptId = `${baseId}-prompt`;
  const hintId = `${baseId}-hint`;
  const helperId = `${baseId}-helper`;

  const broken = Boolean(value) && brokenUrl === value;
  let view: View = 'rest';
  if (phase === 'uploading') view = 'uploading';
  else if (phase === 'failed') view = 'failed';
  else if (broken) view = 'broken';
  else if (value) view = 'filled';

  const internalError = message || (view === 'broken' ? BROKEN_IMAGE_MESSAGE : '');
  const showError = error || Boolean(internalError);
  const helper = internalError || helperText;
  const canAcceptFiles = !disabled && phase !== 'uploading';

  const replacePreview = useCallback((next: string | null) => {
    revokePreviewUrl(previewRef.current);
    previewRef.current = next;
    setPreviewUrl(next);
  }, []);

  const setBusy = useCallback((busy: boolean) => {
    if (busyRef.current === busy) return;
    busyRef.current = busy;
    latest.current.onUploadingChange?.(busy);
  }, []);

  const startUpload = useCallback(
    async (file: File) => {
      if (latest.current.disabled) return;
      pendingFocus.current = null;

      if (!isAcceptedImage(file)) {
        setMessage(INVALID_TYPE_MESSAGE);
        return;
      }

      // A newer upload supersedes an older one: stale results are ignored below.
      const seq = ++uploadSeq.current;
      const superseded = () => seq !== uploadSeq.current;
      const fail = (text: string, canRetry: boolean) => {
        setMessage(text);
        setRetryable(canRetry);
        setPhase('failed');
        pendingFocus.current = 'action';
        setBusy(false);
      };

      fileRef.current = file;
      replacePreview(createPreviewUrl(file));
      setMessage('');
      setPhase('uploading');
      setBusy(true);

      const prepared = await downscaleImage(file);
      if (superseded()) return;
      if (prepared.size > MAX_UPLOAD_SIZE) {
        fail(tooLargeMessage(prepared.size), false);
        return;
      }

      let response: Response;
      try {
        const formData = new FormData();
        formData.append('file', prepared);
        response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'X-Requested-With': 'fetch' },
          body: formData,
        });
      } catch {
        if (!superseded()) fail(NETWORK_UPLOAD_ERROR, true);
        return;
      }

      const body = await readJsonSafely(response);
      if (superseded()) return;
      if (!response.ok) {
        fail(
          uploadErrorMessage(response.status, body, response.headers?.get?.('Retry-After')),
          true
        );
        return;
      }

      const url = body && typeof body === 'object' ? (body as { url?: unknown }).url : undefined;
      if (typeof url !== 'string' || !url) {
        fail(GENERIC_UPLOAD_ERROR, true);
        return;
      }

      fileRef.current = null;
      replacePreview(null);
      setPhase('idle');
      pendingFocus.current = 'action';
      setBusy(false);
      latest.current.onChange(url);
    },
    [replacePreview, setBusy]
  );

  const openPicker = useCallback(() => {
    if (latest.current.disabled) return;
    inputRef.current?.click();
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so the same file can be selected again
    event.target.value = '';
    if (file) void startUpload(file);
  };

  const handleRetry = () => {
    if (fileRef.current) void startUpload(fileRef.current);
  };

  // Leaves the FAILED state without a new file: back to the photo we had, or to rest.
  const handleDismissFailure = () => {
    fileRef.current = null;
    replacePreview(null);
    setMessage('');
    setPhase('idle');
    pendingFocus.current = value ? 'action' : 'trigger';
  };

  const handleRemove = () => {
    setMessage('');
    setBrokenUrl(null);
    pendingFocus.current = 'trigger';
    onChange('');
  };

  const handleDragOver = (event: React.DragEvent) => {
    // Always cancel: an unhandled drop makes the browser navigate to the file
    event.preventDefault();
    if (canAcceptFiles) setDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    if (!canAcceptFiles) return;
    const file = firstFileFrom(event.dataTransfer);
    if (file) void startUpload(file);
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    if (!canAcceptFiles) return;
    const file = firstFileFrom(event.clipboardData, true);
    if (!file) return;
    // Consumed here: a form-level onPaste that also feeds the cover must not run twice
    event.preventDefault();
    event.stopPropagation();
    void startUpload(file);
  };

  useImperativeHandle(
    ref,
    () => ({
      focus: () => (triggerRef.current ?? actionRef.current)?.focus(),
      scrollIntoView: (options) => rootRef.current?.scrollIntoView?.(options),
      openPicker,
      uploadFile: (file) => void startUpload(file),
    }),
    [openPicker, startUpload]
  );

  // Revoke the blob preview when the component goes away
  useEffect(() => () => revokePreviewUrl(previewRef.current), []);

  // A server-rendered <img> can fail before React attaches onError: catch up after mount
  useEffect(() => {
    const image = imageRef.current;
    if (view === 'filled' && image?.complete && image.naturalWidth === 0) setBrokenUrl(value);
  }, [view, value]);

  useEffect(() => {
    if (reportedBroken.current === broken) return;
    reportedBroken.current = broken;
    latest.current.onBrokenChange?.(broken);
  }, [broken]);

  // Focus follows the control that replaced the one the user acted on, but never
  // steals it from another field the user moved to while the upload was running.
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target || view === 'uploading') return;
    const element = target === 'trigger' ? triggerRef.current : actionRef.current;
    if (!element) return;
    pendingFocus.current = null;
    const active = document.activeElement;
    const focusIsFree =
      !active || active === document.body || Boolean(rootRef.current?.contains(active));
    if (focusIsFree) element.focus();
  }, [view, value]);

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT_ATTRIBUTE}
      onChange={handleInputChange}
      disabled={disabled}
      tabIndex={-1}
      aria-hidden="true"
      data-testid="image-upload-input"
      style={visuallyHidden}
    />
  );

  const helperNode = helper ? (
    <FormHelperText
      id={helperId}
      error={showError}
      role={internalError ? 'alert' : undefined}
      sx={{ mx: 0 }}
    >
      {helper}
    </FormHelperText>
  ) : null;

  const previewSrc = view === 'filled' ? value : previewUrl;
  const previewImage = previewSrc ? (
    <Box
      component="img"
      ref={imageRef}
      src={previewSrc}
      alt={`${label} preview`}
      onError={view === 'filled' ? () => setBrokenUrl(value) : undefined}
      sx={{
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        filter: view === 'failed' ? 'grayscale(1)' : 'none',
      }}
    />
  ) : null;

  const progressBar = (
    <LinearProgress
      aria-label="Uploading photo"
      sx={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
    />
  );

  if (inline) {
    return (
      <Box
        ref={rootRef}
        role="group"
        aria-label={label}
        onPaste={handlePaste}
        sx={{ position: 'relative', minWidth: 0 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          {view === 'rest' ? (
            <Button
              ref={(node: HTMLButtonElement | null) => {
                triggerRef.current = node;
              }}
              type="button"
              size="small"
              startIcon={<AddPhotoAlternate />}
              onClick={openPicker}
              disabled={disabled}
              aria-describedby={helper ? helperId : undefined}
            >
              Add photo
            </Button>
          ) : (
            <>
              <Box sx={{ position: 'relative', width: 96, height: 72, flexShrink: 0 }}>
                <Box
                  aria-busy={view === 'uploading'}
                  sx={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 1,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: showError ? 'error.main' : 'divider',
                    bgcolor: 'action.hover',
                    color: 'text.disabled',
                  }}
                >
                  {view === 'broken' ? <BrokenImage /> : previewImage}
                  {view === 'uploading' && (
                    <>
                      <Box sx={{ position: 'absolute', inset: 0, bgcolor: PHOTO_SCRIM_LIGHT }} />
                      {progressBar}
                    </>
                  )}
                </Box>
                {view !== 'uploading' && (
                  <IconButton
                    type="button"
                    aria-label={view === 'failed' ? 'Dismiss failed upload' : 'Remove photo'}
                    onClick={view === 'failed' ? handleDismissFailure : handleRemove}
                    disabled={disabled}
                    sx={{
                      // The 44/40px touch target stays INSIDE the thumbnail so it can
                      // never cover a neighbour (the step textarea sits 4px above)
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      p: 0.5,
                      alignItems: 'flex-start',
                      justifyContent: 'flex-end',
                      '&:hover': { bgcolor: 'transparent' },
                      '&:hover > span, &:focus-visible > span': {
                        bgcolor: 'error.main',
                        borderColor: 'error.main',
                        color: 'error.contrastText',
                      },
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        color: 'text.secondary',
                      }}
                    >
                      <Close sx={{ fontSize: 14 }} />
                    </Box>
                  </IconButton>
                )}
              </Box>
              {view === 'failed' && retryable && (
                <Button
                  ref={actionRef}
                  type="button"
                  size="small"
                  aria-label="Retry upload"
                  onClick={handleRetry}
                  disabled={disabled}
                >
                  Retry
                </Button>
              )}
              {/* One text button only: the step action row has ~100px to spare. After a
                  retryable failure another file is one step away (dismiss, Add photo). */}
              {(view === 'filled' || view === 'broken' || (view === 'failed' && !retryable)) && (
                <Button
                  ref={actionRef}
                  type="button"
                  size="small"
                  aria-label="Replace photo"
                  onClick={openPicker}
                  disabled={disabled}
                >
                  Replace
                </Button>
              )}
            </>
          )}
        </Box>
        {helperNode}
        {fileInput}
      </Box>
    );
  }

  const ratio = String(aspectRatio);

  return (
    <Box
      ref={rootRef}
      role="group"
      aria-labelledby={labelId}
      onPaste={handlePaste}
      sx={{ position: 'relative' }}
    >
      <FormLabel
        id={labelId}
        component="span"
        required={required}
        error={showError}
        disabled={disabled}
        sx={{ display: 'block', mb: 1, typography: 'subtitle2' }}
      >
        {label}
      </FormLabel>

      <Box
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {view === 'rest' ? (
          <ButtonBase
            component="div"
            role="button"
            ref={(node: HTMLDivElement | null) => {
              triggerRef.current = node;
            }}
            onClick={openPicker}
            disabled={disabled}
            aria-labelledby={`${labelId} ${promptId}`}
            aria-describedby={helper ? `${hintId} ${helperId}` : hintId}
            sx={{
              width: '100%',
              display: 'flex',
              flexDirection: { xs: 'row', sm: 'column' },
              alignItems: 'center',
              justifyContent: { xs: 'flex-start', sm: 'center' },
              gap: { xs: 2, sm: 1 },
              p: 2,
              textAlign: { xs: 'left', sm: 'center' },
              aspectRatio: { xs: 'auto', sm: ratio },
              minHeight: { xs: 120 },
              maxHeight: 280,
              border: '1.5px dashed',
              borderColor: dragOver ? 'primary.main' : showError ? 'error.main' : 'divider',
              borderRadius: 2,
              bgcolor: dragOver
                ? (theme: Theme) => alpha(theme.palette.primary.main, 0.08)
                : 'action.hover',
              transition: (theme: Theme) =>
                theme.transitions.create(['border-color', 'background-color'], {
                  duration: theme.transitions.duration.shortest,
                }),
              '&:hover': showError ? undefined : { borderColor: 'primary.main' },
              '&:focus-visible': focusRing,
            }}
          >
            <AddPhotoAlternate sx={{ fontSize: 40, color: 'text.disabled', flexShrink: 0 }} />
            <Box component="span" sx={{ display: 'block', minWidth: 0 }}>
              <Typography
                id={promptId}
                component="span"
                variant="body2"
                color={disabled ? 'text.disabled' : 'text.primary'}
                sx={{ display: 'block' }}
              >
                {dragOver ? 'Drop to upload' : 'Add a cover photo'}
              </Typography>
              <Typography
                id={hintId}
                component="span"
                variant="caption"
                color={disabled ? 'text.disabled' : 'text.secondary'}
                sx={{ display: 'block' }}
              >
                Drop, paste or click - JPG, PNG, WebP or GIF
              </Typography>
            </Box>
          </ButtonBase>
        ) : (
          <Box
            aria-busy={view === 'uploading'}
            sx={{
              position: 'relative',
              width: '100%',
              aspectRatio: ratio,
              maxHeight: 280,
              borderRadius: 2,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: showError ? 'error.main' : 'divider',
              bgcolor: 'action.hover',
              ...(dragOver && focusRing),
            }}
          >
            {previewImage}

            {view === 'filled' && overlay != null && (
              <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{overlay}</Box>
            )}

            {view === 'uploading' && (
              <>
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: PHOTO_SCRIM_LIGHT,
                  }}
                >
                  {/* Text too: the bar is frozen under prefers-reduced-motion */}
                  <Typography
                    variant="caption"
                    sx={{
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 16,
                      bgcolor: PHOTO_SCRIM,
                      color: ON_PHOTO_SCRIM,
                      fontWeight: 600,
                    }}
                  >
                    Uploading...
                  </Typography>
                </Box>
                {progressBar}
              </>
            )}

            {(view === 'failed' || view === 'broken') && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                  p: 1,
                  bgcolor: PHOTO_SCRIM,
                  color: ON_PHOTO_SCRIM,
                  textAlign: 'center',
                }}
              >
                {view === 'broken' && <BrokenImage />}
                <Typography variant="subtitle2">
                  {view === 'failed' ? 'Upload failed' : 'Photo unavailable'}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {view === 'failed' && retryable && (
                    <ScrimButton
                      ref={actionRef}
                      label="Retry upload"
                      onClick={handleRetry}
                      disabled={disabled}
                    >
                      Retry
                    </ScrimButton>
                  )}
                  {view === 'failed' ? (
                    <>
                      <ScrimButton
                        ref={retryable ? undefined : actionRef}
                        label="Choose another photo"
                        onClick={openPicker}
                        disabled={disabled}
                      >
                        Choose another
                      </ScrimButton>
                      <ScrimButton label="Cancel upload" onClick={handleDismissFailure}>
                        Cancel
                      </ScrimButton>
                    </>
                  ) : (
                    <>
                      <ScrimButton
                        ref={actionRef}
                        label="Replace photo"
                        onClick={openPicker}
                        disabled={disabled}
                      >
                        Replace
                      </ScrimButton>
                      <ScrimButton label="Remove photo" onClick={handleRemove} disabled={disabled}>
                        Remove
                      </ScrimButton>
                    </>
                  )}
                </Box>
              </Box>
            )}

            {view === 'filled' && (
              <Box sx={{ position: 'absolute', right: 8, bottom: 4, display: 'flex' }}>
                <ScrimButton
                  ref={actionRef}
                  label="Replace photo"
                  onClick={openPicker}
                  disabled={disabled}
                >
                  Replace
                </ScrimButton>
                <ScrimButton label="Remove photo" onClick={handleRemove} disabled={disabled}>
                  Remove
                </ScrimButton>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {helperNode}
      {fileInput}
    </Box>
  );
});

export default ImageUpload;
