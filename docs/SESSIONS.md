# Sessions

A session is a JWT (HS256) in the httpOnly cookie `auth_token`. There is no session table:
the token is the session, so ending one early means making the token itself unacceptable.

## Lifetime

`JWT_EXPIRES_IN` (`30d` by default, see `.env.example`) is parsed once in
`src/lib/auth/session.ts` and used for **both** the JWT expiry and the cookie's `maxAge`.
Before, those were two unrelated constants — the JWT said one thing, the cookie was
hard-coded to 24 hours — so everyone was logged out a day after signing in, even while
using the app. Anything that needs the session lifetime reads it from that module.

## Sliding renewal

`GET /api/auth/me` runs on every app load (`AuthProvider`). When the session is valid and
its token is older than `getSessionRenewAfterSeconds()` (24 hours, or half the lifetime
when that is shorter), `AuthService.validateSession` issues a fresh token and the route
re-sets the cookie. So:

- someone who opens the app at least once every 30 days is never logged out;
- someone who stops using it is logged out 30 days after their last visit.

The renewed token is built from the **database** row, not from the old token's claims, so a
role change takes effect on the next renewal instead of lingering for the token's lifetime.
A token that `validateSession` rejects is never renewed.

## What ends a session

| Event                           | Effect                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| Logout                          | Cookie cleared                                                                     |
| Password change (Settings)      | Every other session dies; the current one is re-issued so the user stays logged in |
| Password reset by email         | Every session dies, including the one that requested the reset                     |
| 30 days without opening the app | The cookie and the token expire on their own                                       |

Password changes and resets work by stamping `users.passwordChangedAt`: `validateSession`
rejects any token whose `iat` is older than it. Tokens issued in the same second are
accepted, so the reset flow's own new session is not caught by it.

## "Logged out" by mistake

Only a **401** from `/api/auth/me` means "no session". A network error, a 5xx or a 429 from
the rate limiter says nothing about the session, so `AuthContext` keeps the current user and
retries (1s, 2s, 5s, 15s, 30s; the first two hold the loading state so a blip never flashes
the logged-out UI). `/api/auth/me` answers 500 — never 401 — when it cannot check the
session, and it has its own rate-limit bucket so a busy page or a shared IP cannot exhaust
the shared one and make the app forget who is logged in.

## Production note

If `JWT_EXPIRES_IN` is set to a short value in Vercel (it was `7d`), production keeps that
inactivity window: set it to `30d` or delete it. Renewal still helps active users either
way. The value is read at runtime, so changing it takes effect on the next deploy without
a code change.
