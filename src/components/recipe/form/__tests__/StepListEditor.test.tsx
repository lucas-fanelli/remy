import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import StepListEditor, { StepListEditorProps } from '../StepListEditor';
import { RecipeFormValuesInput } from '../types';
import { renderEditor, renderWithTheme } from './editorHarness';
import { makeValues, STEP_URL } from './fixtures';

type EditorProps = Omit<StepListEditorProps, 'form' | 'registerField'>;

const renderList = (props: EditorProps = {}, values?: RecipeFormValuesInput) =>
  renderEditor(
    (form, registry) => (
      <>
        <StepListEditor form={form} registerField={registry.registerField} {...props} />
        <button type="button">Outside</button>
      </>
    ),
    { values }
  );

const threeSteps = () =>
  makeValues({
    steps: [
      { id: 's1', description: 'Mix', image: '' },
      { id: 's2', description: 'Rest', image: '' },
      { id: 's3', description: 'Bake', image: '' },
    ],
  });

const step = (n: number) => screen.getByRole('textbox', { name: `Step ${n}` });
const row = (n: number) => screen.getByRole('group', { name: `Step ${n}` });
const addButton = () => screen.getByRole('button', { name: 'Add step' });
const outside = () => screen.getByRole('button', { name: 'Outside' });
const stepTexts = () => screen.getAllByRole('textbox').map((box) => (box as any).value);

/** A fetch response the test resolves when it wants the upload to finish */
const deferredUpload = () => {
  let resolve!: () => void;
  const promise = new Promise<unknown>((done) => {
    resolve = () =>
      done({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ url: STEP_URL }),
      });
  });
  (global.fetch as jest.Mock).mockReturnValue(promise);
  return { finish: () => act(async () => resolve()) };
};

const choosePhoto = (n: number) => {
  const input = within(row(n)).getByTestId('image-upload-input');
  const file = new File(['pixels'], 'step.jpg', { type: 'image/jpeg' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
};

describe('StepListEditor', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
  });

  describe('rendering', () => {
    it('should start with one step inside a group named Steps', () => {
      renderList();

      const list = screen.getByRole('group', { name: 'Steps' });
      expect(within(list).getAllByRole('textbox')).toEqual([step(1)]);
    });

    it('should take its name from the section heading when given one', () => {
      renderEditor((form) => (
        <>
          <h2 id="steps-heading">Method</h2>
          <StepListEditor form={form} labelledBy="steps-heading" />
        </>
      ));

      expect(screen.getByRole('group', { name: 'Method' })).toBeInTheDocument();
    });

    it('should ask what happens in the step', () => {
      renderList();

      expect(step(1)).toHaveAttribute('placeholder', 'What happens in this step?');
      expect(step(1)).toHaveAttribute('maxlength', '5000');
      expect(step(1)).toHaveAttribute('autocapitalize', 'sentences');
    });

    it('should number the steps by position without exposing the badge twice', () => {
      renderList({}, threeSteps());

      const badge = within(row(2)).getByText('2');
      expect(badge).toHaveAttribute('aria-hidden', 'true');
    });

    it('should show the number the next step would get next to Add step', () => {
      renderList({}, threeSteps());

      expect(screen.getByText('4')).toHaveAttribute('aria-hidden', 'true');
    });

    it('should offer an optional photo per step, named after the step', () => {
      renderList();

      const photo = screen.getByRole('group', { name: 'Step 1 photo (optional)' });
      expect(within(photo).getByRole('button', { name: 'Add photo' })).toBeInTheDocument();
    });

    it('should draw its own outlined surface by default', () => {
      const { container } = renderList();

      expect(container.querySelector('.MuiPaper-outlined')).toBeInTheDocument();
    });

    it('should drop its own surface when bare', () => {
      const { container } = renderList({ bare: true });

      expect(container.querySelector('.MuiPaper-root')).not.toBeInTheDocument();
      expect(step(1)).toBeInTheDocument();
    });

    it('should mention the keyboard shortcut', () => {
      renderList();

      expect(screen.getByText(/Ctrl\+Enter .* adds the next step/)).toBeInTheDocument();
    });

    it('should show no error at rest', () => {
      renderList();

      expect(step(1)).toHaveAttribute('aria-invalid', 'false');
    });
  });

  describe('writing', () => {
    it('should write the text to the engine', async () => {
      const { user, form } = renderList();

      await user.type(step(1), 'Mix');

      expect(form().values.steps[0].description).toBe('Mix');
    });

    it('should keep plain Enter as a newline', async () => {
      const { user, form } = renderList();

      await user.type(step(1), 'Mix{Enter}Rest');

      expect(form().values.steps[0].description).toBe('Mix\nRest');
      expect(form().values.steps).toHaveLength(1);
    });

    it('should add and focus the next step on Ctrl+Enter', async () => {
      const { user, form } = renderList();
      await user.type(step(1), 'Mix');

      await user.keyboard('{Control>}{Enter}{/Control}');

      expect(form().values.steps).toHaveLength(2);
      expect(step(2)).toHaveFocus();
    });

    it('should add the next step on Cmd+Enter too', async () => {
      const { user } = renderList();
      await user.type(step(1), 'Mix');

      await user.keyboard('{Meta>}{Enter}{/Meta}');

      expect(step(2)).toHaveFocus();
    });

    it('should insert the new step right after the one being written', async () => {
      const { user } = renderList({}, threeSteps());
      await user.click(step(1));

      await user.keyboard('{Control>}{Enter}{/Control}');

      expect(stepTexts()).toEqual(['Mix', '', 'Rest', 'Bake']);
      expect(step(2)).toHaveFocus();
      expect(screen.getByRole('status')).toHaveTextContent('Step 2 added');
    });

    it('should show the counter from 80% of the limit', () => {
      const values = makeValues({
        steps: [{ id: 's1', description: 'x'.repeat(4000), image: '' }],
      });

      renderList({}, values);

      expect(screen.getByText('4000/5000')).toBeInTheDocument();
    });
  });

  describe('add', () => {
    it('should focus the new step', async () => {
      const { user } = renderList({}, threeSteps());

      await user.click(addButton());

      expect(step(4)).toHaveFocus();
    });

    it('should announce the new step politely', async () => {
      const { user } = renderList({}, threeSteps());

      await user.click(addButton());

      expect(screen.getByRole('status')).toHaveTextContent('Step 4 added');
    });

    it('should disable Add step with a caption when the list is full', () => {
      const form: StepListEditorProps['form'] = {
        values: makeValues(),
        errors: {},
        touch: jest.fn(),
        setUploading: jest.fn(),
        steps: {
          canAdd: false,
          add: jest.fn().mockReturnValue(null),
          remove: jest.fn(),
          update: jest.fn(),
          move: jest.fn(),
          restore: jest.fn(),
          replaceAll: jest.fn(),
        },
      };

      renderWithTheme(<StepListEditor form={form} />);

      expect(addButton()).toBeDisabled();
      expect(screen.getByText('50 steps is the most a recipe can have')).toBeInTheDocument();
    });

    it('should stay put when Ctrl+Enter is pressed in a full list', () => {
      const add = jest.fn().mockReturnValue(null);
      const form: StepListEditorProps['form'] = {
        values: makeValues(),
        errors: {},
        touch: jest.fn(),
        setUploading: jest.fn(),
        steps: {
          canAdd: false,
          add,
          remove: jest.fn(),
          update: jest.fn(),
          move: jest.fn(),
          restore: jest.fn(),
          replaceAll: jest.fn(),
        },
      };
      renderWithTheme(<StepListEditor form={form} />);
      step(1).focus();

      fireEvent.keyDown(step(1), { key: 'Enter', ctrlKey: true });

      expect(add).toHaveBeenCalledWith('s1');
      expect(step(1)).toHaveFocus();
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });
  });

  describe('move', () => {
    it('should not offer to move the first step up or the last one down', () => {
      renderList({}, threeSteps());

      expect(screen.getByRole('button', { name: 'Move step 1 up' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Move step 3 down' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Move step 2 up' })).toBeEnabled();
    });

    it('should move a step down and renumber by position', async () => {
      const { user } = renderList({}, threeSteps());

      await user.click(screen.getByRole('button', { name: 'Move step 1 down' }));

      expect(stepTexts()).toEqual(['Rest', 'Mix', 'Bake']);
    });

    it('should keep focus on the same button of the step that moved', async () => {
      const { user } = renderList({}, threeSteps());

      await user.click(screen.getByRole('button', { name: 'Move step 1 down' }));

      expect(screen.getByRole('button', { name: 'Move step 2 down' })).toHaveFocus();
    });

    it('should hand focus to Move up when the step reaches the end', async () => {
      const { user } = renderList({}, threeSteps());

      await user.click(screen.getByRole('button', { name: 'Move step 2 down' }));

      expect(screen.getByRole('button', { name: 'Move step 3 up' })).toHaveFocus();
    });

    it('should hand focus to Move down when the step reaches the top', async () => {
      const { user } = renderList({}, threeSteps());

      await user.click(screen.getByRole('button', { name: 'Move step 2 up' }));

      expect(stepTexts()).toEqual(['Rest', 'Mix', 'Bake']);
      expect(screen.getByRole('button', { name: 'Move step 1 down' })).toHaveFocus();
    });

    it('should keep focus on Move up while the step is still below the top', async () => {
      const { user } = renderList({}, threeSteps());

      await user.click(screen.getByRole('button', { name: 'Move step 3 up' }));

      expect(screen.getByRole('button', { name: 'Move step 2 up' })).toHaveFocus();
    });

    it('should move a step with the keyboard', async () => {
      const { user } = renderList({}, threeSteps());
      screen.getByRole('button', { name: 'Move step 1 down' }).focus();

      await user.keyboard('{Enter}');

      expect(stepTexts()).toEqual(['Rest', 'Mix', 'Bake']);
    });

    it('should announce the move politely', async () => {
      const { user } = renderList({}, threeSteps());

      await user.click(screen.getByRole('button', { name: 'Move step 1 down' }));

      expect(screen.getByRole('status')).toHaveTextContent('Step 1 moved down, now step 2');
    });

    it('should announce a move up', async () => {
      const { user } = renderList({}, threeSteps());

      await user.click(screen.getByRole('button', { name: 'Move step 3 up' }));

      expect(screen.getByRole('status')).toHaveTextContent('Step 3 moved up, now step 2');
    });
  });

  describe('remove', () => {
    it('should remove the step and hand focus to the next remove button', async () => {
      const { user } = renderList({}, threeSteps());

      await user.click(screen.getByRole('button', { name: 'Remove step 1' }));

      expect(stepTexts()).toEqual(['Rest', 'Bake']);
      expect(screen.getByRole('button', { name: 'Remove step 1' })).toHaveFocus();
    });

    it('should hand focus to the previous step when the last one is removed', async () => {
      const { user } = renderList({}, threeSteps());

      await user.click(screen.getByRole('button', { name: 'Remove step 3' }));

      expect(screen.getByRole('button', { name: 'Remove step 2' })).toHaveFocus();
    });

    it('should hand focus to Add step when no step is left', async () => {
      const { user, form } = renderList();

      await user.click(screen.getByRole('button', { name: 'Remove step 1' }));

      expect(form().values.steps).toHaveLength(0);
      expect(addButton()).toHaveFocus();
    });

    it('should announce the removal politely', async () => {
      const { user } = renderList({}, threeSteps());

      await user.click(screen.getByRole('button', { name: 'Remove step 2' }));

      expect(screen.getByRole('status')).toHaveTextContent('Step 2 removed');
    });

    it('should tell the shell what was removed so it can offer undo', async () => {
      const onRowRemoved = jest.fn();
      const { user } = renderList({ onRowRemoved }, threeSteps());

      await user.click(screen.getByRole('button', { name: 'Remove step 2' }));

      expect(onRowRemoved).toHaveBeenCalledWith({ id: 's2', description: 'Rest', image: '' }, 1);
    });
  });

  describe('errors', () => {
    const emptyFirstStep = () =>
      makeValues({
        steps: [
          { id: 's1', description: '', image: '' },
          { id: 's2', description: 'Bake', image: '' },
        ],
      });

    it('should name the step and the fix once focus leaves the row', async () => {
      const { user } = renderList({}, emptyFirstStep());
      await user.click(step(1));

      await user.click(outside());

      expect(step(1)).toHaveAttribute('aria-invalid', 'true');
      expect(step(1)).toHaveAccessibleDescription('Step 1 is empty - write it or remove it');
    });

    it('should not validate while focus moves inside the row', async () => {
      const { user } = renderList({}, emptyFirstStep());
      await user.click(step(1));

      await user.tab();

      expect(within(row(1)).getByRole('button', { name: 'Add photo' })).toHaveFocus();
      expect(step(1)).toHaveAttribute('aria-invalid', 'false');
    });

    it('should clear the error as soon as the step is written', async () => {
      const { user } = renderList({}, emptyFirstStep());
      await user.click(step(1));
      await user.click(outside());

      await user.type(step(1), 'M');

      expect(step(1)).toHaveAttribute('aria-invalid', 'false');
    });

    it('should show the list error after a failed publish', () => {
      const { form } = renderList();

      act(() => {
        form().validate();
      });

      expect(screen.getByText('Add at least one step')).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Steps' })).toHaveAccessibleDescription(
        'Add at least one step'
      );
    });

    it('should show a photo problem under the photo', () => {
      const values = makeValues({
        steps: [{ id: 's1', description: 'Mix', image: 'https://example.com/old.jpg' }],
      });
      const { form } = renderList({}, values);

      act(() => {
        form().validate();
      });

      expect(screen.getByText('Step 1: upload the photo again')).toBeInTheDocument();
    });
  });

  describe('photo', () => {
    it('should count the upload while it is in flight', async () => {
      const upload = deferredUpload();
      const { form } = renderList({}, threeSteps());

      choosePhoto(2);
      await waitFor(() => expect(form().uploadsInFlight).toBe(1));
      await upload.finish();

      await waitFor(() => expect(form().uploadsInFlight).toBe(0));
    });

    it('should store the uploaded photo on its own step', async () => {
      const upload = deferredUpload();
      const { form } = renderList({}, threeSteps());

      choosePhoto(2);
      await waitFor(() => expect(global.fetch).toHaveBeenCalled());
      await upload.finish();

      await waitFor(() => expect(form().values.steps[1].image).toBe(STEP_URL));
      expect(screen.getByRole('img', { name: 'Step 2 photo (optional) preview' })).toBeVisible();
    });

    it('should keep what was typed while the upload was running', async () => {
      const upload = deferredUpload();
      const { user, form } = renderList({}, threeSteps());
      choosePhoto(1);
      await waitFor(() => expect(global.fetch).toHaveBeenCalled());

      await user.type(step(1), ' well');
      await upload.finish();

      await waitFor(() => expect(form().values.steps[0].image).toBe(STEP_URL));
      expect(form().values.steps[0].description).toBe('Mix well');
    });

    it('should keep the photo with its step when the step moves mid-upload', async () => {
      const upload = deferredUpload();
      const { user, form } = renderList({}, threeSteps());
      choosePhoto(1);
      await waitFor(() => expect(global.fetch).toHaveBeenCalled());

      await user.click(screen.getByRole('button', { name: 'Move step 1 down' }));
      await upload.finish();

      await waitFor(() =>
        expect(form().values.steps[1]).toMatchObject({ id: 's1', image: STEP_URL })
      );
    });

    it('should remove the photo of a step', async () => {
      const { user, form } = renderList({}, makeValues());

      await user.click(within(row(2)).getByRole('button', { name: 'Remove photo' }));

      expect(form().values.steps[1].image).toBe('');
    });
  });

  describe('disabled', () => {
    it('should disable every control while the form is submitting', () => {
      renderList({ disabled: true }, threeSteps());

      expect(step(1)).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Move step 2 up' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Remove step 2' })).toBeDisabled();
      expect(within(row(1)).getByRole('button', { name: 'Add photo' })).toBeDisabled();
      expect(addButton()).toBeDisabled();
    });
  });

  describe('focus by path', () => {
    it('should send a list-level issue to the first step', () => {
      const { registry } = renderList({}, threeSteps());

      act(() => {
        registry().focusField('steps');
      });

      expect(step(1)).toHaveFocus();
    });

    it('should send a list-level issue to Add step when there is no step', async () => {
      const { user, registry } = renderList();
      await user.click(screen.getByRole('button', { name: 'Remove step 1' }));
      act(() => addButton().blur());

      act(() => {
        registry().focusField('steps');
      });

      expect(addButton()).toHaveFocus();
    });

    it('should focus the text of a step by its engine path', () => {
      const { registry } = renderList({}, threeSteps());

      act(() => {
        registry().focusField('steps.s2.description');
      });

      expect(step(2)).toHaveFocus();
    });

    it('should focus the photo control of a step by its engine path', () => {
      const { registry } = renderList({}, threeSteps());

      act(() => {
        registry().focusField('steps.s3.image');
      });

      expect(within(row(3)).getByRole('button', { name: 'Add photo' })).toHaveFocus();
    });

    it('should focus the first invalid step after a failed publish', () => {
      const values = makeValues({
        steps: [
          { id: 's1', description: 'Mix', image: '' },
          { id: 's2', description: '', image: '' },
          { id: 's3', description: 'Bake', image: '' },
        ],
      });
      const { form, registry } = renderList({}, values);
      let path = '';
      act(() => {
        path = form().validate()[0].path;
      });

      act(() => {
        registry().focusField(path);
      });

      expect(step(2)).toHaveFocus();
    });

    it('should unregister the list when it unmounts', () => {
      const { registry, unmount } = renderList();
      const focusField = registry().focusField;

      unmount();

      expect(focusField('steps')).toBe(false);
    });
  });
});
