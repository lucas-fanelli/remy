# Password Recovery

How "Forgot your password?" works, how to configure it and how to ship it.

## The flow

1. **Login form** → "Forgot your password?" → `/auth/forgot-password`.
2. The user enters an email or a username. `POST /api/auth/forgot-password` **always** answers
   `200` with the same generic body. The account lookup, the token and the email all run in
   `after()` — once the response has already been sent — so status, body and response time are
   identical for existing, unknown and throttled accounts (no user enumeration).
3. If the account exists, `PasswordResetService.requestReset`:
   - ignores the request when a token was created for that account in the last **2 minutes**;
   - deletes the account's previous unused tokens (only the newest link works);
   - creates a token: 32 random bytes (`crypto.randomBytes`) as base64url. **Only its SHA-256
     hash is stored** (`password_reset_tokens.tokenHash`); the raw token exists only in the link;
   - emails `<base URL>/auth/reset-password?token=…`, valid for **60 minutes**, single use.
4. `/auth/reset-password?token=…` asks for the new password (same rules as registration, from
   `src/lib/validation/passwordRules.ts`). `POST /api/auth/reset-password` answers one generic
   `400 "This reset link is invalid or has expired"` for unknown, used and expired tokens.
5. On success, in **one transaction** (`PasswordResetTokenRepository.redeem`): the token is
   claimed with a conditional update (two concurrent requests cannot both win), the bcrypt hash
   and `users.passwordChangedAt` are written, and the account's other reset tokens are deleted.
   The user is **not** logged in automatically: they are sent to `/auth?reset=success`.

## Session invalidation

`AuthService.validateToken` rejects any JWT whose `iat` is older than the user's
`passwordChangedAt`. `iat` is in seconds and `passwordChangedAt` in milliseconds, so the check is
`iat < Math.floor(passwordChangedAt / 1000)`: a token issued in the same second as the change
is still accepted (otherwise a login right after a reset could be rejected).

- A **reset** kills every existing session, including a stolen one.
- A **change password** (settings) also stamps `passwordChangedAt`; the route re-issues the
  auth cookie, so the person who changed it stays logged in and every other session dies.
- Every authorization path goes through `validateToken` (`requireAuth`, `getCurrentUser`,
  `verifySessionToken`, `requireAdmin`). A signature-only `tokenService.verify()` would let
  revoked sessions through; `session-verification-conventions.test.ts` fails CI if a
  route goes back to it. The middleware's own signature-only checks are defense in depth only.

## The link's base URL

`getAppBaseUrl()` (`src/lib/utils/appUrl.ts`) never looks at the request — building links from
`Host` / `X-Forwarded-Host` would let an attacker poison reset emails. Order:

1. `NEXT_PUBLIC_APP_URL` (in production a `localhost` value is ignored, with an error log)
2. `https://` + `VERCEL_PROJECT_PRODUCTION_URL` (set by Vercel)
3. `http://localhost:3000`, in development only

With none of them in production, an error is logged and **no email is sent**.

## Environment variables

| Variable              | Required in production | Purpose                                                                               |
| --------------------- | ---------------------- | ------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`      | yes (for this feature) | Resend API key. Without it no email is sent.                                          |
| `EMAIL_FROM`          | no                     | Sender. Default `Remy <noreply@remy-recipes.com>`; domain must be verified in Resend. |
| `NEXT_PUBLIC_APP_URL` | recommended            | Public origin used in the emailed link (falls back to the Vercel URL).                |

Without `RESEND_API_KEY`: in **development** the email (with the link) is printed to the server
console so the flow can be tested locally; in **production** an error is logged without the link
or the token. Email failures never change the HTTP response.

## Deploy order

The Vercel build does **not** run migrations. Migration `2_password_reset` is purely additive
(one nullable column, one new table), so the release currently live keeps working after it.

1. In Resend: verify the `remy-recipes.com` sending domain and create an API key.
2. In Vercel (Production): set `RESEND_API_KEY` (and `EMAIL_FROM` if the default is not wanted);
   check that `NEXT_PUBLIC_APP_URL` is `https://remy-recipes.com`.
3. **Apply the migration to the production database first**:
   `npx prisma migrate deploy`, then `npx prisma migrate status`.
4. Deploy / merge this code.
5. Smoke test: request a reset for your own account, open the link, set a password, log in.

If the code is deployed **before** the migration, every authenticated request fails: Prisma
selects `users.passwordChangedAt`, the column does not exist yet, `validateToken` throws and
users appear logged out (login and registration return 500) until the migration is applied.

## Testing locally

```bash
npx prisma migrate deploy      # once
npm run dev                    # with RESEND_API_KEY unset
```

Open `/auth`, click "Forgot your password?", submit an existing email or username and copy the
link printed in the server console (`[EMAIL] … Development preview`).

Rate limits: both endpoints share the strict auth bucket of the middleware (10 requests per
15 minutes per IP, together with login and register), plus the per-account 2 minute throttle.
