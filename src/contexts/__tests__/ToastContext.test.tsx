import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import '@testing-library/jest-dom';
import { ToastProvider, useToast } from '../ToastContext';

// Test component that uses the toast context
function TestComponent() {
  const { showToast, showSuccess, showError, showWarning, showInfo } = useToast();

  return (
    <div>
      <button onClick={() => showToast('Custom toast', 'info', 3000)}>Show Toast</button>
      <button onClick={() => showSuccess('Success message')}>Show Success</button>
      <button onClick={() => showError('Error message')}>Show Error</button>
      <button onClick={() => showWarning('Warning message')}>Show Warning</button>
      <button onClick={() => showInfo('Info message')}>Show Info</button>
    </div>
  );
}

describe('ToastContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Provider', () => {
    it('should render children correctly', () => {
      render(
        <ToastProvider>
          <div data-testid="child">Test Child</div>
        </ToastProvider>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByText('Test Child')).toBeInTheDocument();
    });

    it('should provide toast context to children', () => {
      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      expect(screen.getByText('Show Toast')).toBeInTheDocument();
      expect(screen.getByText('Show Success')).toBeInTheDocument();
      expect(screen.getByText('Show Error')).toBeInTheDocument();
      expect(screen.getByText('Show Warning')).toBeInTheDocument();
      expect(screen.getByText('Show Info')).toBeInTheDocument();
    });
  });

  describe('useToast hook', () => {
    it('should throw error when used outside ToastProvider', () => {
      // Suppress console.error for this test
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useToast must be used within a ToastProvider');

      consoleError.mockRestore();
    });
  });

  describe('Toast functions', () => {
    it('should display a custom toast with showToast', async () => {
      const user = userEvent.setup();

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      const showToastButton = screen.getByText('Show Toast');
      await user.click(showToastButton);

      await waitFor(() => {
        expect(screen.getByText('Custom toast')).toBeInTheDocument();
      });
    });

    it('should display success toast with showSuccess', async () => {
      const user = userEvent.setup();

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      const showSuccessButton = screen.getByText('Show Success');
      await user.click(showSuccessButton);

      await waitFor(() => {
        expect(screen.getByText('Success message')).toBeInTheDocument();
      });

      // Check for success severity (MUI Alert with success severity)
      const alert = screen.getByText('Success message').closest('.MuiAlert-root');
      expect(alert).toHaveClass('MuiAlert-filledSuccess');
    });

    it('should display error toast with showError', async () => {
      const user = userEvent.setup();

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      const showErrorButton = screen.getByText('Show Error');
      await user.click(showErrorButton);

      await waitFor(() => {
        expect(screen.getByText('Error message')).toBeInTheDocument();
      });

      // Check for error severity
      const alert = screen.getByText('Error message').closest('.MuiAlert-root');
      expect(alert).toHaveClass('MuiAlert-filledError');
    });

    it('should display warning toast with showWarning', async () => {
      const user = userEvent.setup();

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      const showWarningButton = screen.getByText('Show Warning');
      await user.click(showWarningButton);

      await waitFor(() => {
        expect(screen.getByText('Warning message')).toBeInTheDocument();
      });

      // Check for warning severity
      const alert = screen.getByText('Warning message').closest('.MuiAlert-root');
      expect(alert).toHaveClass('MuiAlert-filledWarning');
    });

    it('should display info toast with showInfo', async () => {
      const user = userEvent.setup();

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      const showInfoButton = screen.getByText('Show Info');
      await user.click(showInfoButton);

      await waitFor(() => {
        expect(screen.getByText('Info message')).toBeInTheDocument();
      });

      // Check for info severity
      const alert = screen.getByText('Info message').closest('.MuiAlert-root');
      expect(alert).toHaveClass('MuiAlert-filledInfo');
    });
  });

  describe('Toast dismissal', () => {
    it('should auto-dismiss toast after duration', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ delay: null }); // Disable user-event's built-in timers

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      const showSuccessButton = screen.getByText('Show Success');
      await user.click(showSuccessButton);

      await waitFor(() => {
        expect(screen.getByText('Success message')).toBeInTheDocument();
      });

      // Fast-forward time by 6000ms (default duration)
      act(() => {
        jest.advanceTimersByTime(6000);
      });

      await waitFor(() => {
        expect(screen.queryByText('Success message')).not.toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    it('should dismiss toast when close button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      const showSuccessButton = screen.getByText('Show Success');
      await user.click(showSuccessButton);

      await waitFor(() => {
        expect(screen.getByText('Success message')).toBeInTheDocument();
      });

      // Find and click the close button in the Alert
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('Success message')).not.toBeInTheDocument();
      });
    });

    it('should auto-dismiss error toast after 8000ms', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ delay: null });

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      const showErrorButton = screen.getByText('Show Error');
      await user.click(showErrorButton);

      await waitFor(() => {
        expect(screen.getByText('Error message')).toBeInTheDocument();
      });

      // Error messages stay longer (8000ms)
      act(() => {
        jest.advanceTimersByTime(8000);
      });

      await waitFor(() => {
        expect(screen.queryByText('Error message')).not.toBeInTheDocument();
      });

      jest.useRealTimers();
    });
  });

  describe('Multiple toasts', () => {
    it('should handle multiple toast calls by showing each toast', async () => {
      const user = userEvent.setup();

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      // Show first toast
      await user.click(screen.getByText('Show Success'));

      await waitFor(() => {
        expect(screen.getByText('Success message')).toBeInTheDocument();
      });

      // Show second toast
      await user.click(screen.getByText('Show Error'));

      await waitFor(() => {
        expect(screen.getByText('Error message')).toBeInTheDocument();
      });

      // Show third toast
      await user.click(screen.getByText('Show Warning'));

      await waitFor(() => {
        expect(screen.getByText('Warning message')).toBeInTheDocument();
      });

      // At least the last toast should be visible
      expect(screen.getByText('Warning message')).toBeInTheDocument();
    });

    it('should manage toast state correctly when dismissing', async () => {
      const user = userEvent.setup();

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      // Show a toast
      await user.click(screen.getByText('Show Success'));

      await waitFor(() => {
        expect(screen.getByText('Success message')).toBeInTheDocument();
      });

      // Get close button
      const closeButton = screen.getByRole('button', { name: /close/i });

      // Close the toast
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('Success message')).not.toBeInTheDocument();
      });

      // Show another toast to verify state is clean
      await user.click(screen.getByText('Show Info'));

      await waitFor(() => {
        expect(screen.getByText('Info message')).toBeInTheDocument();
      });
    });
  });

  describe('Toast positioning and styling', () => {
    it('should render Snackbar with correct positioning', async () => {
      const user = userEvent.setup();

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      await user.click(screen.getByText('Show Success'));

      await waitFor(() => {
        const snackbar = screen.getByText('Success message').closest('.MuiSnackbar-root');
        expect(snackbar).toBeInTheDocument();
        expect(snackbar).toHaveClass('MuiSnackbar-anchorOriginBottomCenter');
      });
    });

    it('should render Alert with filled variant', async () => {
      const user = userEvent.setup();

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      await user.click(screen.getByText('Show Success'));

      await waitFor(() => {
        const alert = screen.getByText('Success message').closest('.MuiAlert-root');
        expect(alert).toHaveClass('MuiAlert-filled');
      });
    });
  });

  describe('Custom duration', () => {
    it('should respect custom duration in showToast', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ delay: null });

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      // showToast with custom duration of 3000ms
      await user.click(screen.getByText('Show Toast'));

      await waitFor(() => {
        expect(screen.getByText('Custom toast')).toBeInTheDocument();
      });

      // Fast-forward by 3000ms
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(screen.queryByText('Custom toast')).not.toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    it('should use default parameters when not specified', async () => {
      const user = userEvent.setup();

      function TestComponentMinimal() {
        const { showToast } = useToast();
        return <button onClick={() => showToast('Default toast')}>Show Default</button>;
      }

      render(
        <ToastProvider>
          <TestComponentMinimal />
        </ToastProvider>
      );

      await user.click(screen.getByText('Show Default'));

      await waitFor(() => {
        expect(screen.getByText('Default toast')).toBeInTheDocument();
        const alert = screen.getByText('Default toast').closest('.MuiAlert-root');
        expect(alert).toHaveClass('MuiAlert-filledInfo'); // Default severity is 'info'
      });
    });
  });
  describe('a toast with an action — Deshacer', () => {
    // Lucas asked for Undo on every delete; the toast had nowhere to put the button.
    function Raise({ onUndo, onDismiss }: { onUndo: () => void; onDismiss: () => void }) {
      const { showToast } = useToast();
      return (
        <button
          onClick={() =>
            showToast('Deleted', 'success', {
              duration: 6000,
              action: { label: 'Undo', onClick: onUndo },
              onDismiss,
            })
          }
        >
          Delete
        </button>
      );
    }

    function setup() {
      const onUndo = jest.fn();
      const onDismiss = jest.fn();
      render(
        <ToastProvider>
          <Raise onUndo={onUndo} onDismiss={onDismiss} />
          <p>Somewhere else</p>
        </ToastProvider>
      );
      act(() => screen.getByText('Delete').click());
      return { onUndo, onDismiss };
    }

    afterEach(() => jest.useRealTimers());

    it('shows the action, runs it when pressed and closes, without calling it a dismissal', () => {
      const { onUndo, onDismiss } = setup();

      act(() => screen.getByRole('button', { name: 'Undo' }).click());

      expect(onUndo).toHaveBeenCalledTimes(1);
      expect(onDismiss).not.toHaveBeenCalled();
      expect(screen.queryByText('Deleted')).not.toBeInTheDocument();
    });

    it('reports a dismissal when its time runs out', () => {
      jest.useFakeTimers();
      const { onUndo, onDismiss } = setup();

      act(() => jest.advanceTimersByTime(6000));

      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(onUndo).not.toHaveBeenCalled();
    });

    it('stays up when the reader taps somewhere else on the page', () => {
      // Scrolling or tapping a card is not a decision about the delete.
      const { onDismiss } = setup();

      act(() => {
        document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(screen.getByText('Deleted')).toBeInTheDocument();
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('can be taken down from outside without counting as a dismissal', () => {
      function RaiseAndDrop({ onDismiss }: { onDismiss: () => void }) {
        const { showToast, dismissToast } = useToast();
        return (
          <button onClick={() => dismissToast(showToast('Gone soon', 'info', { onDismiss }))}>
            Raise and drop
          </button>
        );
      }
      const onDismiss = jest.fn();
      render(
        <ToastProvider>
          <RaiseAndDrop onDismiss={onDismiss} />
        </ToastProvider>
      );

      act(() => screen.getByText('Raise and drop').click());

      expect(screen.queryByText('Gone soon')).not.toBeInTheDocument();
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('keeps two toasts raised in the same moment apart', () => {
      // Their ids came from Date.now(): the same millisecond gave both the same key, and
      // closing one closed the other.
      function Raise2() {
        const { showToast } = useToast();
        return (
          <button
            onClick={() => {
              showToast('First', 'info');
              showToast('Second', 'error');
            }}
          >
            Raise two
          </button>
        );
      }
      jest.spyOn(Date, 'now').mockReturnValue(1000);
      render(
        <ToastProvider>
          <Raise2 />
        </ToastProvider>
      );

      act(() => screen.getByText('Raise two').click());
      const first = screen.getByText('First').closest('.MuiAlert-root')!;
      act(() => (first.querySelector('button[aria-label="Close"]') as HTMLButtonElement).click());

      expect(screen.queryByText('First')).not.toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      jest.restoreAllMocks();
    });
  });
});
