'use client';

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Footer from '../Footer';

// Mock useRouter
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}));

// Mock useThemeMode
const mockToggleTheme = jest.fn();
let mockMode = 'dark';
jest.mock('@/contexts/ThemeContext', () => ({
    useThemeMode: () => ({
        mode: mockMode,
        toggleTheme: mockToggleTheme,
    }),
}));

// Mock window.open
const mockWindowOpen = jest.fn();
Object.defineProperty(window, 'open', {
    value: mockWindowOpen,
    writable: true,
});

const mockTheme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
    return render(
        <ThemeProvider theme={mockTheme}>
            {component}
        </ThemeProvider>
    );
};

describe('Footer Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockMode = 'dark';
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should render the footer with signature', () => {
        renderWithProviders(<Footer />);
        expect(screen.getByText('Lucas Fanelli')).toBeInTheDocument();
    });

    it('should render Contact button', () => {
        renderWithProviders(<Footer />);
        expect(screen.getByRole('button', { name: /contact/i })).toBeInTheDocument();
    });

    it('should render About Us button', () => {
        renderWithProviders(<Footer />);
        expect(screen.getByRole('button', { name: /about us/i })).toBeInTheDocument();
    });

    it('should navigate to /about when About Us is clicked', () => {
        renderWithProviders(<Footer />);
        const aboutButton = screen.getByRole('button', { name: /about us/i });
        fireEvent.click(aboutButton);
        expect(mockPush).toHaveBeenCalledWith('/about');
    });

    it('should render YouTube icon button with link', () => {
        renderWithProviders(<Footer />);
        const youtubeLink = screen.getByRole('link', { name: /youtube channel/i });
        expect(youtubeLink).toBeInTheDocument();
        expect(youtubeLink).toHaveAttribute('href', 'https://www.youtube.com/@9QNA-4I');
        expect(youtubeLink).toHaveAttribute('target', '_blank');
    });

    it('should render theme toggle button', () => {
        renderWithProviders(<Footer />);
        const themeButton = screen.getByRole('button', { name: /switch to light mode/i });
        expect(themeButton).toBeInTheDocument();
    });

    it('should call toggleTheme when theme button is clicked', () => {
        renderWithProviders(<Footer />);
        const themeButton = screen.getByRole('button', { name: /switch to light mode/i });
        fireEvent.click(themeButton);
        expect(mockToggleTheme).toHaveBeenCalled();
    });

    it('should show LightMode icon when in dark mode', () => {
        mockMode = 'dark';
        renderWithProviders(<Footer />);
        expect(screen.getByTestId('LightModeIcon')).toBeInTheDocument();
    });

    it('should show DarkMode icon when in light mode', () => {
        mockMode = 'light';
        renderWithProviders(<Footer />);
        expect(screen.getByTestId('DarkModeIcon')).toBeInTheDocument();
    });

    describe('Contact Dialog', () => {
        it('should open contact dialog when Contact button is clicked', async () => {
            renderWithProviders(<Footer />);
            const contactButton = screen.getByRole('button', { name: /contact/i });
            fireEvent.click(contactButton);

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });
            expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/your email/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
        });

        it('should close dialog when Cancel is clicked', async () => {
            renderWithProviders(<Footer />);

            // Open dialog
            const contactButton = screen.getByRole('button', { name: /contact/i });
            fireEvent.click(contactButton);

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // Click cancel
            const cancelButton = screen.getByRole('button', { name: /cancel/i });
            fireEvent.click(cancelButton);

            await waitFor(() => {
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            });
        });

        it('should close dialog when X button is clicked', async () => {
            renderWithProviders(<Footer />);

            // Open dialog
            const contactButton = screen.getByRole('button', { name: /contact/i });
            fireEvent.click(contactButton);

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // Find and click the close button (X icon)
            const closeButtons = screen.getAllByRole('button');
            const closeButton = closeButtons.find(btn => btn.querySelector('[data-testid="CloseIcon"]'));
            expect(closeButton).toBeDefined();
            fireEvent.click(closeButton!);

            await waitFor(() => {
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            });
        });

        it('should update form fields when typing', async () => {
            renderWithProviders(<Footer />);

            // Open dialog
            const contactButton = screen.getByRole('button', { name: /contact/i });
            fireEvent.click(contactButton);

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // Fill in form
            const nameInput = screen.getByLabelText(/your name/i);
            const emailInput = screen.getByLabelText(/your email/i);
            const subjectInput = screen.getByLabelText(/subject/i);

            fireEvent.change(nameInput, { target: { value: 'John Doe' } });
            fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
            fireEvent.change(subjectInput, { target: { value: 'Test message' } });

            expect(nameInput).toHaveValue('John Doe');
            expect(emailInput).toHaveValue('john@example.com');
            expect(subjectInput).toHaveValue('Test message');
        });

        it('should disable Send button when form is incomplete', async () => {
            renderWithProviders(<Footer />);

            // Open dialog
            const contactButton = screen.getByRole('button', { name: /contact/i });
            fireEvent.click(contactButton);

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // Send button should be disabled initially
            const sendButton = screen.getByRole('button', { name: /send email/i });
            expect(sendButton).toBeDisabled();
        });

        it('should enable Send button when form is complete', async () => {
            renderWithProviders(<Footer />);

            // Open dialog
            const contactButton = screen.getByRole('button', { name: /contact/i });
            fireEvent.click(contactButton);

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // Fill in form
            const nameInput = screen.getByLabelText(/your name/i);
            const emailInput = screen.getByLabelText(/your email/i);
            const subjectInput = screen.getByLabelText(/subject/i);

            fireEvent.change(nameInput, { target: { value: 'John Doe' } });
            fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
            fireEvent.change(subjectInput, { target: { value: 'Test message' } });

            // Send button should now be enabled
            const sendButton = screen.getByRole('button', { name: /send email/i });
            expect(sendButton).not.toBeDisabled();
        });

        it('should open mailto link and close dialog when Send is clicked', async () => {
            renderWithProviders(<Footer />);

            // Open dialog
            const contactButton = screen.getByRole('button', { name: /contact/i });
            fireEvent.click(contactButton);

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // Fill in form
            const nameInput = screen.getByLabelText(/your name/i);
            const emailInput = screen.getByLabelText(/your email/i);
            const subjectInput = screen.getByLabelText(/subject/i);

            fireEvent.change(nameInput, { target: { value: 'John Doe' } });
            fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
            fireEvent.change(subjectInput, { target: { value: 'Test message' } });

            // Click send
            const sendButton = screen.getByRole('button', { name: /send email/i });
            fireEvent.click(sendButton);

            // Check window.open was called with mailto link
            expect(mockWindowOpen).toHaveBeenCalledWith(
                expect.stringContaining('mailto:lucasarielfanelli@hotmail.com'),
                '_blank'
            );

            // Dialog should close
            await waitFor(() => {
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            });
        });

        it('should clear form data when dialog is closed', async () => {
            renderWithProviders(<Footer />);

            // Open dialog
            const contactButton = screen.getByRole('button', { name: /contact/i });
            fireEvent.click(contactButton);

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // Fill in form
            const nameInput = screen.getByLabelText(/your name/i);
            fireEvent.change(nameInput, { target: { value: 'John Doe' } });
            expect(nameInput).toHaveValue('John Doe');

            // Close dialog
            const cancelButton = screen.getByRole('button', { name: /cancel/i });
            fireEvent.click(cancelButton);

            // Reopen dialog
            fireEvent.click(contactButton);

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // Form should be cleared
            const newNameInput = screen.getByLabelText(/your name/i);
            expect(newNameInput).toHaveValue('');
        });
    });

    describe('Theme Toggle Display', () => {
        it('should show correct tooltip for dark mode', () => {
            mockMode = 'dark';
            renderWithProviders(<Footer />);
            const themeButton = screen.getByRole('button', { name: /switch to light mode/i });
            expect(themeButton).toBeInTheDocument();
        });

        it('should show correct tooltip for light mode', () => {
            mockMode = 'light';
            renderWithProviders(<Footer />);
            const themeButton = screen.getByRole('button', { name: /switch to dark mode/i });
            expect(themeButton).toBeInTheDocument();
        });
    });
});
