import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import '@testing-library/jest-dom';
// Filters React's false 'suspended inside act' report for focus moved inside an effect
import '@/components/recipe/form/__tests__/editorHarness';
import {
  CREATE_LOGIN_HREF,
  CreateRecipeProvider,
  useCreateRecipeDialog,
} from '../CreateRecipeContext';

const mockPush = jest.fn();
let mockUser: { id: string; username: string } | null = { id: 'user-1', username: 'ana' };

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));
jest.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: jest.fn(), showInfo: jest.fn() }),
}));

/** Two unrelated entry points, like the navigation and the feed */
function EntryPoints() {
  const { openCreate, closeCreate, isCreateOpen } = useCreateRecipeDialog();
  return (
    <>
      <button type="button" onClick={openCreate}>
        From the navigation
      </button>
      <button type="button" onClick={openCreate}>
        From the feed
      </button>
      <button type="button" onClick={closeCreate}>
        Close from outside
      </button>
      <output>{isCreateOpen ? 'open' : 'closed'}</output>
    </>
  );
}

const renderWithProvider = () => {
  render(
    <CreateRecipeProvider>
      <EntryPoints />
    </CreateRecipeProvider>
  );
  return userEvent.setup();
};

describe('CreateRecipeContext', () => {
  beforeEach(() => {
    mockUser = { id: 'user-1', username: 'ana' };
    mockPush.mockReset();
    window.localStorage.clear();
  });

  it('should mount no editor until somebody asks for it', () => {
    renderWithProvider();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('closed');
  });

  it("should open the one 'New recipe' dialog for a logged-in user", async () => {
    const user = renderWithProvider();

    await user.click(screen.getByRole('button', { name: 'From the feed' }));

    expect(screen.getByRole('dialog', { name: 'New recipe' })).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('should send a visitor to log in with the fixed create intent', async () => {
    mockUser = null;
    const user = renderWithProvider();

    await user.click(screen.getByRole('button', { name: 'From the navigation' }));

    expect(mockPush).toHaveBeenCalledWith('/auth?next=create');
    expect(CREATE_LOGIN_HREF).toBe('/auth?next=create');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should close the dialog from its own X', async () => {
    const user = renderWithProvider();
    await user.click(screen.getByRole('button', { name: 'From the navigation' }));

    await user.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('should let a consumer close it as well', async () => {
    const user = renderWithProvider();
    await user.click(screen.getByRole('button', { name: 'From the navigation' }));

    // The open dialog hides the page behind it from the accessibility tree
    await user.click(screen.getByRole('button', { name: 'Close from outside', hidden: true }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it("should take the dialog off the screen when the author follows 'Log in again'", async () => {
    const tree = () => (
      <CreateRecipeProvider>
        <EntryPoints />
      </CreateRecipeProvider>
    );
    const { rerender } = render(tree());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'From the navigation' }));
    // The session expires under the open editor (notification polling logs out silently)
    mockUser = null;
    rerender(tree());
    const link = screen.getByRole('link', { name: 'Log in again' });
    // jsdom can not follow a link; the login page is what the router shows next
    link.addEventListener('click', (event) => event.preventDefault());

    await user.click(link);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('closed');
  });

  it('should do nothing outside the provider', async () => {
    render(<EntryPoints />);

    await userEvent.click(screen.getByRole('button', { name: 'From the feed' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close from outside' }));

    expect(screen.getByRole('status')).toHaveTextContent('closed');
    expect(mockPush).not.toHaveBeenCalled();
  });
});
