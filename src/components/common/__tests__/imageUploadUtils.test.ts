import {
  ACCEPT_ATTRIBUTE,
  DOWNSCALE_MAX_EDGE,
  DOWNSCALE_MIN_BYTES,
  downscaleImage,
  firstFileFrom,
  formatMegabytes,
  isAcceptedImage,
  readJsonSafely,
  tooLargeMessage,
  uploadErrorMessage,
} from '../imageUploadUtils';

const makeFile = (name: string, type: string, size?: number) => {
  const file = new File(['pixels'], name, { type, lastModified: 1700000000000 });
  if (size !== undefined) Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('imageUploadUtils', () => {
  describe('isAcceptedImage', () => {
    it.each(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'])(
      'should accept %s',
      (type) => {
        expect(isAcceptedImage(makeFile('photo', type))).toBe(true);
      }
    );

    it('should reject other file types', () => {
      expect(isAcceptedImage(makeFile('notes.txt', 'text/plain'))).toBe(false);
    });

    it('should list every accepted type in the accept attribute', () => {
      expect(ACCEPT_ATTRIBUTE).toBe('image/jpeg,image/jpg,image/png,image/webp,image/gif');
    });
  });

  describe('formatMegabytes', () => {
    it('should keep one decimal', () => {
      expect(formatMegabytes(8.2 * 1024 * 1024)).toBe('8.2 MB');
    });

    it('should drop a zero decimal', () => {
      expect(formatMegabytes(5 * 1024 * 1024)).toBe('5 MB');
    });
  });

  describe('tooLargeMessage', () => {
    it('should name the size and the limit', () => {
      expect(tooLargeMessage(8.2 * 1024 * 1024)).toBe(
        'This photo is 8.2 MB and could not be reduced below 5 MB - choose another one'
      );
    });
  });

  describe('firstFileFrom', () => {
    it('should return null when there is no transfer object', () => {
      expect(firstFileFrom(null)).toBeNull();
    });

    it('should return the first dropped file', () => {
      const first = makeFile('a.png', 'image/png');
      const second = makeFile('b.png', 'image/png');

      const result = firstFileFrom({ files: [first, second], items: [] } as any);

      expect(result).toBe(first);
    });

    it('should fall back to file items when the files list is empty', () => {
      const pasted = makeFile('pasted.png', 'image/png');
      const items = [
        { kind: 'string', getAsFile: () => null },
        { kind: 'file', getAsFile: () => pasted },
      ];

      const result = firstFileFrom({ files: [], items } as any);

      expect(result).toBe(pasted);
    });

    it('should skip file items that cannot be read', () => {
      const items = [{ kind: 'file', getAsFile: () => null }];

      const result = firstFileFrom({ files: [], items } as any);

      expect(result).toBeNull();
    });

    it('should tolerate a transfer without files or items', () => {
      expect(firstFileFrom({} as any)).toBeNull();
    });

    it('should ignore non-image files when only images are wanted', () => {
      const text = makeFile('notes.txt', 'text/plain');
      const image = makeFile('photo.webp', 'image/webp');

      const result = firstFileFrom({ files: [text, image], items: [] } as any, true);

      expect(result).toBe(image);
    });

    it('should return null when only images are wanted and there are none', () => {
      const text = makeFile('notes.txt', 'text/plain');

      const result = firstFileFrom({ files: [text], items: [] } as any, true);

      expect(result).toBeNull();
    });
  });

  describe('readJsonSafely', () => {
    it('should return the parsed body', async () => {
      const body = await readJsonSafely({ json: async () => ({ url: 'x' }) });

      expect(body).toEqual({ url: 'x' });
    });

    it('should return null when the body is not JSON', async () => {
      const body = await readJsonSafely({
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      });

      expect(body).toBeNull();
    });
  });

  describe('uploadErrorMessage', () => {
    it('should explain an expired session on 401', () => {
      expect(uploadErrorMessage(401, { error: 'Unauthorized' })).toBe(
        'Your session expired - your draft is saved'
      );
    });

    it('should turn the retryAfter seconds of a 429 body into minutes', () => {
      expect(uploadErrorMessage(429, { retryAfter: 125 })).toBe(
        'Too many uploads - try again in 3 min'
      );
    });

    it('should fall back to the Retry-After header on 429', () => {
      expect(uploadErrorMessage(429, null, '60')).toBe('Too many uploads - try again in 1 min');
    });

    it('should say 1 min when a 429 carries no usable delay', () => {
      expect(uploadErrorMessage(429, { retryAfter: 0 }, 'soon')).toBe(
        'Too many uploads - try again in 1 min'
      );
    });

    it('should say 1 min when a 429 has neither a body delay nor a header', () => {
      expect(uploadErrorMessage(429, {})).toBe('Too many uploads - try again in 1 min');
    });

    it('should keep the server text for other statuses', () => {
      expect(uploadErrorMessage(400, { error: 'No valid file provided' })).toBe(
        'No valid file provided'
      );
    });

    it('should use a generic message when the server sends no text', () => {
      expect(uploadErrorMessage(500, {})).toBe('Upload failed');
    });

    it('should use a generic message when the body is not an object', () => {
      expect(uploadErrorMessage(502, null)).toBe('Upload failed');
    });

    it('should ignore a non-string or blank error field', () => {
      expect(uploadErrorMessage(500, { error: 42 })).toBe('Upload failed');
      expect(uploadErrorMessage(500, { error: '   ' })).toBe('Upload failed');
    });
  });

  describe('downscaleImage', () => {
    const originalCreateImageBitmap = (global as any).createImageBitmap;
    let getContextSpy: jest.SpyInstance;
    let toBlobSpy: jest.SpyInstance;
    let context: { fillStyle: string; fillRect: jest.Mock; drawImage: jest.Mock };
    let closeBitmap: jest.Mock;

    const stubBitmap = (width: number, height: number) => {
      closeBitmap = jest.fn();
      (global as any).createImageBitmap = jest
        .fn()
        .mockResolvedValue({ width, height, close: closeBitmap });
    };

    const stubCanvasOutput = (blob: Blob | null) => {
      toBlobSpy.mockImplementation(function (this: HTMLCanvasElement, callback: BlobCallback) {
        callback(blob);
      });
    };

    beforeEach(() => {
      context = { fillStyle: '', fillRect: jest.fn(), drawImage: jest.fn() };
      getContextSpy = jest
        .spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockReturnValue(context as any);
      toBlobSpy = jest.spyOn(HTMLCanvasElement.prototype, 'toBlob');
      stubCanvasOutput(new Blob(['small'], { type: 'image/jpeg' }));
    });

    afterEach(() => {
      getContextSpy.mockRestore();
      toBlobSpy.mockRestore();
      (global as any).createImageBitmap = originalCreateImageBitmap;
    });

    it('should return the original file when createImageBitmap is missing', async () => {
      delete (global as any).createImageBitmap;
      const file = makeFile('big.jpg', 'image/jpeg', DOWNSCALE_MIN_BYTES + 1);

      const result = await downscaleImage(file);

      expect(result).toBe(file);
    });

    it('should never touch a GIF', async () => {
      stubBitmap(4000, 3000);
      const file = makeFile('anim.gif', 'image/gif', DOWNSCALE_MIN_BYTES + 1);

      const result = await downscaleImage(file);

      expect(result).toBe(file);
      expect((global as any).createImageBitmap).not.toHaveBeenCalled();
    });

    it('should keep a small photo with a short long edge', async () => {
      stubBitmap(1600, 1200);
      const file = makeFile('small.jpg', 'image/jpeg', 1024);

      const result = await downscaleImage(file);

      expect(result).toBe(file);
      expect(closeBitmap).toHaveBeenCalled();
    });

    it('should honour the EXIF orientation when decoding', async () => {
      stubBitmap(1600, 1200);
      const file = makeFile('small.jpg', 'image/jpeg', 1024);

      await downscaleImage(file);

      expect((global as any).createImageBitmap).toHaveBeenCalledWith(file, {
        imageOrientation: 'from-image',
      });
    });

    it('should scale the long edge down to the maximum and re-encode as JPEG', async () => {
      stubBitmap(4000, 3000);
      const file = makeFile('huge.png', 'image/png', 3 * 1024 * 1024);

      const result = await downscaleImage(file);

      expect(result).not.toBe(file);
      expect(result.type).toBe('image/jpeg');
      expect(result.name).toBe('huge.jpg');
      expect(result.lastModified).toBe(file.lastModified);
      expect(context.drawImage).toHaveBeenCalledWith(
        expect.anything(),
        0,
        0,
        DOWNSCALE_MAX_EDGE,
        1500
      );
      expect(toBlobSpy).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85);
    });

    it('should re-encode a heavy photo without enlarging it', async () => {
      stubBitmap(1000, 800);
      const file = makeFile('heavy.jpg', 'image/jpeg', DOWNSCALE_MIN_BYTES + 1);

      const result = await downscaleImage(file);

      expect(result.type).toBe('image/jpeg');
      expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1000, 800);
    });

    it('should flatten transparency onto white before drawing', async () => {
      stubBitmap(4000, 3000);
      const file = makeFile('logo.png', 'image/png', 3 * 1024 * 1024);

      await downscaleImage(file);

      expect(context.fillStyle).toBe('#ffffff');
      expect(context.fillRect).toHaveBeenCalledWith(0, 0, DOWNSCALE_MAX_EDGE, 1500);
    });

    it('should keep the original when the result is not smaller', async () => {
      stubBitmap(4000, 3000);
      const file = makeFile('tiny-but-wide.jpg', 'image/jpeg', 3);

      const result = await downscaleImage(file);

      expect(result).toBe(file);
    });

    it('should keep the original when the canvas has no 2d context', async () => {
      stubBitmap(4000, 3000);
      getContextSpy.mockReturnValue(null);
      const file = makeFile('huge.jpg', 'image/jpeg', 3 * 1024 * 1024);

      const result = await downscaleImage(file);

      expect(result).toBe(file);
    });

    it('should keep the original when the canvas cannot be encoded', async () => {
      stubBitmap(4000, 3000);
      stubCanvasOutput(null);
      const file = makeFile('huge.jpg', 'image/jpeg', 3 * 1024 * 1024);

      const result = await downscaleImage(file);

      expect(result).toBe(file);
    });

    it('should keep the original when decoding throws', async () => {
      (global as any).createImageBitmap = jest.fn().mockRejectedValue(new Error('decode'));
      const file = makeFile('corrupt.jpg', 'image/jpeg', 3 * 1024 * 1024);

      const result = await downscaleImage(file);

      expect(result).toBe(file);
    });

    it('should tolerate a bitmap without close()', async () => {
      (global as any).createImageBitmap = jest.fn().mockResolvedValue({ width: 10, height: 10 });
      const file = makeFile('small.jpg', 'image/jpeg', 1024);

      const result = await downscaleImage(file);

      expect(result).toBe(file);
    });
  });
});
