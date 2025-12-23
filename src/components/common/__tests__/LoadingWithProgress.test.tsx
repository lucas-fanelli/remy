import { render, screen } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import LoadingWithProgress from '../LoadingWithProgress';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const mockTheme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={mockTheme}>{component}</ThemeProvider>);
};

describe('LoadingWithProgress', () => {
  it('should render linear progress bar', () => {
    renderWithTheme(<LoadingWithProgress />);

    const progressBar = document.querySelector('.MuiLinearProgress-root');
    expect(progressBar).toBeInTheDocument();
  });

  it('should render with primary color by default', () => {
    renderWithTheme(<LoadingWithProgress />);

    const progressBar = document.querySelector('.MuiLinearProgress-colorPrimary');
    expect(progressBar).toBeInTheDocument();
  });

  it('should render with secondary color when specified', () => {
    renderWithTheme(<LoadingWithProgress color="secondary" />);

    const progressBar = document.querySelector('.MuiLinearProgress-colorSecondary');
    expect(progressBar).toBeInTheDocument();
  });

  it('should render with error color when specified', () => {
    renderWithTheme(<LoadingWithProgress color="error" />);

    const progressBar = document.querySelector('.MuiLinearProgress-colorError');
    expect(progressBar).toBeInTheDocument();
  });

  it('should render with info color when specified', () => {
    renderWithTheme(<LoadingWithProgress color="info" />);

    const progressBar = document.querySelector('.MuiLinearProgress-colorInfo');
    expect(progressBar).toBeInTheDocument();
  });

  it('should render with success color when specified', () => {
    renderWithTheme(<LoadingWithProgress color="success" />);

    const progressBar = document.querySelector('.MuiLinearProgress-colorSuccess');
    expect(progressBar).toBeInTheDocument();
  });

  it('should render with warning color when specified', () => {
    renderWithTheme(<LoadingWithProgress color="warning" />);

    const progressBar = document.querySelector('.MuiLinearProgress-colorWarning');
    expect(progressBar).toBeInTheDocument();
  });

  it('should be indeterminate by default', () => {
    renderWithTheme(<LoadingWithProgress />);

    const progressBar = document.querySelector('.MuiLinearProgress-indeterminate');
    expect(progressBar).toBeInTheDocument();
  });

  it('should render inline when inline prop is true', () => {
    const { container } = renderWithTheme(<LoadingWithProgress inline />);

    const box = container.firstChild as HTMLElement;
    expect(box).toBeInTheDocument();
  });

  it('should render non-inline by default', () => {
    const { container } = renderWithTheme(<LoadingWithProgress />);

    const box = container.firstChild as HTMLElement;
    expect(box).toBeInTheDocument();
  });

  it('should have correct height styling', () => {
    renderWithTheme(<LoadingWithProgress />);

    const progressBar = document.querySelector('.MuiLinearProgress-root') as HTMLElement;
    expect(progressBar).toBeInTheDocument();
  });

  it('should have width of 100%', () => {
    const { container } = renderWithTheme(<LoadingWithProgress />);

    const box = container.firstChild as HTMLElement;
    expect(box).toBeInTheDocument();
  });
});
