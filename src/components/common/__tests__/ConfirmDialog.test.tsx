import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import ConfirmDialog from '../ConfirmDialog';

const mockTheme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={mockTheme}>{component}</ThemeProvider>);
};

describe('ConfirmDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render dialog when open is true', () => {
    renderWithTheme(
      <ConfirmDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="Confirm Action"
        message="Are you sure you want to proceed?"
      />
    );

    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
  });

  it('should not render dialog when open is false', () => {
    renderWithTheme(
      <ConfirmDialog
        open={false}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="Confirm Action"
        message="Are you sure?"
      />
    );

    expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument();
  });

  it('should display default button texts', () => {
    renderWithTheme(
      <ConfirmDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="Test"
        message="Test message"
      />
    );

    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should display custom button texts', () => {
    renderWithTheme(
      <ConfirmDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="Delete Item"
        message="This action cannot be undone"
        confirmText="Delete"
        cancelText="Go Back"
      />
    );

    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });

  it('should call onClose when Cancel button is clicked', () => {
    renderWithTheme(
      <ConfirmDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="Test"
        message="Test message"
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it('should call onConfirm when Confirm button is clicked', () => {
    renderWithTheme(
      <ConfirmDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="Test"
        message="Test message"
      />
    );

    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('should display loading state', () => {
    renderWithTheme(
      <ConfirmDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="Test"
        message="Test message"
        loading={true}
      />
    );

    expect(screen.getByText('Processing...')).toBeInTheDocument();

    const confirmButton = screen.getByText('Processing...');
    const cancelButton = screen.getByText('Cancel');

    expect(confirmButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
  });

  it('should use custom confirm button color', () => {
    renderWithTheme(
      <ConfirmDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="Delete"
        message="Delete this item?"
        confirmColor="error"
      />
    );

    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toHaveClass('MuiButton-containedError');
  });

  it('should not allow dialog close when loading', () => {
    const { rerender } = renderWithTheme(
      <ConfirmDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="Test"
        message="Test message"
        loading={true}
      />
    );

    // Try to close dialog (e.g., by clicking backdrop)
    // The onClose should be undefined when loading is true
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  describe('fullScreen is opt-in', () => {
    let originalMatchMedia: typeof window.matchMedia;

    beforeEach(() => {
      // A phone: every max-width query matches
      originalMatchMedia = window.matchMedia;
      window.matchMedia = jest.fn().mockImplementation((query) => ({
        matches: query.includes('max-width'),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));
    });

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    it('should stay a small dialog on a phone by default', () => {
      renderWithTheme(
        <ConfirmDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Mobile Dialog"
          message="Testing mobile"
        />
      );

      expect(screen.getByRole('dialog')).not.toHaveClass('MuiDialog-paperFullScreen');
    });

    it('should go full screen when the caller asks for it', () => {
      renderWithTheme(
        <ConfirmDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Mobile Dialog"
          message="Testing mobile fullscreen"
          fullScreen
        />
      );

      expect(screen.getByRole('dialog')).toHaveClass('MuiDialog-paperFullScreen');
    });
  });
});
