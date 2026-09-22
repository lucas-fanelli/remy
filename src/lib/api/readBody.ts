/**
 * Read a response body without letting a non-JSON one hide the real failure.
 *
 * Parsing before checking `response.ok` is the right order — the server's error code and
 * message live in that body, and `apiErrorMessage` needs them to say anything specific.
 * But a bare `await response.json()` throws when the body is not JSON, which a proxy
 * answering 502 with an HTML page will produce, and the throw carries a genuine server
 * rejection into the network-failure branch.
 *
 * `null` is a body `translateApiError` already handles: it falls through to the caller's
 * fallback sentence, and the status still decides which branch runs.
 *
 * ```ts
 * const response = await fetch(url, { method: 'POST' });
 * const body = await readBody(response);
 * if (!response.ok) return showError(apiErrorMessage(body, t('somethingFailed')));
 * ```
 */
export async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
