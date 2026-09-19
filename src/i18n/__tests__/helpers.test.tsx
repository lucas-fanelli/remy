import { render, screen } from '@testing-library/react';
import { formatDistanceToNow } from 'date-fns';
import React from 'react';
import { useDateFnsLocale } from '../dates';
import { renderWithLocale } from '../testing';
import { text, useTextDescriptor, type TextDescriptor } from '../text';
import { useUnitLabels } from '../units';

/** The helpers the parallel migrations are meant to reach for, each proven in both languages. */

function Rendered({ descriptor }: { descriptor: TextDescriptor }) {
  const render = useTextDescriptor();
  return <span>{render(descriptor)}</span>;
}

describe('text descriptors', () => {
  it('should build a descriptor without values', () => {
    expect(text('common.actions.save')).toEqual({ key: 'common.actions.save' });
  });

  it('should keep the values it was given', () => {
    expect(text('common.form.tooLong', { max: 100 })).toEqual({
      key: 'common.form.tooLong',
      values: { max: 100 },
    });
  });

  it('should render a descriptor produced by a pure function in English', () => {
    render(<Rendered descriptor={text('common.form.tooLong', { max: 100 })} />);

    expect(screen.getByText('Use 100 characters or fewer')).toBeInTheDocument();
  });

  it('should render the same descriptor in Spanish', () => {
    renderWithLocale(
      render,
      'es',
      <Rendered descriptor={text('common.form.tooLong', { max: 100 })} />
    );

    expect(screen.getByText('Usá 100 caracteres como máximo')).toBeInTheDocument();
  });
});

function UnitLabel({ unit, count }: { unit: string; count?: number }) {
  const units = useUnitLabels();
  return <span>{units.label(unit, count)}</span>;
}

function UnitOption({ unit }: { unit: string }) {
  const units = useUnitLabels();
  return <span>{units.option(unit)}</span>;
}

describe('unit labels', () => {
  it('should translate the label while the stored value stays English', () => {
    renderWithLocale(render, 'es', <UnitLabel unit="cups" count={2} />);

    expect(screen.getByText('tazas')).toBeInTheDocument();
  });

  it('should use the singular form when there is one of something', () => {
    renderWithLocale(render, 'es', <UnitLabel unit="cups" count={1} />);

    expect(screen.getByText('taza')).toBeInTheDocument();
  });

  it('should translate "to taste", whose stored value has a space in it', () => {
    renderWithLocale(render, 'es', <UnitLabel unit="to taste" />);

    expect(screen.getByText('a gusto')).toBeInTheDocument();
  });

  it('should leave a symbol that is the same in both languages alone', () => {
    renderWithLocale(render, 'es', <UnitLabel unit="g" />);

    expect(screen.getByText('g')).toBeInTheDocument();
  });

  it('should build the picker option from the label and the long name', () => {
    renderWithLocale(render, 'es', <UnitOption unit="g" />);

    expect(screen.getByText('g - gramos')).toBeInTheDocument();
  });

  it('should show a unit it does not know rather than a missing-key path', () => {
    renderWithLocale(render, 'es', <UnitLabel unit="handfuls" />);

    expect(screen.getByText('handfuls')).toBeInTheDocument();
  });
});

function Ago({ date }: { date: Date }) {
  const locale = useDateFnsLocale();
  return <span>{formatDistanceToNow(date, { addSuffix: true, locale })}</span>;
}

describe('date-fns locale', () => {
  const twoHoursAgo = () => new Date(Date.now() - 2 * 60 * 60 * 1000);

  it('should format a relative time in English by default', () => {
    render(<Ago date={twoHoursAgo()} />);

    expect(screen.getByText('about 2 hours ago')).toBeInTheDocument();
  });

  it('should format the same relative time in Spanish', () => {
    renderWithLocale(render, 'es', <Ago date={twoHoursAgo()} />);

    expect(screen.getByText('hace alrededor de 2 horas')).toBeInTheDocument();
  });
});
