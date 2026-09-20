/**
 * Typed failure of POST /api/recipes and PUT /api/recipes/[id].
 *
 * `message` keeps the server's own text (callers and tests rely on it); `code` is what the
 * form switches on to pick its copy and its recovery action.
 *
 * `fromServer` says whether that text came from the API or is the English fallback this
 * module put there for the log. Only a SERVER sentence is ever shown to the author: the
 * form has its own translated copy for every other case, which is how a module with no
 * locale stays out of the translation business (docs/I18N.md, the API error contract).
 */
export type RecipeSubmitErrorCode =
  | 'unauthorized'
  | 'daily_limit'
  | 'rate_limited'
  | 'validation'
  | 'server'
  | 'network';

export class RecipeSubmitError extends Error {
  /** HTTP status; 0 when the request never got a response */
  readonly status: number;
  readonly code: RecipeSubmitErrorCode;
  /** Seconds until a retry makes sense (rate limiting only) */
  readonly retryAfter?: number;
  /** True when `message` is the API's own sentence, and not this module's fallback */
  readonly fromServer: boolean;

  constructor(
    message: string,
    status: number,
    code: RecipeSubmitErrorCode,
    retryAfter?: number,
    fromServer = false
  ) {
    super(message);
    this.name = 'RecipeSubmitError';
    this.status = status;
    this.code = code;
    this.fromServer = fromServer;
    if (retryAfter !== undefined) this.retryAfter = retryAfter;
    // Keeps `instanceof` working if the class is ever compiled down to ES5
    Object.setPrototypeOf(this, RecipeSubmitError.prototype);
  }
}

// POST answers 429 both for the daily recipe limit and for the middleware rate limiter;
// only the text tells them apart ('Daily recipe creation limit reached (10 per day)...')
const DAILY_LIMIT_TEXT = /daily/i;

const toCode = (status: number, message: string): RecipeSubmitErrorCode => {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 429) return DAILY_LIMIT_TEXT.test(message) ? 'daily_limit' : 'rate_limited';
  if (status >= 400 && status < 500) return 'validation';
  return 'server';
};

const toSeconds = (value: unknown): number | undefined => {
  const seconds = typeof value === 'string' ? Number(value) : value;
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
    ? Math.ceil(seconds)
    : undefined;
};

/** Maps a non-ok Response. The body may be missing or not JSON (a proxy's HTML error page) */
export async function toRecipeSubmitError(
  response: Response,
  fallbackMessage: string
): Promise<RecipeSubmitError> {
  let body: { error?: unknown; retryAfter?: unknown } = {};
  try {
    const parsed: unknown = await response.json();
    if (typeof parsed === 'object' && parsed !== null) body = parsed;
  } catch {
    // Not JSON: the status alone decides
  }

  const status = typeof response.status === 'number' ? response.status : 0;
  const fromServer = typeof body.error === 'string' && body.error !== '';
  const message = fromServer ? (body.error as string) : fallbackMessage;
  const code = toCode(status, message);
  const retryAfter =
    code === 'rate_limited'
      ? (toSeconds(body.retryAfter) ?? toSeconds(response.headers?.get?.('Retry-After')))
      : undefined;

  return new RecipeSubmitError(message, status, code, retryAfter, fromServer);
}

/**
 * `fetch` rejected (offline, DNS, aborted): the original message is kept when there is one.
 * It is never `fromServer` - a browser's 'Failed to fetch' is for the log, and the form says
 * 'Could not reach Remy' in the author's language.
 */
export const toNetworkSubmitError = (cause: unknown, fallbackMessage: string): RecipeSubmitError =>
  new RecipeSubmitError(
    cause instanceof Error && cause.message ? cause.message : fallbackMessage,
    0,
    'network'
  );
