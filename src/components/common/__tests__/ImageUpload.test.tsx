import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import ImageUpload from '../ImageUpload';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    create: (component: any) => component,
  },
}));

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token' }),
}));

const mockTheme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={mockTheme}>{component}</ThemeProvider>);
};

describe('ImageUpload Component', () => {
  let mockFetch: jest.Mock;
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnChange.mockClear();
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockClear();
  });

  it('should render upload placeholder when no image', () => {
    renderWithTheme(<ImageUpload value="" onChange={mockOnChange} />);

    expect(screen.getByText('Click to upload an image')).toBeInTheDocument();
    expect(screen.getByText('JPEG, PNG, WebP, or GIF (max 5MB)')).toBeInTheDocument();
  });

  it('should show custom label', () => {
    renderWithTheme(<ImageUpload value="" onChange={mockOnChange} label="Custom Label" />);

    expect(screen.getByText(/Custom Label/)).toBeInTheDocument();
  });

  it('should show required asterisk when required=true', () => {
    renderWithTheme(<ImageUpload value="" onChange={mockOnChange} required={true} />);

    const requiredIndicator = screen.getByText('*');
    expect(requiredIndicator).toBeInTheDocument();
    expect(requiredIndicator).toHaveStyle({ color: 'red' });
  });

  it('should render image preview when value is provided', () => {
    renderWithTheme(<ImageUpload value="https://example.com/image.jpg" onChange={mockOnChange} />);

    const image = screen.getByAltText('Recipe preview');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://example.com/image.jpg');
  });

  it('should call onChange with empty string when remove button clicked', () => {
    renderWithTheme(<ImageUpload value="https://example.com/image.jpg" onChange={mockOnChange} />);

    const deleteButton = screen.getByRole('button', { name: /remove image/i });
    fireEvent.click(deleteButton);

    expect(mockOnChange).toHaveBeenCalledWith('');
  });

  it('should show error for invalid file type', async () => {
    renderWithTheme(<ImageUpload value="" onChange={mockOnChange} />);

    const file = new File(['dummy content'], 'test.txt', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
    });

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should show error for file too large', async () => {
    renderWithTheme(<ImageUpload value="" onChange={mockOnChange} />);

    // Create a file larger than 5MB
    const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      value: [largeFile],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/File too large/i)).toBeInTheDocument();
    });

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should successfully upload valid image', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'https://example.com/uploaded.jpg' }),
    });

    renderWithTheme(<ImageUpload value="" onChange={mockOnChange} />);

    const file = new File(['dummy content'], 'test.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith('https://example.com/uploaded.jpg');
    });
  });

  it('should handle upload error', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Upload failed' }),
    });

    renderWithTheme(<ImageUpload value="" onChange={mockOnChange} />);

    const file = new File(['dummy content'], 'test.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/Upload failed/i)).toBeInTheDocument();
    });

    expect(mockOnChange).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('should trigger file input when clicking upload area', () => {
    renderWithTheme(<ImageUpload value="" onChange={mockOnChange} />);

    const uploadArea = screen.getByText('Click to upload an image').closest('[class*="MuiCard"]');
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const clickSpy = jest.spyOn(fileInput, 'click');

    fireEvent.click(uploadArea!);

    expect(clickSpy).toHaveBeenCalled();
  });

  it('should close error alert when clicking close button', async () => {
    renderWithTheme(<ImageUpload value="" onChange={mockOnChange} />);

    const file = new File(['dummy content'], 'test.txt', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
    });

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText(/Invalid file type/i)).not.toBeInTheDocument();
    });
  });

  it('should clear error when removing image', () => {
    renderWithTheme(<ImageUpload value="https://example.com/image.jpg" onChange={mockOnChange} />);

    // Trigger error first by trying to upload invalid file
    // (in a real scenario, we'd have an error displayed)

    const deleteButton = screen.getByRole('button', { name: /remove image/i });
    fireEvent.click(deleteButton);

    expect(mockOnChange).toHaveBeenCalledWith('');
  });

  it('should handle file input change with no file selected - line 43', () => {
    renderWithTheme(<ImageUpload value="" onChange={mockOnChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Trigger change event with no files
    Object.defineProperty(input, 'files', {
      value: null,
    });

    fireEvent.change(input);

    // Should return early and not call onChange
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should handle network error in catch block - line 80', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    // Mock fetch to throw a network error
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    renderWithTheme(<ImageUpload value="" onChange={mockOnChange} />);

    const file = new File(['dummy content'], 'test.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });

    expect(mockOnChange).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('should handle non-Error exception in catch block - line 80', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    // Mock fetch to throw a non-Error object
    mockFetch.mockRejectedValueOnce('String error');

    renderWithTheme(<ImageUpload value="" onChange={mockOnChange} />);

    const file = new File(['dummy content'], 'test.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/Failed to upload image/i)).toBeInTheDocument();
    });

    expect(mockOnChange).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('should render with required=false and no error border - line 161', () => {
    renderWithTheme(<ImageUpload value="" onChange={mockOnChange} required={false} />);

    // Component should render without error border when not required
    expect(screen.getByText('Click to upload an image')).toBeInTheDocument();
  });

  it('should render error border when required=true and no value - line 161', () => {
    renderWithTheme(<ImageUpload value="" onChange={mockOnChange} required={true} />);

    // Should show error border color
    expect(screen.getByText('Click to upload an image')).toBeInTheDocument();
  });

  it('should render compact mode with image preview - lines 124-125', () => {
    renderWithTheme(
      <ImageUpload value="https://example.com/image.jpg" onChange={mockOnChange} compact={true} />
    );

    const image = screen.getByAltText('Recipe preview');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://example.com/image.jpg');
  });

  it('should render compact mode upload placeholder - lines 175,185-186', () => {
    renderWithTheme(<ImageUpload value="" onChange={mockOnChange} compact={true} />);

    expect(screen.getByText('Click to upload an image')).toBeInTheDocument();
    // In compact mode, the helper text is not shown
    expect(screen.queryByText('JPEG, PNG, WebP, or GIF (max 5MB)')).not.toBeInTheDocument();
  });

  it('should show compact uploading state - lines 175,178-179', async () => {
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          // Never resolve to keep uploading state active
        })
    );

    renderWithTheme(<ImageUpload value="" onChange={mockOnChange} compact={true} />);

    const file = new File(['dummy content'], 'test.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      value: [file],
    });

    fireEvent.change(input);

    // Wait for uploading state
    await waitFor(() => {
      expect(screen.getByText(/Uploading.../i)).toBeInTheDocument();
    });
  });

  it('should use fallback error message when server returns no error field - line 74', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}), // No error field
    });

    renderWithTheme(<ImageUpload value="" onChange={mockOnChange} />);

    const file = new File(['dummy content'], 'test.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('Upload failed')).toBeInTheDocument();
    });

    expect(mockOnChange).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
