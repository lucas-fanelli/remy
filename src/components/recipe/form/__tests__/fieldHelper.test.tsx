import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { fieldHelper } from '../fieldHelper';
import { getFieldCounter } from '../formTokens';

describe('fieldHelper', () => {
  it('should render nothing at rest', () => {
    expect(fieldHelper(undefined, getFieldCounter(3, 100))).toBeUndefined();
  });

  it('should render nothing without a message or a counter', () => {
    expect(fieldHelper()).toBeUndefined();
  });

  it('should render the message on its own', () => {
    render(<p>{fieldHelper('Add a title')}</p>);

    expect(screen.getByText('Add a title')).toBeInTheDocument();
  });

  it('should render the counter next to the message', () => {
    render(<p>{fieldHelper('Title: 100 characters at most', getFieldCounter(85, 100))}</p>);

    expect(screen.getByText('Title: 100 characters at most')).toBeInTheDocument();
    expect(screen.getByText('85/100')).toBeInTheDocument();
  });

  it('should render a visible counter without a message', () => {
    render(<p>{fieldHelper(undefined, getFieldCounter(10, 500, true))}</p>);

    expect(screen.getByText('10/500')).toBeInTheDocument();
  });

  it('should emphasise the counter with weight, not colour, from 90%', () => {
    render(<p>{fieldHelper(undefined, getFieldCounter(95, 100))}</p>);

    expect(screen.getByText('95/100')).toHaveStyle({ fontWeight: 600 });
  });

  it('should not emphasise the counter below 90%', () => {
    render(<p>{fieldHelper(undefined, getFieldCounter(85, 100))}</p>);

    expect(screen.getByText('85/100')).not.toHaveStyle({ fontWeight: 600 });
  });
});
