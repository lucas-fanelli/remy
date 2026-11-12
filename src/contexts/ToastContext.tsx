'use client';

import { Snackbar, Alert, AlertColor, Button, Slide, SlideProps } from '@mui/material';
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

/** A button on the toast — "Deshacer". Pressing it closes the toast. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  duration?: number;
  action?: ToastAction;
  /**
   * The toast went away without its action being pressed: it timed out, or the reader
   * closed it. Not called when the action closed it, nor when dismissToast did.
   */
  onDismiss?: () => void;
}

interface Toast extends ToastOptions {
  id: string;
  message: string;
  severity: AlertColor;
}

interface ToastContextType {
  /** Returns the toast's id, for dismissToast. */
  showToast: (message: string, severity?: AlertColor, options?: number | ToastOptions) => string;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
  /** Take a toast down from outside, without calling its onDismiss. */
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="up" />;
}

/**
 * A counter, not the time: two toasts raised in the same millisecond — a failure and its
 * rollback's message, say — used to share an id, so React saw one key and closing either
 * closed both.
 */
let nextToastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (message: string, severity: AlertColor = 'info', options: number | ToastOptions = {}) => {
      const {
        duration = 6000,
        action,
        onDismiss,
      } = typeof options === 'number' ? { duration: options } : options;
      nextToastId += 1;
      const id = `toast-${nextToastId}`;
      setToasts((prev) => [...prev, { id, message, severity, duration, action, onDismiss }]);
      return id;
    },
    []
  );

  const showSuccess = useCallback(
    (message: string) => {
      showToast(message, 'success');
    },
    [showToast]
  );

  const showError = useCallback(
    (message: string) => {
      showToast(message, 'error', 8000); // Errors stay longer
    },
    [showToast]
  );

  const showWarning = useCallback(
    (message: string) => {
      showToast(message, 'warning');
    },
    [showToast]
  );

  const showInfo = useCallback(
    (message: string) => {
      showToast(message, 'info');
    },
    [showToast]
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  /** Closed by time or by the reader: its onDismiss runs. */
  const handleClose = useCallback((toast: Toast, reason?: string) => {
    // A tap elsewhere on the page is not a decision about the delete: an Undo toast stays
    // until its time is up or it is answered.
    if (reason === 'clickaway' && toast.action) return;
    setToasts((prev) => prev.filter((candidate) => candidate.id !== toast.id));
    toast.onDismiss?.();
  }, []);

  const handleAction = useCallback((toast: Toast) => {
    setToasts((prev) => prev.filter((candidate) => candidate.id !== toast.id));
    toast.action?.onClick();
  }, []);

  return (
    <ToastContext.Provider
      value={{ showToast, showSuccess, showError, showWarning, showInfo, dismissToast }}
    >
      {children}
      {toasts.map((toast, index) => (
        <Snackbar
          key={toast.id}
          open={true}
          autoHideDuration={toast.duration}
          onClose={(_event, reason) => handleClose(toast, reason)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          TransitionComponent={SlideTransition}
          sx={{
            bottom: { xs: 80 + index * 70, sm: 24 + index * 70 }, // Stack toasts
          }}
        >
          <Alert
            onClose={() => handleClose(toast)}
            severity={toast.severity}
            variant="filled"
            sx={{ width: '100%', minWidth: 300, alignItems: 'center' }}
            elevation={6}
            action={
              toast.action ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => handleAction(toast)}
                  sx={{ fontWeight: 700 }}
                >
                  {toast.action.label}
                </Button>
              ) : undefined
            }
          >
            {toast.message}
          </Alert>
        </Snackbar>
      ))}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
