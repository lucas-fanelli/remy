/**
 * Where a viewer stands with one account — what the follow button shows.
 *
 * - 'none': neither following nor asking. The button says "Seguir".
 * - 'requested': a pending request to a PRIVATE account, waiting for the owner. The button
 *   says "Solicitado", and tapping it again takes the request back. A request grants
 *   nothing: the account's recipes stay locked until the owner accepts.
 * - 'following': a row in "follows". The only state that opens a private account's content
 *   (src/lib/privacy/visibility.ts).
 *
 * 'requested' is never reported for a PUBLIC account. Following a public account is
 * immediate, so a request row left over from when it was private means nothing — and the
 * next follow deletes it.
 *
 * Shared by the server, which derives it (src/lib/follows/state.ts) and moves it
 * (src/lib/follows/requests.ts), and the client, which paints it.
 */
export type FollowState = 'none' | 'requested' | 'following';
