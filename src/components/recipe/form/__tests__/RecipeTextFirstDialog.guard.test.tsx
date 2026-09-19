import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import '@testing-library/jest-dom';
import './editorHarness';
import { PUBLISH_GUARD_MS } from '../formMotion';
import RecipeTextFirstDialog from '../RecipeTextFirstDialog';
import { makeRecipe } from './fixtures';

/**
 * The REAL activation guard (RecipeTextFirstDialog.test.tsx zeroes it). Edit has 'Save
 * changes' on both tabs; on a phone it fills the button row of 'Write' and so takes the
 * spot 'Back' had on the structured tab. Only a guard armed by the tab change can stop the
 * second half of a double tap on 'Back' from saving.
 */
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', username: 'ana' }, logout: jest.fn() }),
}));
jest.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: jest.fn(), showInfo: jest.fn() }),
}));

jest.setTimeout(30_000);

const theme = createTheme();
const LONG_AFTER_OPENING = 60_000;

const renderEdit = () => {
  const mockFetch = global.fetch as jest.Mock;
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ recipe: makeRecipe() }),
  });
  render(
    <ThemeProvider theme={theme}>
      <RecipeTextFirstDialog
        mode="edit"
        open
        recipe={makeRecipe()}
        resetKey="recipe-1:true"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
        draftStorage={null}
      />
    </ThemeProvider>
  );
  return { mockFetch, user: userEvent.setup({ delay: null }) };
};

const saveButton = () => screen.getByRole('button', { name: 'Save changes' });

describe('RecipeTextFirstDialog publish guard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should not save from a double tap on Back in Edit', async () => {
    const { mockFetch, user } = renderEdit();
    // Long after the dialog opened: the guard of the first mount has expired
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + LONG_AFTER_OPENING);

    await user.click(screen.getByRole('button', { name: 'Back' }));
    // The second tap of the pair lands where 'Save changes' has just grown to
    await user.click(saveButton());

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should save in Edit once the guard has passed again', async () => {
    const { mockFetch, user } = renderEdit();
    const opened = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(opened + LONG_AFTER_OPENING);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    clock.mockReturnValue(opened + LONG_AFTER_OPENING + PUBLISH_GUARD_MS + 1);

    await user.click(saveButton());

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
  });
});
