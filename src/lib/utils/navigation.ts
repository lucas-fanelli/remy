/**
 * Full page load instead of a client-side route change. Use it when the
 * session changed behind AuthProvider's back (it only asks /api/auth/me on
 * mount): a soft navigation would keep showing the previous user.
 */
export function hardNavigate(url: string): void {
  window.location.assign(url);
}
