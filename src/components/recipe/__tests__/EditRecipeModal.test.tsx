import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { renderWithQueryClient as render } from '@/__tests__/helpers/queryClient';
import '@testing-library/jest-dom';
// Filters React's false 'suspended inside act' report for focus moved inside an effect
import '../form/__tests__/editorHarness';
import EditRecipeModal from '../EditRecipeModal';
import { makeRecipe } from '../form/__tests__/fixtures';

// The editor itself is covered by RecipeTextFirstDialog.test.tsx; this suite pins what the
// two callers (the feed and the recipe page) rely on: the props and the reset rule

jest.setTimeout(30_000);

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', username: 'ana' } }),
}));
jest.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: jest.fn(), showInfo: jest.fn() }),
}));
jest.mock('@/components/recipe/form/formMotion', () => ({
  ...jest.requireActual('@/components/recipe/form/formMotion'),
  PUBLISH_GUARD_MS: 0,
}));

const titleBox = () => screen.getByRole('textbox', { name: /^Title/ });

describe('EditRecipeModal', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockReset();
  });

  it('should render nothing without a recipe', () => {
    render(<EditRecipeModal open recipe={null} onClose={jest.fn()} onSuccess={jest.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render nothing while closed', () => {
    render(
      <EditRecipeModal
        open={false}
        recipe={makeRecipe()}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it("should open the 'Edit recipe' editor on the rows of the recipe", () => {
    render(
      <EditRecipeModal open recipe={makeRecipe()} onClose={jest.fn()} onSuccess={jest.fn()} />
    );

    expect(screen.getByRole('dialog', { name: 'Edit recipe' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Check & save/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('should keep what was typed when the parent renders again with a fresh recipe object', async () => {
    const user = userEvent.setup();
    const props = { open: true, onClose: jest.fn(), onSuccess: jest.fn() };
    const { rerender } = render(<EditRecipeModal {...props} recipe={makeRecipe()} />);
    await user.click(screen.getByRole('tab', { name: /^Write/ }));
    await user.type(titleBox(), '!');

    rerender(<EditRecipeModal {...props} recipe={makeRecipe()} />);

    expect(titleBox()).toHaveValue('Chocotorta!');
  });

  it('should start from the stored recipe again on the next opening', async () => {
    const user = userEvent.setup();
    const props = { onClose: jest.fn(), onSuccess: jest.fn(), recipe: makeRecipe() };
    const { rerender } = render(<EditRecipeModal {...props} open />);
    await user.click(screen.getByRole('tab', { name: /^Write/ }));
    await user.type(titleBox(), '!');
    rerender(<EditRecipeModal {...props} open={false} />);

    rerender(<EditRecipeModal {...props} open />);
    await user.click(screen.getByRole('tab', { name: /^Write/ }));

    expect(titleBox()).toHaveValue('Chocotorta');
  });

  it('should hand the updated recipe to the caller and close', async () => {
    const user = userEvent.setup();
    const updated = makeRecipe({ title: 'Chocotorta!' });
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ recipe: updated }) });
    const onClose = jest.fn();
    const onSuccess = jest.fn();
    render(<EditRecipeModal open recipe={makeRecipe()} onClose={onClose} onSuccess={onSuccess} />);
    await user.click(screen.getByRole('tab', { name: /^Write/ }));
    await user.type(titleBox(), '!');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(updated));
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/recipes/recipe-1',
      expect.objectContaining({ method: 'PUT' })
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
