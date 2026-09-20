'use client';
import { Close } from '@mui/icons-material';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogProps,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { forwardRef, useId } from 'react';
import SlideUp from './SlideUp';

export type FormDialogCloseReason = 'closeButton' | 'escapeKeyDown' | 'backdropClick';

export interface FormDialogProps {
  open: boolean;
  /** Printed as the dialog's `<h2>` and used as its accessible name */
  title: string;
  /**
   * Called only when the close is allowed: never while `busy`, and never for a backdrop
   * click while `dirty`. The X and Escape always get through when not busy - what happens
   * next (keep a draft, ask to discard) is the caller's decision.
   */
  onClose: (reason: FormDialogCloseReason) => void;
  /** The form has unsaved input: a click on the backdrop is ignored */
  dirty?: boolean;
  /** A submit is in flight: every way of closing is blocked and the form is `aria-busy` */
  busy?: boolean;
  maxWidth?: DialogProps['maxWidth'];
  /** Controls of the title row, placed before the X (a 'Preview' button) */
  titleActions?: React.ReactNode;
  /** Fixed zone between the title row and the scrolling content (tabs, a bar) */
  headerSlot?: React.ReactNode;
  /** The pinned footer: the status line and the buttons. It never scrolls with the content */
  actions: React.ReactNode;
  /** The scrolling content */
  children: React.ReactNode;
}

/**
 * The shell of every dialog-based form: three zones at a fixed height - title row (+
 * `headerSlot`), scrolling content, pinned actions.
 *
 * The Paper ITSELF is the `<form>`: MUI lays the Paper out as a flex column in which
 * DialogContent is the only child that grows and scrolls. A bare `<form>` between the Paper
 * and DialogContent would break that column and un-pin the footer on long content.
 * Nothing relies on a submit event: `onSubmit` only prevents the default.
 *
 * The forwarded ref points at the scrolling DialogContent (scroll reset on section change).
 */
const FormDialog = forwardRef<HTMLDivElement, FormDialogProps>(function FormDialog(
  {
    open,
    title,
    onClose,
    dirty = false,
    busy = false,
    maxWidth = 'md',
    titleActions,
    headerSlot,
    actions,
    children,
  },
  ref
) {
  const theme = useTheme();
  // ONE breakpoint for the shell and its content
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const titleId = useId();

  const handleDialogClose: DialogProps['onClose'] = (_event, reason) => {
    if (busy) return;
    if (reason === 'backdropClick' && dirty) return;
    onClose(reason);
  };

  const desktopHeight = 'min(760px, calc(100% - 64px))';

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      fullScreen={isMobile}
      fullWidth
      maxWidth={maxWidth}
      TransitionComponent={isMobile ? SlideUp : undefined}
      aria-labelledby={titleId}
      PaperProps={
        {
          component: 'form',
          noValidate: true,
          autoComplete: 'off',
          onSubmit: (event: React.FormEvent) => event.preventDefault(),
          'aria-busy': busy || undefined,
          sx: {
            // 100vh first: browsers without dynamic viewport units keep it
            height: { xs: '100vh', sm: desktopHeight },
            '@supports (height: 100dvh)': {
              height: { xs: '100dvh', sm: desktopHeight },
            },
          },
        } as DialogProps['PaperProps']
      }
    >
      <Box
        sx={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          pl: { xs: 2, sm: 3 },
          pr: { xs: 1, sm: 1.5 },
          pt: { xs: 'calc(8px + env(safe-area-inset-top))', sm: 1.5 },
          pb: { xs: 1, sm: 1.5 },
        }}
      >
        <Typography
          id={titleId}
          component="h2"
          variant="h6"
          sx={{ fontWeight: 600, minWidth: 0, flex: '1 1 auto' }}
        >
          {title}
        </Typography>
        {titleActions}
        <IconButton
          type="button"
          aria-label="Close"
          onClick={() => onClose('closeButton')}
          disabled={busy}
        >
          <Close />
        </IconButton>
      </Box>

      {headerSlot != null && (
        <Box sx={{ flexShrink: 0, px: { xs: 2, sm: 3 }, pb: 1 }}>{headerSlot}</Box>
      )}

      {/* `relative`: the content's visually hidden nodes (live regions, hidden inputs) are
          absolutely positioned. Without a positioned scroller their containing block is the
          Paper, where they escape this overflow, make the PAPER scrollable by the height of
          the content, and a scrollIntoView on a field then pushes the title row out of view */}
      <DialogContent ref={ref} sx={{ position: 'relative', px: { xs: 2, sm: 3 }, py: 2 }}>
        {children}
      </DialogContent>

      <DialogActions
        disableSpacing
        sx={{
          flexShrink: 0,
          // xs: the status is a line above the button row; sm+: status left, buttons right
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 1,
          borderTop: 1,
          borderColor: 'divider',
          px: { xs: 2, sm: 3 },
          pt: 1.5,
          pb: { xs: 'calc(12px + env(safe-area-inset-bottom))', sm: 2 },
        }}
      >
        {actions}
      </DialogActions>
    </Dialog>
  );
});

export default FormDialog;
