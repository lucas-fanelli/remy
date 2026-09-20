import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { LOCALE_COOKIE } from '@/i18n/config';
import { renderWithLocale, setTestLocale } from '@/i18n/testing';
import LanguageSwitcher from '../LanguageSwitcher';

const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // jsdom keeps cookies between tests in a file; clear the one under test
    document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0`;
  });

  it('should offer both languages, each written in its own language', () => {
    render(<LanguageSwitcher />);

    expect(screen.getByRole('button', { name: 'Español' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
  });

  it('should mark the active language as pressed', () => {
    render(<LanguageSwitcher />);

    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('should persist the chosen language in the locale cookie', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.click(screen.getByRole('button', { name: 'Español' }));

    expect(document.cookie).toContain(`${LOCALE_COOKIE}=es`);
  });

  it('should re-render the server tree instead of reloading the page', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.click(screen.getByRole('button', { name: 'Español' }));

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('should tell the caller the language changed so a menu can close itself', async () => {
    const user = userEvent.setup();
    const onChanged = jest.fn();
    render(<LanguageSwitcher onChanged={onChanged} />);

    await user.click(screen.getByRole('button', { name: 'Español' }));

    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('should do nothing when the language already in use is clicked again', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.click(screen.getByRole('button', { name: 'English' }));

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('should label itself in Spanish once Spanish is the active language', () => {
    renderWithLocale(render, 'es', <LanguageSwitcher showLabel showDescription />);

    expect(screen.getByText('Idioma')).toBeInTheDocument();
    expect(screen.getByText('Elegí el idioma de la app')).toBeInTheDocument();
  });

  it('should hide the heading unless the caller asks for it', () => {
    setTestLocale('en');

    render(<LanguageSwitcher />);

    expect(screen.queryByText('Language')).not.toBeInTheDocument();
  });

  it('should show the heading without the description by default', () => {
    render(<LanguageSwitcher showLabel />);

    expect(screen.getByText('Language')).toBeInTheDocument();
    expect(screen.queryByText('Choose the language of the app')).not.toBeInTheDocument();
  });
});
