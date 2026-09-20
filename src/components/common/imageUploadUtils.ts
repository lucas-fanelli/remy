/**
 * Pure helpers behind ImageUpload (S8): file picking, client-side downscale
 * and the mapping from an /api/upload failure to the copy shown to the user.
 * Everything here feature-detects browser APIs - jsdom has neither
 * createImageBitmap nor a canvas backend, and old browsers may lack them too.
 */
import { MAX_UPLOAD_SIZE } from '@/lib/constants';

export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

/** Value for the file input's `accept` attribute. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_TYPES.join(',');

/** Files above this size are downscaled before upload. */
export const DOWNSCALE_MIN_BYTES = 1.5 * 1024 * 1024;
/** Images whose long edge exceeds this are downscaled before upload. */
export const DOWNSCALE_MAX_EDGE = 2000;
const DOWNSCALE_QUALITY = 0.85;

export const INVALID_TYPE_MESSAGE = 'Choose a JPG, PNG, WebP or GIF image';
export const GENERIC_UPLOAD_ERROR = 'Upload failed';
export const NETWORK_UPLOAD_ERROR = 'No connection - Retry';

export function isAcceptedImage(file: File): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(file.type);
}

/** '8.2 MB', '5 MB' - one decimal, dropped when it is zero. */
export function formatMegabytes(bytes: number): string {
  const rounded = Math.round((bytes / (1024 * 1024)) * 10) / 10;
  return `${rounded} MB`;
}

export function tooLargeMessage(bytes: number): string {
  return `This photo is ${formatMegabytes(bytes)} and could not be reduced below ${formatMegabytes(
    MAX_UPLOAD_SIZE
  )} - choose another one`;
}

/**
 * First file carried by a drop or paste event. With `imagesOnly` a clipboard
 * that holds text (or any non-image file) yields null, so the caller can let
 * the default paste go through.
 */
export function firstFileFrom(
  transfer: Pick<DataTransfer, 'files' | 'items'> | null | undefined,
  imagesOnly = false
): File | null {
  if (!transfer) return null;

  const candidates: File[] = Array.from(transfer.files ?? []);
  if (candidates.length === 0 && transfer.items) {
    for (const item of Array.from(transfer.items)) {
      const file = item.kind === 'file' ? item.getAsFile() : null;
      if (file) candidates.push(file);
    }
  }

  const match = imagesOnly
    ? candidates.find((file) => file.type.startsWith('image/'))
    : candidates[0];
  return match ?? null;
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', DOWNSCALE_QUALITY));
}

/**
 * Downscales a photo on the main thread (the CSP has no worker-src) to a
 * JPEG whose long edge is at most DOWNSCALE_MAX_EDGE. GIFs are never touched
 * (they may be animated). Returns the ORIGINAL file when nothing needs to be
 * done, when the browser cannot do it, or on any failure.
 */
export async function downscaleImage(file: File): Promise<File> {
  if (file.type === 'image/gif') return file;
  if (typeof createImageBitmap !== 'function') return file;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const longEdge = Math.max(bitmap.width, bitmap.height);
    if (file.size <= DOWNSCALE_MIN_BYTES && longEdge <= DOWNSCALE_MAX_EDGE) return file;

    const scale = Math.min(1, DOWNSCALE_MAX_EDGE / longEdge);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext('2d');
    if (!context) return file;
    // JPEG has no alpha channel: flatten transparent PNG/WebP onto white, not black
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await canvasToJpeg(canvas);
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^./\\]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap?.close?.();
  }
}

/** Reads a response body as JSON without ever throwing (HTML error pages, empty bodies). */
export async function readJsonSafely(response: Pick<Response, 'json'>): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function retryAfterMinutes(body: unknown, retryAfterHeader: string | null | undefined): number {
  const fromBody =
    body && typeof body === 'object' ? (body as { retryAfter?: unknown }).retryAfter : undefined;
  const seconds =
    typeof fromBody === 'number' ? fromBody : Number.parseInt(retryAfterHeader ?? '', 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return 1;
  return Math.max(1, Math.ceil(seconds / 60));
}

/** Copy for a non-OK /api/upload response, mapped by status. */
export function uploadErrorMessage(
  status: number,
  body: unknown,
  retryAfterHeader?: string | null
): string {
  if (status === 401) return 'Your session expired - your draft is saved';
  if (status === 429) {
    return `Too many uploads - try again in ${retryAfterMinutes(body, retryAfterHeader)} min`;
  }
  const serverText =
    body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined;
  return typeof serverText === 'string' && serverText.trim() ? serverText : GENERIC_UPLOAD_ERROR;
}
