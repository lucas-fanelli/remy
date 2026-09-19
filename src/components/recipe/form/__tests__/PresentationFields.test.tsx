import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import PresentationFields, { PresentationFieldsProps } from '../PresentationFields';
import { RecipeFormValuesInput } from '../types';
import { RecipeFormApi, useRecipeForm } from '../useRecipeForm';
import { COVER_URL, makeValues } from './fixtures';

const UPLOADED_URL = 'https://res.cloudinary.com/demo/image/upload/recipes/new-cover.jpg';

const makeFile = (name = 'cover.jpg', type = 'image/jpeg') => new File(['pixels'], name, { type });

const okResponse = () => ({ ok: true, status: 200, json: async () => ({ url: UPLOADED_URL }) });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

type HarnessProps = Omit<PresentationFieldsProps, 'form'> & {
  load?: RecipeFormValuesInput;
  api: { current: RecipeFormApi | null };
};

// The real engine feeds the block: only the network is mocked
function Harness({ load, api, ...props }: HarnessProps) {
  const form = useRecipeForm({ resetKey: 'test' });
  api.current = form;
  const loaded = React.useRef(false);
  React.useEffect(() => {
    if (load && !loaded.current) form.load(load);
    loaded.current = true;
  }, [form, load]);
  return <PresentationFields form={form} {...props} />;
}

const renderFields = (props: Omit<HarnessProps, 'api'> = {}) => {
  const api: { current: RecipeFormApi | null } = { current: null };
  const view = render(<Harness api={api} {...props} />);
  return { api, user: userEvent.setup(), ...view };
};

const getDescription = () => screen.getByRole('textbox', { name: /^Description/ });
const getClosingNote = () => screen.getByRole('textbox', { name: 'Closing note (optional)' });
const getCoverTrigger = () => screen.getByRole('button', { name: /Add a cover photo/ });

const selectFile = (file: File) => {
  const input = screen.getByTestId('image-upload-input');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
};

const pasteInto = (element: HTMLElement, files: File[]) =>
  fireEvent.paste(element, { clipboardData: { files, items: [] } });

// What Excel, OneNote and Word put on the clipboard: the text AND a PNG rendering of it
const pasteClipboard = (
  element: HTMLElement,
  clipboardData: { files: File[]; types?: string[]; getData?: (format: string) => string }
) => fireEvent.paste(element, { clipboardData: { items: [], ...clipboardData } });

describe('PresentationFields', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockReset();
  });

  describe('layout and labels', () => {
    it('should render the cover, the description and the optional closing note', () => {
      renderFields();

      expect(screen.getByRole('group', { name: /Cover photo/ })).toBeInTheDocument();
      expect(getDescription()).toBeRequired();
      expect(getClosingNote()).not.toBeRequired();
    });

    it('should lay the block out as a CSS grid', () => {
      const { container } = renderFields();

      expect(container.firstElementChild).toHaveStyle({ display: 'grid' });
    });

    it('should follow the tab order cover, description, closing note', async () => {
      const { user } = renderFields();

      await user.tab();
      expect(getCoverTrigger()).toHaveFocus();
      await user.tab();
      expect(getDescription()).toHaveFocus();
      await user.tab();
      expect(getClosingNote()).toHaveFocus();
    });

    it('should cap both texts and capitalise sentences on touch keyboards', () => {
      renderFields();

      expect(getDescription()).toHaveAttribute('maxlength', '500');
      expect(getDescription()).toHaveAttribute('autocapitalize', 'sentences');
      expect(getClosingNote()).toHaveAttribute('maxlength', '500');
    });

    it('should say where the closing note is shown', () => {
      renderFields();

      expect(getClosingNote()).toHaveAccessibleDescription('Shown as a quote after the last step');
    });
  });

  describe('typing', () => {
    it('should write the description into the form', async () => {
      const { api, user } = renderFields();

      await user.type(getDescription(), 'La clasica');

      expect(api.current?.values.description).toBe('La clasica');
    });

    it('should write the closing note into the form', async () => {
      const { api, user } = renderFields();

      await user.type(getClosingNote(), 'Better the next day');

      expect(api.current?.values.caption).toBe('Better the next day');
    });

    it('should keep Enter as a line break in the description', async () => {
      const { api, user } = renderFields();

      await user.type(getDescription(), 'one{Enter}two');

      expect(api.current?.values.description).toBe('one\ntwo');
    });
  });

  describe('counters', () => {
    it('should always show the description counter', () => {
      renderFields();

      expect(screen.getByText('0/500')).toBeInTheDocument();
    });

    it('should emphasise the counter with weight, not colour, from 90%', () => {
      renderFields({ load: makeValues({ description: 'x'.repeat(450) }) });

      expect(screen.getByText('450/500')).toHaveStyle({ fontWeight: '600' });
    });

    it('should not emphasise the counter below 90%', () => {
      renderFields({ load: makeValues({ description: 'x'.repeat(100) }) });

      expect(screen.getByText('100/500')).not.toHaveStyle({ fontWeight: '600' });
    });

    it('should hide the closing note counter below 80%', () => {
      renderFields({ load: makeValues({ caption: 'x'.repeat(399) }) });

      expect(screen.queryByText('399/500')).not.toBeInTheDocument();
    });

    it('should show the closing note counter from 80%', () => {
      renderFields({ load: makeValues({ caption: 'x'.repeat(400) }) });

      expect(screen.getByText('400/500')).toBeInTheDocument();
    });
  });

  describe('errors', () => {
    it('should show nothing red at rest', () => {
      renderFields();

      expect(getDescription()).toHaveAttribute('aria-invalid', 'false');
      expect(screen.queryByText('Add a short description')).not.toBeInTheDocument();
      expect(screen.queryByText(/Add a cover photo \(JPG/)).not.toBeInTheDocument();
    });

    it('should validate the description on its first blur', async () => {
      const { user } = renderFields();
      await user.click(getDescription());

      await user.tab();

      expect(getDescription()).toHaveAttribute('aria-invalid', 'true');
      expect(getDescription()).toHaveAccessibleDescription(/Add a short description/);
    });

    it('should clear the error while typing once it is shown', async () => {
      const { user } = renderFields();
      await user.click(getDescription());
      await user.tab();

      await user.type(getDescription(), 'Tasty');

      expect(getDescription()).toHaveAttribute('aria-invalid', 'false');
    });

    it('should name the missing cover after a failed Publish', () => {
      const { api } = renderFields();

      act(() => {
        api.current?.validate();
      });

      expect(screen.getByText('Add a cover photo (JPG, PNG, WebP or GIF)')).toBeInTheDocument();
    });

    it('should touch the closing note on blur without inventing an error', async () => {
      const { api, user } = renderFields();
      await user.click(getClosingNote());

      await user.tab();

      expect(api.current?.touched.caption).toBe(true);
      expect(getClosingNote()).toHaveAttribute('aria-invalid', 'false');
    });
  });

  describe('cover upload', () => {
    it('should count the upload as in flight and store the URL when it settles', async () => {
      const request = deferred<ReturnType<typeof okResponse>>();
      mockFetch.mockReturnValueOnce(request.promise);
      const { api } = renderFields();

      selectFile(makeFile());
      await waitFor(() => expect(api.current?.uploadsInFlight).toBe(1));
      await act(async () => {
        request.resolve(okResponse());
      });

      await waitFor(() => expect(api.current?.uploadsInFlight).toBe(0));
      expect(api.current?.values.imageUrl).toBe(UPLOADED_URL);
    });

    it('should paint the feed badges over the uploaded cover', () => {
      renderFields({
        load: makeValues({
          imageUrl: COVER_URL,
          difficulty: 'hard',
          prepTime: 15,
          cookingTime: 30,
        }),
      });

      expect(screen.getByRole('img', { name: 'Cover photo preview' })).toBeInTheDocument();
      expect(screen.getByText('hard')).toBeInTheDocument();
      expect(screen.getByText('45 min')).toBeInTheDocument();
    });

    it('should count an untyped time as zero in the badge', () => {
      renderFields({ load: makeValues({ imageUrl: COVER_URL, prepTime: '', cookingTime: 20 }) });

      expect(screen.getByText('20 min')).toBeInTheDocument();
    });

    it('should report a cover that no longer loads', () => {
      const onCoverBrokenChange = jest.fn();
      renderFields({ load: makeValues({ imageUrl: COVER_URL }), onCoverBrokenChange });

      fireEvent.error(screen.getByRole('img', { name: 'Cover photo preview' }));

      expect(onCoverBrokenChange).toHaveBeenLastCalledWith(true);
    });
  });

  describe('paste', () => {
    it('should feed the cover with an image pasted into the description', async () => {
      mockFetch.mockResolvedValueOnce(okResponse());
      const { api } = renderFields();

      pasteInto(getDescription(), [makeFile('pasted.png', 'image/png')]);

      await waitFor(() => expect(api.current?.values.imageUrl).toBe(UPLOADED_URL));
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should keep the pasted image out of the text field', () => {
      mockFetch.mockReturnValueOnce(new Promise(() => undefined));
      renderFields();

      const notCancelled = pasteInto(getClosingNote(), [makeFile('pasted.png', 'image/png')]);

      expect(notCancelled).toBe(false);
    });

    it('should let a text paste through untouched', () => {
      renderFields();

      const notCancelled = pasteInto(getDescription(), []);

      expect(notCancelled).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should leave a paste that carries text next to its image rendering to the field', () => {
      const { api } = renderFields({ load: makeValues({ imageUrl: COVER_URL }) });

      const notCancelled = pasteClipboard(getDescription(), {
        files: [makeFile('cells.png', 'image/png')],
        types: ['text/plain', 'text/html', 'Files'],
        getData: (format) => (format === 'text/plain' ? 'Flour 200 g' : ''),
      });

      expect(notCancelled).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(api.current?.uploadsInFlight).toBe(0);
      expect(api.current?.values.imageUrl).toBe(COVER_URL);
    });

    it('should detect the text of a clipboard that does not list its types', () => {
      renderFields();

      const notCancelled = pasteClipboard(getClosingNote(), {
        files: [makeFile('cells.png', 'image/png')],
        getData: (format) => (format === 'text/plain' ? 'Better the next day' : ''),
      });

      expect(notCancelled).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should still feed the cover with an image copied from a web page', async () => {
      mockFetch.mockResolvedValueOnce(okResponse());
      const { api } = renderFields();

      // 'Copy image' in a browser: the file plus an <img> tag as text/html, no plain text
      pasteClipboard(getDescription(), {
        files: [makeFile('copied.png', 'image/png')],
        types: ['text/html', 'Files'],
        getData: () => '',
      });

      await waitFor(() => expect(api.current?.values.imageUrl).toBe(UPLOADED_URL));
    });

    it('should upload a pasted image once when it lands on the cover itself', async () => {
      mockFetch.mockResolvedValueOnce(okResponse());
      const { api } = renderFields();

      pasteInto(getCoverTrigger(), [makeFile('pasted.png', 'image/png')]);

      await waitFor(() => expect(api.current?.values.imageUrl).toBe(UPLOADED_URL));
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should ignore a paste while the cover is already uploading', async () => {
      mockFetch.mockReturnValue(new Promise(() => undefined));
      const { api } = renderFields();
      selectFile(makeFile());
      await waitFor(() => expect(api.current?.uploadsInFlight).toBe(1));

      pasteInto(getDescription(), [makeFile('pasted.png', 'image/png')]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should ignore a paste while the form is submitting', () => {
      renderFields({ disabled: true });

      pasteInto(getDescription(), [makeFile('pasted.png', 'image/png')]);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('submitting', () => {
    it('should disable the texts and the cover trigger', () => {
      renderFields({ disabled: true });

      expect(getDescription()).toBeDisabled();
      expect(getClosingNote()).toBeDisabled();
      expect(getCoverTrigger()).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('registerField', () => {
    it('should register the three controls by error path', () => {
      const registerField = jest.fn();

      renderFields({ registerField });

      expect(registerField).toHaveBeenCalledWith('description', getDescription());
      expect(registerField).toHaveBeenCalledWith('caption', getClosingNote());
      expect(registerField).toHaveBeenCalledWith(
        'imageUrl',
        expect.objectContaining({ focus: expect.any(Function), cancel: expect.any(Function) })
      );
    });

    it('should hand out a cover target that can take the focus', () => {
      const targets = new Map<string, { focus(): void } | null>();
      renderFields({ registerField: (path, target) => targets.set(path, target) });

      act(() => targets.get('imageUrl')?.focus());

      expect(getCoverTrigger()).toHaveFocus();
    });

    it('should unregister the controls when the block unmounts', () => {
      const registerField = jest.fn();
      const { unmount } = renderFields({ registerField });

      unmount();

      expect(registerField).toHaveBeenCalledWith('imageUrl', null);
      expect(registerField).toHaveBeenCalledWith('description', null);
      expect(registerField).toHaveBeenCalledWith('caption', null);
    });
  });
});
