import { render, screen } from '@testing-library/react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import React from 'react';
import { renderWithLocale, setTestLocale } from '../testing';

/**
 * Proves the harness jest.setup.js installs: a component that calls useTranslations() with
 * NO provider renders English, the ICU engine really runs, and a test can ask for Spanish.
 */

function Greeting() {
  const t = useTranslations('common');
  return <span>{t('actions.saveChanges')}</span>;
}

function Minutes({ count }: { count: number }) {
  const t = useTranslations('common');
  return <span>{t('time.minutes', { count })}</span>;
}

function Locale() {
  return <span>{useLocale()}</span>;
}

function Amount({ value }: { value: number }) {
  const format = useFormatter();
  return <span>{format.number(value)}</span>;
}

function ErrorWithRetry({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('common');
  // t.rich is how inline markup is translated: the message owns the whole sentence AND the
  // position of the link inside it, the component owns the element.
  return (
    <p>
      {t.rich('states.errorWithRetry', {
        retry: (chunks) => <button onClick={onRetry}>{chunks}</button>,
      })}
    </p>
  );
}

describe('i18n test harness', () => {
  it('should render English without any provider in the tree', () => {
    render(<Greeting />);

    expect(screen.getByText('Save changes')).toBeInTheDocument();
  });

  it('should run ICU plurals for the singular case', () => {
    render(<Minutes count={1} />);

    expect(screen.getByText('1 minute')).toBeInTheDocument();
  });

  it('should run ICU plurals for the plural case', () => {
    render(<Minutes count={45} />);

    expect(screen.getByText('45 minutes')).toBeInTheDocument();
  });

  it('should report the English locale by default', () => {
    render(<Locale />);

    expect(screen.getByText('en')).toBeInTheDocument();
  });

  it('should render Spanish when the test opts in with renderWithLocale', () => {
    renderWithLocale(render, 'es', <Greeting />);

    expect(screen.getByText('Guardar cambios')).toBeInTheDocument();
  });

  it('should run Spanish ICU plurals when the test opts in', () => {
    setTestLocale('es');

    render(<Minutes count={3} />);

    expect(screen.getByText('3 minutos')).toBeInTheDocument();
  });

  it('should reset to English between tests', () => {
    render(<Locale />);

    expect(screen.getByText('en')).toBeInTheDocument();
  });

  it('should format numbers with the active locale', () => {
    setTestLocale('es');

    render(<Amount value={1234.5} />);

    expect(screen.getByText('1234,5')).toBeInTheDocument();
  });

  it('should build real React elements from t.rich', () => {
    const onRetry = jest.fn();

    render(<ErrorWithRetry onRetry={onRetry} />);
    screen.getByRole('button', { name: 'Try again' }).click();

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should place the rich tag where the Spanish message puts it', () => {
    renderWithLocale(render, 'es', <ErrorWithRetry onRetry={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Probá de nuevo' })).toBeInTheDocument();
  });
});
