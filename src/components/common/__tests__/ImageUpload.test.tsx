/**
 * ImageUpload (S8) - rewritten on purpose. The previous suite pinned the red
 * typed asterisk, the error border at rest and a MuiCard click target; all three
 * are gone. The shared framer-motion mock is used as-is (no inline jest.mock).
 */
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import React, { useState } from 'react';
import '@testing-library/jest-dom';
import ImageUpload, {
  BROKEN_IMAGE_MESSAGE,
  type ImageUploadHandle,
  type ImageUploadProps,
} from '../ImageUpload';

const theme = createTheme();
const UPLOADED_URL = 'https://res.cloudinary.com/remy/uploaded.jpg';
const EXISTING_URL = 'https://res.cloudinary.com/remy/existing.jpg';

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

type HarnessProps = Partial<ImageUploadProps> & {
  initialValue?: string;
  handleRef?: React.Ref<ImageUploadHandle>;
};

/** Controlled parent: keeps `value` in state like a real form does. */
function Harness({ initialValue = '', onChange, handleRef, ...props }: HarnessProps) {
  const [value, setValue] = useState(initialValue);
  return (
    <ImageUpload
      ref={handleRef}
      {...props}
      value={value}
      onChange={(url) => {
        setValue(url);
        onChange?.(url);
      }}
    />
  );
}

const makeFile = (name = 'photo.jpg', type = 'image/jpeg', size?: number) => {
  const file = new File(['pixels'], name, { type });
  if (size !== undefined) Object.defineProperty(file, 'size', { value: size });
  return file;
};

const getInput = () => screen.getByTestId('image-upload-input') as HTMLInputElement;

const selectFile = (file: File | null) => {
  const input = getInput();
  Object.defineProperty(input, 'files', { value: file ? [file] : null, configurable: true });
  fireEvent.change(input);
};

const okResponse = (body: unknown = { url: UPLOADED_URL }) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

const errorResponse = (status: number, body: unknown, headers?: Record<string, string>) => ({
  ok: false,
  status,
  json: async () => body,
  headers: headers ? { get: (name: string) => headers[name] ?? null } : undefined,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const getTrigger = () => screen.getByRole('button', { name: /add a cover photo/i });

describe('ImageUpload', () => {
  let mockFetch: jest.Mock;
  const onChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockReset();
  });

  describe('at rest', () => {
    it('should render the label, the prompt and the accepted formats', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} />);

      expect(screen.getByText('Cover photo')).toBeInTheDocument();
      expect(screen.getByText('Add a cover photo')).toBeInTheDocument();
      expect(screen.getByText('Drop, paste or click - JPG, PNG, WebP or GIF')).toBeInTheDocument();
    });

    it('should show a custom label', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} label="Recipe Image" />);

      expect(screen.getByText('Recipe Image')).toBeInTheDocument();
    });

    it('should mark a required field through MUI, outside the accessible name', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} required />);

      const asterisk = document.querySelector('.MuiFormLabel-asterisk');
      expect(asterisk).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getByRole('group', { name: 'Cover photo' })).toBeInTheDocument();
    });

    it('should not mark an optional field as required', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} required={false} />);

      expect(document.querySelector('.MuiFormLabel-asterisk')).not.toBeInTheDocument();
    });

    it('should not be in an error state before the form says so', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} required />);

      expect(document.querySelector('.Mui-error')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should show the error state and message passed by the form', () => {
      renderWithTheme(
        <ImageUpload
          value=""
          onChange={onChange}
          error
          helperText="Add a cover photo (JPG, PNG, WebP or GIF)"
        />
      );

      const helper = screen.getByText('Add a cover photo (JPG, PNG, WebP or GIF)');
      expect(helper).toHaveClass('Mui-error');
      expect(screen.getByText('Cover photo')).toHaveClass('Mui-error');
    });

    it('should not announce the form error as an alert of its own', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} error helperText="Add a photo" />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should show a neutral helper text without an error', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} helperText="Shown in the feed" />);

      expect(screen.getByText('Shown in the feed')).not.toHaveClass('Mui-error');
    });

    it('should describe the trigger with the hint and the helper text', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} helperText="Shown in the feed" />);

      expect(getTrigger()).toHaveAccessibleDescription(
        'Drop, paste or click - JPG, PNG, WebP or GIF Shown in the feed'
      );
    });

    it('should expose a focusable, non-label trigger', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} />);

      const trigger = getTrigger();
      expect(trigger.tagName).toBe('DIV');
      expect(trigger).toHaveAttribute('tabindex', '0');
    });

    it('should keep the file input out of the tab order and the accessibility tree', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} />);

      const input = getInput();
      expect(input).toHaveAttribute('tabindex', '-1');
      expect(input).toHaveAttribute('aria-hidden', 'true');
      expect(input).not.toHaveStyle({ display: 'none' });
      expect(input).toHaveAttribute(
        'accept',
        'image/jpeg,image/jpg,image/png,image/webp,image/gif'
      );
    });

    it('should not render the overlay while there is no photo', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} overlay={<span>30 min</span>} />);

      expect(screen.queryByText('30 min')).not.toBeInTheDocument();
    });
  });

  describe('opening the picker', () => {
    it('should open the picker on click', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} />);
      const clickSpy = jest.spyOn(getInput(), 'click');

      fireEvent.click(getTrigger());

      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('should open the picker with Enter', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} />);
      const clickSpy = jest.spyOn(getInput(), 'click');

      fireEvent.keyDown(getTrigger(), { key: 'Enter' });

      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('should open the picker with Space', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} />);
      const clickSpy = jest.spyOn(getInput(), 'click');
      const trigger = getTrigger();

      fireEvent.keyDown(trigger, { key: ' ' });
      fireEvent.keyUp(trigger, { key: ' ' });

      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('should not open the picker when disabled', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} disabled />);
      const clickSpy = jest.spyOn(getInput(), 'click');
      const trigger = getTrigger();

      fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('aria-disabled', 'true');
      expect(trigger).toHaveAttribute('tabindex', '-1');
      expect(getInput()).toBeDisabled();
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('should ignore a change event without a file', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} />);

      selectFile(null);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(getTrigger()).toBeInTheDocument();
    });
  });

  describe('uploading', () => {
    it('should post the file to /api/upload with the CSRF header', async () => {
      mockFetch.mockResolvedValueOnce(okResponse());
      renderWithTheme(<Harness onChange={onChange} />);
      const file = makeFile();

      selectFile(file);

      await waitFor(() => expect(onChange).toHaveBeenCalled());
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/upload');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({ 'X-Requested-With': 'fetch' });
      expect((init.body as FormData).get('file')).toBe(file);
    });

    it('should show an instant local preview with progress', async () => {
      mockFetch.mockReturnValueOnce(deferred().promise);
      renderWithTheme(<Harness onChange={onChange} />);

      selectFile(makeFile());

      const preview = await screen.findByAltText('Cover photo preview');
      expect(preview).toHaveAttribute('src', 'blob:mock-url');
      expect(screen.getByRole('progressbar', { name: 'Uploading photo' })).toBeInTheDocument();
      expect(screen.getByText('Uploading...')).toBeInTheDocument();
    });

    it('should make the trigger inert while uploading', async () => {
      mockFetch.mockReturnValueOnce(deferred().promise);
      renderWithTheme(<Harness onChange={onChange} />);

      selectFile(makeFile());

      await screen.findByRole('progressbar');
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should upload without a preview when object URLs are unavailable', async () => {
      const original = URL.createObjectURL;
      (URL as any).createObjectURL = undefined;
      mockFetch.mockReturnValueOnce(deferred().promise);
      renderWithTheme(<Harness onChange={onChange} />);

      selectFile(makeFile());

      await screen.findByRole('progressbar');
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      URL.createObjectURL = original;
    });

    it('should survive createObjectURL throwing', async () => {
      (URL.createObjectURL as jest.Mock).mockImplementationOnce(() => {
        throw new Error('quota');
      });
      mockFetch.mockResolvedValueOnce(okResponse());
      renderWithTheme(<Harness onChange={onChange} />);

      selectFile(makeFile());

      await waitFor(() => expect(onChange).toHaveBeenCalledWith(UPLOADED_URL));
    });

    it('should report when an upload starts and settles', async () => {
      const onUploadingChange = jest.fn();
      const pending = deferred<ReturnType<typeof okResponse>>();
      mockFetch.mockReturnValueOnce(pending.promise);
      renderWithTheme(<Harness onChange={onChange} onUploadingChange={onUploadingChange} />);

      selectFile(makeFile());
      await screen.findByRole('progressbar');
      expect(onUploadingChange.mock.calls).toEqual([[true]]);
      await act(async () => pending.resolve(okResponse()));

      await waitFor(() => expect(onUploadingChange.mock.calls).toEqual([[true], [false]]));
    });

    it('should hand the uploaded url to onChange and release the blob', async () => {
      mockFetch.mockResolvedValueOnce(okResponse());
      renderWithTheme(<Harness onChange={onChange} />);

      selectFile(makeFile());

      await waitFor(() => expect(onChange).toHaveBeenCalledWith(UPLOADED_URL));
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
      expect(screen.getByAltText('Cover photo preview')).toHaveAttribute('src', UPLOADED_URL);
    });

    it('should move focus to Replace after a successful upload', async () => {
      mockFetch.mockResolvedValueOnce(okResponse());
      renderWithTheme(<Harness onChange={onChange} />);

      selectFile(makeFile());

      const replace = await screen.findByRole('button', { name: 'Replace photo' });
      expect(replace).toHaveFocus();
    });

    it('should not steal focus from a field the user moved to meanwhile', async () => {
      const pending = deferred<ReturnType<typeof okResponse>>();
      mockFetch.mockReturnValueOnce(pending.promise);
      renderWithTheme(
        <>
          <Harness onChange={onChange} />
          <input aria-label="Description" />
        </>
      );
      selectFile(makeFile());
      await screen.findByRole('progressbar');
      screen.getByLabelText('Description').focus();

      await act(async () => pending.resolve(okResponse()));

      await screen.findByRole('button', { name: 'Replace photo' });
      expect(screen.getByLabelText('Description')).toHaveFocus();
    });

    it('should reset the input so the same file can be chosen again', async () => {
      mockFetch.mockResolvedValueOnce(okResponse());
      renderWithTheme(<Harness onChange={onChange} />);
      const valueSetter = jest.spyOn(getInput(), 'value', 'set');

      selectFile(makeFile());

      await waitFor(() => expect(onChange).toHaveBeenCalled());
      expect(valueSetter).toHaveBeenCalledWith('');
    });

    it('should keep delivering the url after the field unmounts', async () => {
      const onUploadingChange = jest.fn();
      const pending = deferred<ReturnType<typeof okResponse>>();
      mockFetch.mockReturnValueOnce(pending.promise);
      const { unmount } = renderWithTheme(
        <ImageUpload value="" onChange={onChange} onUploadingChange={onUploadingChange} />
      );
      selectFile(makeFile());
      await screen.findByRole('progressbar');

      unmount();
      await act(async () => pending.resolve(okResponse()));

      await waitFor(() => expect(onChange).toHaveBeenCalledWith(UPLOADED_URL));
      expect(onUploadingChange).toHaveBeenLastCalledWith(false);
    });

    it('should release the blob preview on unmount', async () => {
      mockFetch.mockReturnValueOnce(deferred().promise);
      const { unmount } = renderWithTheme(<ImageUpload value="" onChange={onChange} />);
      selectFile(makeFile());
      await screen.findByRole('progressbar');

      unmount();

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('should call the latest onChange when the parent re-rendered meanwhile', async () => {
      const pending = deferred<ReturnType<typeof okResponse>>();
      mockFetch.mockReturnValueOnce(pending.promise);
      const staleOnChange = jest.fn();
      const { rerender } = renderWithTheme(<ImageUpload value="" onChange={staleOnChange} />);
      selectFile(makeFile());
      await screen.findByRole('progressbar');

      rerender(
        <ThemeProvider theme={theme}>
          <ImageUpload value="" onChange={onChange} />
        </ThemeProvider>
      );
      await act(async () => pending.resolve(okResponse()));

      await waitFor(() => expect(onChange).toHaveBeenCalledWith(UPLOADED_URL));
      expect(staleOnChange).not.toHaveBeenCalled();
    });

    it('should let a newer upload supersede an older one', async () => {
      const first = deferred<ReturnType<typeof okResponse>>();
      const handle = React.createRef<ImageUploadHandle>();
      mockFetch
        .mockReturnValueOnce(first.promise)
        .mockResolvedValueOnce(okResponse({ url: 'https://res.cloudinary.com/remy/second.jpg' }));
      renderWithTheme(<Harness onChange={onChange} handleRef={handle} />);
      selectFile(makeFile('first.jpg'));
      await screen.findByRole('progressbar');

      act(() => handle.current!.uploadFile(makeFile('second.jpg')));
      await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
      await act(async () => first.resolve(okResponse()));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('https://res.cloudinary.com/remy/second.jpg');
    });

    it('should ignore a superseded upload that fails later', async () => {
      const first = deferred<never>();
      const handle = React.createRef<ImageUploadHandle>();
      mockFetch.mockReturnValueOnce(first.promise).mockResolvedValueOnce(okResponse());
      renderWithTheme(<Harness onChange={onChange} handleRef={handle} />);
      selectFile(makeFile('first.jpg'));
      await screen.findByRole('progressbar');

      act(() => handle.current!.uploadFile(makeFile('second.jpg')));
      await waitFor(() => expect(onChange).toHaveBeenCalledWith(UPLOADED_URL));
      await act(async () => first.reject(new TypeError('Failed to fetch')));

      expect(screen.queryByText('Upload failed')).not.toBeInTheDocument();
    });
  });

  describe('client-side checks', () => {
    const originalCreateImageBitmap = (global as any).createImageBitmap;

    afterEach(() => {
      (global as any).createImageBitmap = originalCreateImageBitmap;
      jest.restoreAllMocks();
    });

    it('should reject an unsupported file type without uploading', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} />);

      selectFile(makeFile('notes.txt', 'text/plain'));

      expect(screen.getByRole('alert')).toHaveTextContent('Choose a JPG, PNG, WebP or GIF image');
      expect(mockFetch).not.toHaveBeenCalled();
      expect(getTrigger()).toBeInTheDocument();
    });

    it('should clear the type error once a valid photo is chosen', async () => {
      mockFetch.mockReturnValueOnce(deferred().promise);
      renderWithTheme(<ImageUpload value="" onChange={onChange} />);
      selectFile(makeFile('notes.txt', 'text/plain'));

      selectFile(makeFile());

      await screen.findByRole('progressbar');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should reject a photo that is still too large, naming its size', async () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} />);

      selectFile(makeFile('huge.jpg', 'image/jpeg', 8.2 * 1024 * 1024));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'This photo is 8.2 MB and could not be reduced below 5 MB - choose another one'
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not offer Retry for a photo that is too large', async () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} />);

      selectFile(makeFile('huge.jpg', 'image/jpeg', 8.2 * 1024 * 1024));

      const chooseAnother = await screen.findByRole('button', { name: 'Choose another photo' });
      expect(screen.queryByRole('button', { name: 'Retry upload' })).not.toBeInTheDocument();
      expect(chooseAnother).toHaveFocus();
    });

    it('should drop an upload that is superseded while it is being prepared', async () => {
      const decoding = deferred<never>();
      (global as any).createImageBitmap = jest
        .fn()
        .mockReturnValueOnce(decoding.promise)
        .mockRejectedValue(new Error('decode'));
      const handle = React.createRef<ImageUploadHandle>();
      mockFetch.mockResolvedValue(okResponse());
      renderWithTheme(<Harness onChange={onChange} handleRef={handle} />);
      selectFile(makeFile('first.jpg'));
      await screen.findByRole('progressbar');

      act(() => handle.current!.uploadFile(makeFile('second.jpg')));
      await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
      await act(async () => decoding.reject(new Error('decode')));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect((mockFetch.mock.calls[0][1].body as FormData).get('file')).toHaveProperty(
        'name',
        'second.jpg'
      );
    });

    it('should upload the downscaled JPEG when the browser can produce one', async () => {
      (global as any).createImageBitmap = jest
        .fn()
        .mockResolvedValue({ width: 4000, height: 3000, close: jest.fn() });
      jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillStyle: '',
        fillRect: jest.fn(),
        drawImage: jest.fn(),
      } as any);
      jest
        .spyOn(HTMLCanvasElement.prototype, 'toBlob')
        .mockImplementation((callback) => callback(new Blob(['jpeg'], { type: 'image/jpeg' })));
      mockFetch.mockResolvedValueOnce(okResponse());
      renderWithTheme(<Harness onChange={onChange} />);

      selectFile(makeFile('huge.png', 'image/png', 8.2 * 1024 * 1024));

      await waitFor(() => expect(onChange).toHaveBeenCalledWith(UPLOADED_URL));
      const sent = (mockFetch.mock.calls[0][1].body as FormData).get('file') as File;
      expect(sent.type).toBe('image/jpeg');
      expect(sent.name).toBe('huge.jpg');
    });
  });

  describe('failed upload', () => {
    const failWith = async (response: unknown) => {
      mockFetch.mockResolvedValueOnce(response);
      renderWithTheme(<Harness onChange={onChange} />);
      selectFile(makeFile());
      return screen.findByRole('alert');
    };

    it('should show the server message under the tile', async () => {
      const alert = await failWith(errorResponse(400, { error: 'No valid file provided' }));

      expect(alert).toHaveTextContent('No valid file provided');
      expect(alert).toHaveClass('Mui-error');
      expect(screen.getByText('Upload failed')).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should keep a greyscale preview of the failed photo', async () => {
      await failWith(errorResponse(500, {}));

      expect(screen.getByAltText('Cover photo preview')).toHaveStyle({ filter: 'grayscale(1)' });
    });

    it('should explain an expired session on 401', async () => {
      const alert = await failWith(errorResponse(401, { error: 'Unauthorized' }));

      expect(alert).toHaveTextContent('Your session expired - your draft is saved');
    });

    it('should say when to try again on 429', async () => {
      const alert = await failWith(
        errorResponse(429, { error: 'Too many requests' }, { 'Retry-After': '300' })
      );

      expect(alert).toHaveTextContent('Too many uploads - try again in 5 min');
    });

    it('should survive an error page that is not JSON', async () => {
      const alert = await failWith({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      });

      expect(alert).toHaveTextContent('Upload failed');
    });

    it('should fail when a successful response carries no url', async () => {
      const alert = await failWith(okResponse({}));

      expect(alert).toHaveTextContent('Upload failed');
    });

    it('should fail when a successful response is not an object', async () => {
      const alert = await failWith(okResponse(null));

      expect(alert).toHaveTextContent('Upload failed');
    });

    it('should report a network failure', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      renderWithTheme(<Harness onChange={onChange} />);

      selectFile(makeFile());

      expect(await screen.findByRole('alert')).toHaveTextContent('No connection - Retry');
    });

    it('should report that the upload settled', async () => {
      const onUploadingChange = jest.fn();
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      renderWithTheme(<Harness onChange={onChange} onUploadingChange={onUploadingChange} />);

      selectFile(makeFile());

      await screen.findByRole('alert');
      expect(onUploadingChange.mock.calls).toEqual([[true], [false]]);
    });

    it('should move focus to Retry', async () => {
      await failWith(errorResponse(500, {}));

      expect(screen.getByRole('button', { name: 'Retry upload' })).toHaveFocus();
    });

    it('should retry with the same file', async () => {
      const file = makeFile('again.jpg');
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      renderWithTheme(<Harness onChange={onChange} />);
      selectFile(file);
      const retry = await screen.findByRole('button', { name: 'Retry upload' });
      mockFetch.mockResolvedValueOnce(okResponse());

      fireEvent.click(retry);

      await waitFor(() => expect(onChange).toHaveBeenCalledWith(UPLOADED_URL));
      expect((mockFetch.mock.calls[1][1].body as FormData).get('file')).toBe(file);
    });

    it('should open the picker from Choose another', async () => {
      await failWith(errorResponse(500, {}));
      const clickSpy = jest.spyOn(getInput(), 'click');

      fireEvent.click(screen.getByRole('button', { name: 'Choose another photo' }));

      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('should go back to rest and focus the trigger on Cancel', async () => {
      await failWith(errorResponse(500, {}));

      fireEvent.click(screen.getByRole('button', { name: 'Cancel upload' }));

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(getTrigger()).toHaveFocus();
    });

    it('should go back to the current photo when a replacement is cancelled', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(500, {}));
      renderWithTheme(<Harness initialValue={EXISTING_URL} onChange={onChange} />);
      selectFile(makeFile());
      await screen.findByRole('alert');

      fireEvent.click(screen.getByRole('button', { name: 'Cancel upload' }));

      expect(screen.getByAltText('Cover photo preview')).toHaveAttribute('src', EXISTING_URL);
      expect(screen.getByRole('button', { name: 'Replace photo' })).toHaveFocus();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should disable the recovery actions while the form is disabled', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(500, {}));
      const { rerender } = renderWithTheme(<ImageUpload value="" onChange={onChange} />);
      selectFile(makeFile());
      await screen.findByRole('alert');

      rerender(
        <ThemeProvider theme={theme}>
          <ImageUpload value="" onChange={onChange} disabled />
        </ThemeProvider>
      );

      expect(screen.getByRole('button', { name: 'Retry upload' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Choose another photo' })).toBeDisabled();
    });
  });

  describe('filled', () => {
    it('should render the photo with an alt built from the label', () => {
      renderWithTheme(
        <ImageUpload value={EXISTING_URL} onChange={onChange} label="Recipe Image" />
      );

      const image = screen.getByAltText('Recipe Image preview');
      expect(image).toHaveAttribute('src', EXISTING_URL);
    });

    it('should not be a button itself', () => {
      renderWithTheme(<ImageUpload value={EXISTING_URL} onChange={onChange} />);

      expect(screen.queryByRole('button', { name: /add a cover photo/i })).not.toBeInTheDocument();
      expect(screen.getAllByRole('button')).toHaveLength(2);
    });

    it('should open the picker from Replace', () => {
      renderWithTheme(<ImageUpload value={EXISTING_URL} onChange={onChange} />);
      const clickSpy = jest.spyOn(getInput(), 'click');

      fireEvent.click(screen.getByRole('button', { name: 'Replace photo' }));

      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('should clear the value from Remove', () => {
      renderWithTheme(<ImageUpload value={EXISTING_URL} onChange={onChange} />);

      fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));

      expect(onChange).toHaveBeenCalledWith('');
    });

    it('should move focus to the trigger after Remove', () => {
      renderWithTheme(<Harness initialValue={EXISTING_URL} onChange={onChange} />);

      fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));

      expect(getTrigger()).toHaveFocus();
    });

    it('should paint the overlay slot over the photo', () => {
      renderWithTheme(
        <ImageUpload value={EXISTING_URL} onChange={onChange} overlay={<span>45 min</span>} />
      );

      expect(screen.getByText('45 min')).toBeInTheDocument();
    });

    it('should disable Replace and Remove when disabled', () => {
      renderWithTheme(<ImageUpload value={EXISTING_URL} onChange={onChange} disabled />);

      expect(screen.getByRole('button', { name: 'Replace photo' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Remove photo' })).toBeDisabled();
    });

    it('should show a type error under the photo without dropping it', () => {
      renderWithTheme(<ImageUpload value={EXISTING_URL} onChange={onChange} />);

      selectFile(makeFile('notes.txt', 'text/plain'));

      expect(screen.getByRole('alert')).toHaveTextContent('Choose a JPG, PNG, WebP or GIF image');
      expect(screen.getByAltText('Cover photo preview')).toHaveAttribute('src', EXISTING_URL);
    });
  });

  describe('broken photo', () => {
    it('should flag a stored photo that cannot be loaded', () => {
      renderWithTheme(<ImageUpload value={EXISTING_URL} onChange={onChange} />);

      fireEvent.error(screen.getByAltText('Cover photo preview'));

      expect(screen.getByRole('alert')).toHaveTextContent(BROKEN_IMAGE_MESSAGE);
      expect(screen.getByText('Photo unavailable')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('should flag a server-rendered photo that failed before React attached onError', () => {
      const complete = jest
        .spyOn(HTMLImageElement.prototype, 'complete', 'get')
        .mockReturnValue(true);
      const naturalWidth = jest
        .spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get')
        .mockReturnValue(0);

      renderWithTheme(<ImageUpload value={EXISTING_URL} onChange={onChange} />);

      expect(screen.getByRole('alert')).toHaveTextContent(BROKEN_IMAGE_MESSAGE);
      complete.mockRestore();
      naturalWidth.mockRestore();
    });

    it('should keep a photo that had already loaded on mount', () => {
      const complete = jest
        .spyOn(HTMLImageElement.prototype, 'complete', 'get')
        .mockReturnValue(true);
      const naturalWidth = jest
        .spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get')
        .mockReturnValue(1200);

      renderWithTheme(<ImageUpload value={EXISTING_URL} onChange={onChange} />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      complete.mockRestore();
      naturalWidth.mockRestore();
    });

    it('should tell the form when the photo breaks', () => {
      const onBrokenChange = jest.fn();
      renderWithTheme(
        <ImageUpload value={EXISTING_URL} onChange={onChange} onBrokenChange={onBrokenChange} />
      );

      fireEvent.error(screen.getByAltText('Cover photo preview'));

      expect(onBrokenChange.mock.calls).toEqual([[true]]);
    });

    it('should tell the form when the broken photo is replaced', async () => {
      const onBrokenChange = jest.fn();
      mockFetch.mockResolvedValueOnce(okResponse());
      renderWithTheme(
        <Harness initialValue={EXISTING_URL} onChange={onChange} onBrokenChange={onBrokenChange} />
      );
      fireEvent.error(screen.getByAltText('Cover photo preview'));

      selectFile(makeFile());

      await waitFor(() => expect(onBrokenChange.mock.calls).toEqual([[true], [false]]));
      expect(screen.getByAltText('Cover photo preview')).toHaveAttribute('src', UPLOADED_URL);
    });

    it('should offer Replace and Remove', () => {
      renderWithTheme(<Harness initialValue={EXISTING_URL} onChange={onChange} />);
      fireEvent.error(screen.getByAltText('Cover photo preview'));

      fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));

      expect(onChange).toHaveBeenCalledWith('');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should open the picker from Replace', () => {
      renderWithTheme(<ImageUpload value={EXISTING_URL} onChange={onChange} />);
      fireEvent.error(screen.getByAltText('Cover photo preview'));
      const clickSpy = jest.spyOn(getInput(), 'click');

      fireEvent.click(screen.getByRole('button', { name: 'Replace photo' }));

      expect(clickSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('drag and drop', () => {
    it('should invite the drop while a file is dragged over', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} />);

      fireEvent.dragEnter(getTrigger(), { dataTransfer: { files: [] } });

      expect(screen.getByText('Drop to upload')).toBeInTheDocument();
    });

    it('should go back to the prompt when the drag leaves', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} />);
      fireEvent.dragOver(getTrigger(), { dataTransfer: { files: [] } });

      fireEvent.dragLeave(screen.getByRole('button', { name: /drop to upload/i }), {
        relatedTarget: document.body,
      });

      expect(screen.getByText('Add a cover photo')).toBeInTheDocument();
    });

    it('should keep inviting while the drag moves over a child', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} />);
      fireEvent.dragOver(getTrigger(), { dataTransfer: { files: [] } });
      const trigger = screen.getByRole('button', { name: /drop to upload/i });

      // jsdom has no DragEvent, so testing-library drops `relatedTarget` from the init
      const leave = createEvent.dragLeave(trigger);
      Object.defineProperty(leave, 'relatedTarget', { value: screen.getByText('Drop to upload') });
      fireEvent(trigger, leave);

      expect(screen.getByText('Drop to upload')).toBeInTheDocument();
    });

    it('should upload a dropped photo', async () => {
      mockFetch.mockResolvedValueOnce(okResponse());
      renderWithTheme(<Harness onChange={onChange} />);

      fireEvent.drop(getTrigger(), { dataTransfer: { files: [makeFile()] } });

      await waitFor(() => expect(onChange).toHaveBeenCalledWith(UPLOADED_URL));
    });

    it('should replace the current photo with a dropped one', async () => {
      mockFetch.mockResolvedValueOnce(okResponse());
      renderWithTheme(<Harness initialValue={EXISTING_URL} onChange={onChange} />);
      const photo = screen.getByAltText('Cover photo preview');

      fireEvent.dragOver(photo, { dataTransfer: { files: [] } });
      fireEvent.drop(photo, { dataTransfer: { files: [makeFile()] } });

      await waitFor(() => expect(onChange).toHaveBeenCalledWith(UPLOADED_URL));
    });

    it('should ignore an empty drop', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} />);

      fireEvent.drop(getTrigger(), { dataTransfer: { files: [] } });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should cancel the browser default but ignore the file when disabled', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} disabled />);
      const trigger = getTrigger();

      fireEvent.dragOver(trigger, { dataTransfer: { files: [] } });
      const notCancelled = fireEvent.drop(trigger, { dataTransfer: { files: [makeFile()] } });

      expect(notCancelled).toBe(false);
      expect(screen.queryByText('Drop to upload')).not.toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('paste', () => {
    it('should upload a pasted photo and keep the event from the form', async () => {
      const onFormPaste = jest.fn();
      mockFetch.mockResolvedValueOnce(okResponse());
      renderWithTheme(
        <div onPaste={onFormPaste}>
          <Harness onChange={onChange} />
        </div>
      );

      fireEvent.paste(getTrigger(), {
        clipboardData: { files: [makeFile('pasted.png', 'image/png')] },
      });

      await waitFor(() => expect(onChange).toHaveBeenCalledWith(UPLOADED_URL));
      expect(onFormPaste).not.toHaveBeenCalled();
    });

    it('should let a text paste through', () => {
      const onFormPaste = jest.fn();
      renderWithTheme(
        <div onPaste={onFormPaste}>
          <ImageUpload value="" onChange={onChange} />
        </div>
      );

      fireEvent.paste(getTrigger(), { clipboardData: { files: [], items: [] } });

      expect(onFormPaste).toHaveBeenCalledTimes(1);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should ignore a pasted photo when disabled', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} disabled />);

      fireEvent.paste(getTrigger(), { clipboardData: { files: [makeFile()] } });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('inline variant', () => {
    it('should render an Add photo button instead of a dropzone', () => {
      renderWithTheme(
        <ImageUpload value="" onChange={onChange} variant="inline" label="Step photo (optional)" />
      );

      expect(screen.getByRole('group', { name: 'Step photo (optional)' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add photo' })).toBeInTheDocument();
      expect(screen.queryByText('Add a cover photo')).not.toBeInTheDocument();
    });

    it('should treat compact as an alias of inline', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} compact />);

      expect(screen.getByRole('button', { name: 'Add photo' })).toBeInTheDocument();
    });

    it('should let an explicit variant win over compact', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} compact variant="cover" />);

      expect(getTrigger()).toBeInTheDocument();
    });

    it('should open the picker from Add photo', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} variant="inline" />);
      const clickSpy = jest.spyOn(getInput(), 'click');

      fireEvent.click(screen.getByRole('button', { name: 'Add photo' }));

      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('should disable Add photo when disabled', () => {
      renderWithTheme(<ImageUpload value="" onChange={onChange} variant="inline" disabled />);

      expect(screen.getByRole('button', { name: 'Add photo' })).toBeDisabled();
    });

    it('should link the form helper text to Add photo', () => {
      renderWithTheme(
        <ImageUpload value="" onChange={onChange} variant="inline" error helperText="Too dark" />
      );

      expect(screen.getByRole('button', { name: 'Add photo' })).toHaveAccessibleDescription(
        'Too dark'
      );
    });

    it('should show a thumbnail with progress while uploading', async () => {
      mockFetch.mockReturnValueOnce(deferred().promise);
      renderWithTheme(<Harness onChange={onChange} variant="inline" label="Step photo" />);

      selectFile(makeFile());

      expect(await screen.findByAltText('Step photo preview')).toHaveAttribute(
        'src',
        'blob:mock-url'
      );
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should offer Replace and a floating remove once filled', async () => {
      mockFetch.mockResolvedValueOnce(okResponse());
      renderWithTheme(<Harness onChange={onChange} variant="inline" label="Step photo" />);

      selectFile(makeFile());

      expect(await screen.findByRole('button', { name: 'Replace photo' })).toHaveFocus();
      expect(screen.getByRole('button', { name: 'Remove photo' })).toBeInTheDocument();
      expect(screen.getByAltText('Step photo preview')).toHaveAttribute('src', UPLOADED_URL);
    });

    it('should go back to Add photo after removing', () => {
      renderWithTheme(<Harness initialValue={EXISTING_URL} onChange={onChange} variant="inline" />);

      fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));

      expect(onChange).toHaveBeenCalledWith('');
      expect(screen.getByRole('button', { name: 'Add photo' })).toHaveFocus();
    });

    it('should offer Retry and dismiss after a failure', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      renderWithTheme(<Harness onChange={onChange} variant="inline" />);

      selectFile(makeFile());

      expect(await screen.findByRole('alert')).toHaveTextContent('No connection - Retry');
      const group = within(screen.getByRole('group'));
      expect(group.getByRole('button', { name: 'Retry upload' })).toHaveFocus();
      expect(group.getByRole('button', { name: 'Dismiss failed upload' })).toBeInTheDocument();
      expect(group.getAllByRole('button')).toHaveLength(2);
    });

    it('should retry from the inline failure', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      renderWithTheme(<Harness onChange={onChange} variant="inline" />);
      selectFile(makeFile());
      const retry = await screen.findByRole('button', { name: 'Retry upload' });
      mockFetch.mockResolvedValueOnce(okResponse());

      fireEvent.click(retry);

      await waitFor(() => expect(onChange).toHaveBeenCalledWith(UPLOADED_URL));
    });

    it('should offer Replace instead of Retry when a retry cannot help', async () => {
      renderWithTheme(<Harness onChange={onChange} variant="inline" />);

      selectFile(makeFile('huge.jpg', 'image/jpeg', 8.2 * 1024 * 1024));

      expect(await screen.findByRole('button', { name: 'Replace photo' })).toHaveFocus();
      expect(screen.queryByRole('button', { name: 'Retry upload' })).not.toBeInTheDocument();
    });

    it('should dismiss an inline failure back to Add photo', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      renderWithTheme(<Harness onChange={onChange} variant="inline" />);
      selectFile(makeFile());
      const dismiss = await screen.findByRole('button', { name: 'Dismiss failed upload' });

      fireEvent.click(dismiss);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add photo' })).toHaveFocus();
    });

    it('should flag a broken inline photo and keep Replace available', () => {
      renderWithTheme(
        <ImageUpload value={EXISTING_URL} onChange={onChange} variant="inline" label="Step photo" />
      );

      fireEvent.error(screen.getByAltText('Step photo preview'));

      expect(screen.getByRole('alert')).toHaveTextContent(BROKEN_IMAGE_MESSAGE);
      expect(screen.getByRole('button', { name: 'Replace photo' })).toBeInTheDocument();
    });
  });

  describe('imperative handle', () => {
    it('should focus the trigger at rest', () => {
      const handle = React.createRef<ImageUploadHandle>();
      renderWithTheme(<ImageUpload ref={handle} value="" onChange={onChange} />);

      act(() => handle.current!.focus());

      expect(getTrigger()).toHaveFocus();
    });

    it('should focus Replace when filled', () => {
      const handle = React.createRef<ImageUploadHandle>();
      renderWithTheme(<ImageUpload ref={handle} value={EXISTING_URL} onChange={onChange} />);

      act(() => handle.current!.focus());

      expect(screen.getByRole('button', { name: 'Replace photo' })).toHaveFocus();
    });

    it('should open the picker', () => {
      const handle = React.createRef<ImageUploadHandle>();
      renderWithTheme(<ImageUpload ref={handle} value="" onChange={onChange} />);
      const clickSpy = jest.spyOn(getInput(), 'click');

      act(() => handle.current!.openPicker());

      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('should upload a file handed over by the form', async () => {
      const handle = React.createRef<ImageUploadHandle>();
      mockFetch.mockResolvedValueOnce(okResponse());
      renderWithTheme(<Harness handleRef={handle} onChange={onChange} />);

      act(() => handle.current!.uploadFile(makeFile('pasted.png', 'image/png')));

      await waitFor(() => expect(onChange).toHaveBeenCalledWith(UPLOADED_URL));
    });

    it('should refuse a file while disabled', () => {
      const handle = React.createRef<ImageUploadHandle>();
      renderWithTheme(<ImageUpload ref={handle} value="" onChange={onChange} disabled />);

      act(() => handle.current!.uploadFile(makeFile()));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not throw where scrollIntoView does not exist (jsdom)', () => {
      const handle = React.createRef<ImageUploadHandle>();
      renderWithTheme(<ImageUpload ref={handle} value="" onChange={onChange} />);

      expect(() => handle.current!.scrollIntoView({ block: 'center' })).not.toThrow();
    });

    it('should scroll the field into view where the browser supports it', () => {
      const handle = React.createRef<ImageUploadHandle>();
      renderWithTheme(<ImageUpload ref={handle} value="" onChange={onChange} />);
      const scrollIntoView = jest.fn();
      (screen.getByRole('group', { name: 'Cover photo' }) as any).scrollIntoView = scrollIntoView;

      handle.current!.scrollIntoView({ block: 'center' });

      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    });
  });
});
