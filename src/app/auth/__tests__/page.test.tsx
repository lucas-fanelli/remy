import { render, screen } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import AuthPage from '../page';

const mockPush = jest.fn();
let mockSearch = '';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockOpenCreate = jest.fn();
jest.mock('@/contexts/CreateRecipeContext', () => ({
  CREATE_INTENT: 'create',
  useCreateRecipeDialog: () => ({ openCreate: mockOpenCreate }),
}));

// The forms have their own suites; here only the page's redirect is under test
jest.mock('@/components/auth/LoginForm', () => () => <div>login form</div>);
jest.mock('@/components/auth/RegisterForm', () => () => <div>register form</div>);

const renderAs = ({ authenticated = true, loading = false, search = '' } = {}) => {
  mockSearch = search;
  mockUseAuth.mockReturnValue({ isAuthenticated: authenticated, isLoading: loading });
  return render(<AuthPage />);
};

describe('AuthPage - return to intent', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockOpenCreate.mockClear();
  });

  it("should go home and open 'New recipe' after a login that came from it", () => {
    renderAs({ search: 'next=create' });

    expect(mockPush).toHaveBeenCalledWith('/');
    expect(mockOpenCreate).toHaveBeenCalledTimes(1);
  });

  it('should just go home when there is no token', () => {
    renderAs();

    expect(mockPush).toHaveBeenCalledWith('/');
    expect(mockOpenCreate).not.toHaveBeenCalled();
  });

  it.each(['next=//evil.com', 'next=https://evil.com/', 'next=/recipe/new', 'next=admin'])(
    'should never follow %s: it is not the fixed token',
    (search) => {
      renderAs({ search });

      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/');
      expect(mockOpenCreate).not.toHaveBeenCalled();
    }
  );

  it('should resume once, however often the page renders again', () => {
    const view = renderAs({ search: 'next=create' });

    view.rerender(<AuthPage />);

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockOpenCreate).toHaveBeenCalledTimes(1);
  });

  it('should show the login form to a visitor and not redirect', () => {
    renderAs({ authenticated: false, search: 'next=create' });

    expect(screen.getByText('login form')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockOpenCreate).not.toHaveBeenCalled();
  });

  it('should wait for the session check before deciding', () => {
    renderAs({ loading: true, search: 'next=create' });

    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.queryByText('login form')).not.toBeInTheDocument();
  });
});
