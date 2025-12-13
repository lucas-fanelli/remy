import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PwaProvider, usePwa, usePwaOptional } from '../PwaContext';

// Test component to expose context values
function TestConsumer({ onContextChange }: { onContextChange?: (ctx: any) => void }) {
    const context = usePwa();
    React.useEffect(() => {
        onContextChange?.(context);
    }, [context, onContextChange]);
    return (
        <div>
            <span data-testid="can-install">{context.canInstall.toString()}</span>
            <span data-testid="is-installed">{context.isInstalled.toString()}</span>
            <span data-testid="is-running-standalone">{context.isRunningStandalone.toString()}</span>
            <span data-testid="is-ios-safari">{context.isIOSSafari.toString()}</span>
            <span data-testid="is-desktop-chrome">{context.isDesktopChrome.toString()}</span>
            <span data-testid="show-install-prompt">{context.showInstallPrompt.toString()}</span>
            <span data-testid="prompt-available">{context.promptAvailable.toString()}</span>
            <button data-testid="trigger-install" onClick={() => context.triggerInstall()}>Install</button>
            <button data-testid="dismiss-prompt" onClick={context.dismissInstallPrompt}>Dismiss</button>
            <button data-testid="open-app" onClick={context.openApp}>Open App</button>
            <button data-testid="reset-dismissal" onClick={context.resetDismissal}>Reset</button>
        </div>
    );
}

// Test component for optional hook
function OptionalConsumer() {
    const context = usePwaOptional();
    return (
        <div data-testid="optional-result">
            {context ? 'has-context' : 'no-context'}
        </div>
    );
}

describe('PwaContext', () => {
    let originalMatchMedia: typeof window.matchMedia;
    let originalLocalStorage: Storage;
    let originalSessionStorage: Storage;
    let originalNavigator: Navigator;
    let originalLocation: Location;

    const mockLocalStorage: Record<string, string> = {};
    const mockSessionStorage: Record<string, string> = {};

    beforeEach(() => {
        jest.clearAllMocks();

        // Save originals
        originalMatchMedia = window.matchMedia;
        originalLocalStorage = window.localStorage;
        originalSessionStorage = window.sessionStorage;

        // Clear mock storage
        Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key]);
        Object.keys(mockSessionStorage).forEach(key => delete mockSessionStorage[key]);

        // Mock localStorage
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: (key: string) => mockLocalStorage[key] || null,
                setItem: (key: string, value: string) => { mockLocalStorage[key] = value; },
                removeItem: (key: string) => { delete mockLocalStorage[key]; },
                clear: () => { Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key]); },
            },
            writable: true,
        });

        // Mock sessionStorage
        Object.defineProperty(window, 'sessionStorage', {
            value: {
                getItem: (key: string) => mockSessionStorage[key] || null,
                setItem: (key: string, value: string) => { mockSessionStorage[key] = value; },
                removeItem: (key: string) => { delete mockSessionStorage[key]; },
                clear: () => { Object.keys(mockSessionStorage).forEach(key => delete mockSessionStorage[key]); },
            },
            writable: true,
        });

        // Mock matchMedia (not standalone by default)
        window.matchMedia = jest.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        }));

        // Mock getInstalledRelatedApps to silence console warnings
        Object.defineProperty(navigator, 'getInstalledRelatedApps', {
            value: jest.fn().mockResolvedValue([]),
            writable: true,
            configurable: true,
        });

        // Mock location
        const mockLocation = {
            href: 'https://example.com',
            assign: jest.fn(),
            replace: jest.fn(),
            reload: jest.fn(),
        };
        Object.defineProperty(window, 'location', {
            value: mockLocation,
            writable: true,
        });
    });

    afterEach(() => {
        window.matchMedia = originalMatchMedia;
    });

    describe('PwaProvider', () => {
        it('should render children', () => {
            render(
                <PwaProvider>
                    <div data-testid="child">Child Content</div>
                </PwaProvider>
            );

            expect(screen.getByTestId('child')).toBeInTheDocument();
        });

        it('should provide default context values', () => {
            render(
                <PwaProvider>
                    <TestConsumer />
                </PwaProvider>
            );

            expect(screen.getByTestId('can-install')).toHaveTextContent('false');
            expect(screen.getByTestId('is-installed')).toHaveTextContent('false');
            expect(screen.getByTestId('is-running-standalone')).toHaveTextContent('false');
            expect(screen.getByTestId('prompt-available')).toHaveTextContent('false');
        });
    });

    describe('usePwa hook', () => {
        it('should throw error when used outside provider', () => {
            const consoleError = jest.spyOn(console, 'error').mockImplementation(() => { });

            expect(() => {
                render(<TestConsumer />);
            }).toThrow('usePwa must be used within a PwaProvider');

            consoleError.mockRestore();
        });
    });

    describe('usePwaOptional hook', () => {
        it('should return null when used outside provider', () => {
            render(<OptionalConsumer />);

            expect(screen.getByTestId('optional-result')).toHaveTextContent('no-context');
        });

        it('should return context when used inside provider', () => {
            render(
                <PwaProvider>
                    <OptionalConsumer />
                </PwaProvider>
            );

            expect(screen.getByTestId('optional-result')).toHaveTextContent('has-context');
        });
    });

    describe('beforeinstallprompt event', () => {
        it('should capture beforeinstallprompt event and set promptAvailable', async () => {
            render(
                <PwaProvider>
                    <TestConsumer />
                </PwaProvider>
            );

            // Simulate beforeinstallprompt event
            const mockPrompt = jest.fn().mockResolvedValue(undefined);
            const mockUserChoice = Promise.resolve({ outcome: 'dismissed' as const });

            const event = new Event('beforeinstallprompt');
            Object.defineProperty(event, 'prompt', { value: mockPrompt });
            Object.defineProperty(event, 'userChoice', { value: mockUserChoice });
            Object.defineProperty(event, 'preventDefault', { value: jest.fn() });

            await act(async () => {
                window.dispatchEvent(event);
            });

            await waitFor(() => {
                expect(screen.getByTestId('prompt-available')).toHaveTextContent('true');
            });
        });

        it('should prevent default on beforeinstallprompt', async () => {
            render(
                <PwaProvider>
                    <TestConsumer />
                </PwaProvider>
            );

            const mockPreventDefault = jest.fn();
            const event = new Event('beforeinstallprompt');
            Object.defineProperty(event, 'preventDefault', { value: mockPreventDefault });
            Object.defineProperty(event, 'prompt', { value: jest.fn() });
            Object.defineProperty(event, 'userChoice', { value: Promise.resolve({ outcome: 'dismissed' }) });

            await act(async () => {
                window.dispatchEvent(event);
            });

            expect(mockPreventDefault).toHaveBeenCalled();
        });
    });

    describe('triggerInstall', () => {
        it('should return false when no deferred prompt available', async () => {
            let capturedContext: any;

            render(
                <PwaProvider>
                    <TestConsumer onContextChange={(ctx) => { capturedContext = ctx; }} />
                </PwaProvider>
            );

            await waitFor(() => {
                expect(capturedContext).toBeDefined();
            });

            const result = await capturedContext.triggerInstall();
            expect(result).toBe(false);
        });

        it('should call prompt() when deferred prompt is available', async () => {
            render(
                <PwaProvider>
                    <TestConsumer />
                </PwaProvider>
            );

            // Setup mock prompt
            const mockPrompt = jest.fn().mockResolvedValue(undefined);
            const mockUserChoice = Promise.resolve({ outcome: 'accepted' as const });

            const event = new Event('beforeinstallprompt');
            Object.defineProperty(event, 'prompt', { value: mockPrompt });
            Object.defineProperty(event, 'userChoice', { value: mockUserChoice });
            Object.defineProperty(event, 'preventDefault', { value: jest.fn() });

            await act(async () => {
                window.dispatchEvent(event);
            });

            await waitFor(() => {
                expect(screen.getByTestId('prompt-available')).toHaveTextContent('true');
            });

            // Click install button
            await act(async () => {
                fireEvent.click(screen.getByTestId('trigger-install'));
            });

            expect(mockPrompt).toHaveBeenCalled();
        });
    });

    describe('dismissInstallPrompt', () => {
        it('should save dismissal to localStorage', async () => {
            render(
                <PwaProvider>
                    <TestConsumer />
                </PwaProvider>
            );

            fireEvent.click(screen.getByTestId('dismiss-prompt'));

            expect(mockLocalStorage['pwa-install-dismissed']).toBeDefined();
        });

        it('should mark prompt as shown in sessionStorage', async () => {
            render(
                <PwaProvider>
                    <TestConsumer />
                </PwaProvider>
            );

            fireEvent.click(screen.getByTestId('dismiss-prompt'));

            expect(mockSessionStorage['pwa-install-prompt-shown-session']).toBe('true');
        });
    });

    describe('openApp', () => {
        it('should trigger navigation with pwa-open source', () => {
            render(
                <PwaProvider>
                    <TestConsumer />
                </PwaProvider>
            );

            fireEvent.click(screen.getByTestId('open-app'));

            expect(window.location.href).toBe('/?source=pwa-open');
        });
    });

    describe('resetDismissal', () => {
        it('should clear localStorage dismissal', () => {
            mockLocalStorage['pwa-install-dismissed'] = Date.now().toString();

            render(
                <PwaProvider>
                    <TestConsumer />
                </PwaProvider>
            );

            fireEvent.click(screen.getByTestId('reset-dismissal'));

            expect(mockLocalStorage['pwa-install-dismissed']).toBeUndefined();
        });

        it('should clear sessionStorage prompt shown flag', () => {
            mockSessionStorage['pwa-install-prompt-shown-session'] = 'true';

            render(
                <PwaProvider>
                    <TestConsumer />
                </PwaProvider>
            );

            fireEvent.click(screen.getByTestId('reset-dismissal'));

            expect(mockSessionStorage['pwa-install-prompt-shown-session']).toBeUndefined();
        });
    });

    describe('Standalone Mode Detection', () => {
        it('should detect standalone mode via matchMedia', () => {
            window.matchMedia = jest.fn().mockImplementation((query: string) => ({
                matches: query === '(display-mode: standalone)',
                media: query,
                onchange: null,
                addListener: jest.fn(),
                removeListener: jest.fn(),
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
                dispatchEvent: jest.fn(),
            }));

            render(
                <PwaProvider>
                    <TestConsumer />
                </PwaProvider>
            );

            expect(screen.getByTestId('is-running-standalone')).toHaveTextContent('true');
            expect(screen.getByTestId('is-installed')).toHaveTextContent('true');
        });
    });

    describe('appinstalled event', () => {
        it('should update isInstalled when appinstalled fires', async () => {
            render(
                <PwaProvider>
                    <TestConsumer />
                </PwaProvider>
            );

            expect(screen.getByTestId('is-installed')).toHaveTextContent('false');

            await act(async () => {
                window.dispatchEvent(new Event('appinstalled'));
            });

            await waitFor(() => {
                expect(screen.getByTestId('is-installed')).toHaveTextContent('true');
            });
        });

        it('should hide install prompt when appinstalled fires', async () => {
            render(
                <PwaProvider>
                    <TestConsumer />
                </PwaProvider>
            );

            // First trigger beforeinstallprompt
            const event = new Event('beforeinstallprompt');
            Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
            Object.defineProperty(event, 'prompt', { value: jest.fn() });
            Object.defineProperty(event, 'userChoice', { value: Promise.resolve({ outcome: 'dismissed' }) });

            await act(async () => {
                window.dispatchEvent(event);
            });

            // Then fire appinstalled
            await act(async () => {
                window.dispatchEvent(new Event('appinstalled'));
            });

            await waitFor(() => {
                expect(screen.getByTestId('show-install-prompt')).toHaveTextContent('false');
            });
        });
    });

    describe('triggerInstall error handling - lines 241-244', () => {
        it('should handle error when prompt() throws', async () => {
            const consoleError = jest.spyOn(console, 'error').mockImplementation(() => { });

            render(
                <PwaProvider>
                    <TestConsumer />
                </PwaProvider>
            );

            // Setup mock prompt that throws
            const mockPrompt = jest.fn().mockRejectedValue(new Error('Prompt failed'));
            const mockUserChoice = Promise.resolve({ outcome: 'dismissed' as const });

            const event = new Event('beforeinstallprompt');
            Object.defineProperty(event, 'prompt', { value: mockPrompt });
            Object.defineProperty(event, 'userChoice', { value: mockUserChoice });
            Object.defineProperty(event, 'preventDefault', { value: jest.fn() });

            await act(async () => {
                window.dispatchEvent(event);
            });

            await waitFor(() => {
                expect(screen.getByTestId('prompt-available')).toHaveTextContent('true');
            });

            // Click install button - should handle error gracefully
            await act(async () => {
                fireEvent.click(screen.getByTestId('trigger-install'));
            });

            await waitFor(() => {
                expect(consoleError).toHaveBeenCalledWith('Error triggering install prompt:', expect.any(Error));
            });

            consoleError.mockRestore();
        });
    });

    describe('iOS Safari Detection - lines 43-52', () => {
        it('should detect iOS Safari and set canInstall true', () => {
            // Mock iOS Safari user agent
            Object.defineProperty(window.navigator, 'userAgent', {
                value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
                configurable: true,
            });
            Object.defineProperty(window.navigator, 'standalone', {
                value: false,
                configurable: true,
            });

            render(
                <PwaProvider>
                    <TestConsumer />
                </PwaProvider>
            );

            expect(screen.getByTestId('is-ios-safari')).toHaveTextContent('true');
            expect(screen.getByTestId('can-install')).toHaveTextContent('true');
        });
    });

    describe('Desktop Chrome Detection - lines 57-65', () => {
        it('should detect desktop Chrome', () => {
            Object.defineProperty(window.navigator, 'userAgent', {
                value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                configurable: true,
            });

            render(
                <PwaProvider>
                    <TestConsumer />
                </PwaProvider>
            );

            expect(screen.getByTestId('is-desktop-chrome')).toHaveTextContent('true');
        });
    });

    describe('getInstalledRelatedApps - lines 122-127', () => {
        it('should handle error from getInstalledRelatedApps API', async () => {
            const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });

            // Mock navigator with failing getInstalledRelatedApps
            Object.defineProperty(window.navigator, 'getInstalledRelatedApps', {
                value: jest.fn().mockRejectedValue(new Error('API not available')),
                configurable: true,
            });

            render(
                <PwaProvider>
                    <TestConsumer />
                </PwaProvider>
            );

            // Component should still render and work normally despite API error
            expect(screen.getByTestId('is-installed')).toHaveTextContent('false');
            expect(screen.getByTestId('can-install')).toBeInTheDocument();

            consoleWarn.mockRestore();
        });

        it('should detect installed app when getInstalledRelatedApps returns apps', async () => {
            // Mock navigator with successful getInstalledRelatedApps
            Object.defineProperty(window.navigator, 'getInstalledRelatedApps', {
                value: jest.fn().mockResolvedValue([{ platform: 'webapp', url: 'https://example.com' }]),
                configurable: true,
            });

            render(
                <PwaProvider>
                    <TestConsumer />
                </PwaProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('is-installed')).toHaveTextContent('true');
            });
        });
    });

    describe('Dismissed Recently Logic - lines 85-95', () => {
        it('should not show prompt when dismissed recently', () => {
            // Set dismissal time to 1 day ago (within 7 day window)
            const oneDayAgo = Date.now() - (1 * 24 * 60 * 60 * 1000);
            mockLocalStorage['pwa-install-dismissed'] = oneDayAgo.toString();

            render(
                <PwaProvider>
                    <TestConsumer />
                </PwaProvider>
            );

            expect(screen.getByTestId('show-install-prompt')).toHaveTextContent('false');
        });
    });
});
