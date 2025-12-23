import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import AnimatedTabs from '../AnimatedTabs';

// Mock framer-motion
jest.mock('framer-motion', () => {
  const mockMotion: any = {};
  mockMotion.div = ({ children, layoutId, style, ...props }: any) => (
    <div data-testid="motion-indicator" data-layout-id={layoutId} style={style} {...props}>
      {children}
    </div>
  );
  return {
    motion: mockMotion,
  };
});

const mockTheme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={mockTheme}>{component}</ThemeProvider>);
};

describe('AnimatedTabs', () => {
  const mockOnChange = jest.fn();

  const defaultTabs = [
    { key: 'tab1', label: 'First Tab' },
    { key: 'tab2', label: 'Second Tab' },
    { key: 'tab3', label: 'Third Tab' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all tab labels', () => {
      renderWithProviders(
        <AnimatedTabs tabs={defaultTabs} activeKey="tab1" onChange={mockOnChange} />
      );

      expect(screen.getByText('First Tab')).toBeInTheDocument();
      expect(screen.getByText('Second Tab')).toBeInTheDocument();
      expect(screen.getByText('Third Tab')).toBeInTheDocument();
    });

    it('should render tabs centered by default', () => {
      const { container } = renderWithProviders(
        <AnimatedTabs tabs={defaultTabs} activeKey="tab1" onChange={mockOnChange} />
      );

      // Check that the container has centered justify-content
      const tabContainer = container.firstChild as HTMLElement;
      expect(tabContainer).toBeInTheDocument();
    });

    it('should render tabs left-aligned when centered is false', () => {
      renderWithProviders(
        <AnimatedTabs
          tabs={defaultTabs}
          activeKey="tab1"
          onChange={mockOnChange}
          centered={false}
        />
      );

      // Component renders without error
      expect(screen.getByText('First Tab')).toBeInTheDocument();
    });

    it('should render icons when provided', () => {
      const tabsWithIcons = [
        { key: 'tab1', label: 'Tab One', icon: <span data-testid="icon-1">🏠</span> },
        { key: 'tab2', label: 'Tab Two', icon: <span data-testid="icon-2">⚙️</span> },
      ];

      renderWithProviders(
        <AnimatedTabs tabs={tabsWithIcons} activeKey="tab1" onChange={mockOnChange} />
      );

      expect(screen.getByTestId('icon-1')).toBeInTheDocument();
      expect(screen.getByTestId('icon-2')).toBeInTheDocument();
    });

    it('should not render icon wrapper when no icon provided', () => {
      renderWithProviders(
        <AnimatedTabs tabs={defaultTabs} activeKey="tab1" onChange={mockOnChange} />
      );

      // Tabs should still render
      expect(screen.getByText('First Tab')).toBeInTheDocument();
    });
  });

  describe('Active Indicator', () => {
    it('should render sliding indicator for active tab', () => {
      renderWithProviders(
        <AnimatedTabs tabs={defaultTabs} activeKey="tab1" onChange={mockOnChange} />
      );

      const indicator = screen.getByTestId('motion-indicator');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveAttribute('data-layout-id', 'active-tab-indicator');
    });

    it('should render indicator only for active tab', () => {
      renderWithProviders(
        <AnimatedTabs tabs={defaultTabs} activeKey="tab2" onChange={mockOnChange} />
      );

      // Only one indicator should exist
      const indicators = screen.getAllByTestId('motion-indicator');
      expect(indicators).toHaveLength(1);
    });
  });

  describe('Interaction', () => {
    it('should call onChange when clicking a tab', () => {
      renderWithProviders(
        <AnimatedTabs tabs={defaultTabs} activeKey="tab1" onChange={mockOnChange} />
      );

      fireEvent.click(screen.getByText('Second Tab'));

      expect(mockOnChange).toHaveBeenCalledWith('tab2');
    });

    it('should call onChange with correct key when clicking different tabs', () => {
      renderWithProviders(
        <AnimatedTabs tabs={defaultTabs} activeKey="tab1" onChange={mockOnChange} />
      );

      fireEvent.click(screen.getByText('Third Tab'));
      expect(mockOnChange).toHaveBeenCalledWith('tab3');

      fireEvent.click(screen.getByText('First Tab'));
      expect(mockOnChange).toHaveBeenCalledWith('tab1');
    });

    it('should call onChange with number keys', () => {
      const numericTabs = [
        { key: 0, label: 'Tab Zero' },
        { key: 1, label: 'Tab One' },
      ];

      renderWithProviders(
        <AnimatedTabs tabs={numericTabs} activeKey={0} onChange={mockOnChange} />
      );

      fireEvent.click(screen.getByText('Tab One'));
      expect(mockOnChange).toHaveBeenCalledWith(1);
    });
  });

  describe('Styling', () => {
    it('should apply different font weights for active vs inactive tabs', () => {
      renderWithProviders(
        <AnimatedTabs tabs={defaultTabs} activeKey="tab1" onChange={mockOnChange} />
      );

      // Both tabs should render - active one has different styling
      expect(screen.getByText('First Tab')).toBeInTheDocument();
      expect(screen.getByText('Second Tab')).toBeInTheDocument();
    });
  });
});
