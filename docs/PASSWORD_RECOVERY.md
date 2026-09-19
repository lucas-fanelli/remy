# Password Recovery

How "Forgot your password?" works, how to configure it and how to ship it.

## The flow

1. **Login form** → "Forgot your password?" → `/auth/forgot-password`.
2. The user enters an email or a username. `POST /api/auth/forgot-password` **always** answers
   `200` with the same generic body. The account lookup, the token and the email all run in
   `after()` — once the response has already been sent — so status, body and response time are
   identical for existing, unknown and throttled accounts (no user enumeration).
3. The account is looked up like at login (email when there is an `@`, username otherwise). If
   the exact match misses, the lookup is repeated **ignoring case** and accepted only when
   exactly one account matches (the unique indexes are case-sensitive, so `A@x.com` and
   `a@x.com` can be two accounts). The email always goes to the address on file.
4. If the account exists, `PasswordResetService.requestReset` asks
   `PasswordResetTokenRepository.issue` for a token. `issue` is **one transaction behind a
   per-account advisory lock** (`pg_try_advisory_xact_lock(48885, hashtext(userId))`), so a burst
   of parallel requests cannot all pass the limits: a request that finds the account busy is the
   duplicate the throttle exists for and is dropped. Inside the transaction:
   - nothing happens when a token was created for that account in the last **2 minutes**, or
     when the account already has **5 requests in the last 24 hours**;
   - the account's earlier links are expired (only the newest link works; the rows are kept for
     24 hours because they are what the daily cap counts);
   - the new token is stored: 32 random bytes (`crypto.randomBytes`) as base64url. **Only its
     SHA-256 hash is stored** (`password_reset_tokens.tokenHash`); the raw token exists only in
     the link.

   Then `<base URL>/auth/reset-password?token=…` is emailed, valid for **60 minutes**, single
   use. If the email cannot be delivered the token is withdrawn, so an immediate retry is not
   throttled.

5. `/auth/reset-password?token=…` asks for the new password (same rules as registration, from
   `src/lib/validation/passwordRules.ts`). `POST /api/auth/reset-password` answers one generic
   `400 "This reset link is invalid or has expired"` for malformed, unknown, used and expired
   tokens.
6. On success, in **one transaction** (`PasswordResetTokenRepository.redeem`): the token is
   claimed with a conditional update (two concurrent requests cannot both win), the bcrypt hash
   and `users.passwordChangedAt` are written, and the account's other reset tokens are deleted.
   The user is **not** logged in automatically: the form leaves with a **full page load** to
   `/auth?reset=success`, so a session that was open in that browser cannot linger in
   `AuthProvider` (it only asks `/api/auth/me` on mount).

## The token in the URL

The raw token is a bearer credential for up to 60 minutes, and it arrives in a query string.

- `ResetPasswordForm` keeps it in memory and removes it from the address bar before the first
  paint (`history.replaceState` plus `router.replace`, so the app router does not write the old
  URL back). History and anything that records `window.location` afterwards never see it.
  Consequence: **reloading the page shows the invalid-link state**; the emailed link still works.
- The page sends no `Referer` (`referrer: 'no-referrer'`).
- Second line, for whatever captures the URL before the form mounts
  (`src/lib/utils/resetLinkPrivacy.ts`): Vercel Analytics goes through `AppAnalytics`
  (`beforeSend` redacts the `token` parameter), the Sentry configs redact it in events,
  transactions and breadcrumbs, and the service worker never caches `/auth/reset-password`.
- Known limit: the request line `GET /auth/reset-password?token=…` still reaches Vercel's
  request logs. Only moving the token to the URL fragment would avoid that.

## Session invalidation

`AuthService.validateToken` rejects any JWT whose `iat` is older than the user's
`passwordChangedAt`. `iat` is in seconds and `passwordChangedAt` in milliseconds, so the check is
`iat < Math.floor(passwordChangedAt / 1000)`: a token issued in the same second as the change
is still accepted (otherwise a login right after a reset could be rejected).

- A **reset** kills every existing session, including a stolen one.
- A **change password** (settings) also stamps `passwordChangedAt` and deletes the account's
  outstanding reset links; the route re-issues the auth cookie, so the person who changed it
  stays logged in and every other session dies.
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

Operations: alert on the log lines `[EMAIL] Resend rejected` and `[EMAIL] Could not reach Resend`
(quota exhausted, domain not verified, provider down). Volume is bounded per account (5 a day)
but not globally: check the daily quota of the Resend plan in use (the free plan had a limit of
100 emails a day when this was written) and move up before sign-ups outgrow it.

## Deploy order

The Vercel build does **not** run migrations. Migration `2_password_reset` is purely additive
(one nullable column, one new table), so the release currently live keeps working after it.

1. In Resend: verify the `remy-recipes.com` sending domain and create an API key.
2. In Vercel (Production): set `RESEND_API_KEY` (and `EMAIL_FROM` if the default is not wanted);
   check that `NEXT_PUBLIC_APP_URL` is `https://remy-recipes.com`.
3. **Apply the migration to the production database BEFORE merging.**

   > Until this branch is merged, `prisma/migrations/2_password_reset` exists **only on
   > `feat/password-recovery`**. Run the commands from a checkout of that branch. From `main`,
   > `migrate deploy` finds 2 migrations, prints "Database schema is up to date!", applies
   > nothing and warns about nothing.

   ```bash
   git switch feat/password-recovery        # or: cd into this branch's worktree
   ls prisma/migrations                     # must list 2_password_reset
   # with DATABASE_URL pointing at PRODUCTION:
   npx prisma migrate deploy
   npx prisma migrate status
   ```

   - `migrate deploy` must print **"3 migrations found"** and
     **"Applying migration `2_password_reset`"**.
   - `migrate status` must print **"3 migrations found"** and "Database schema is up to date!".
   - If either says **"2 migrations found"** or "No pending migrations to apply": **STOP, do
     not merge** — you are on the wrong branch and nothing was applied.
   - Final check against production (must succeed; `column ... does not exist` means the
     migration is not applied):

     ```sql
     SELECT "passwordChangedAt" FROM users LIMIT 1;
     SELECT count(*) FROM password_reset_tokens;
     ```

   Alternative that removes the branch trap: first merge a PR that contains **only the folder
   `prisma/migrations/2_password_reset`** (nothing reads it at build time), run `migrate deploy`
   from `main`, verify as above, and only then merge the feature. Do **not** put the
   `schema.prisma` change in that first PR: merging it redeploys the app with a Prisma client
   that already selects `users.passwordChangedAt`, which is the outage described below.

4. Merge / deploy this code.
5. Smoke test: request a reset for your own account, open the link, set a password, log in.

If the code is deployed **before** the migration, the new Prisma client selects
`users.passwordChangedAt`, the column does not exist and every `user.findUnique` throws `P2022`:
login and registration return 500, `validateToken` throws and every logged-in user appears
logged out, until the migration is applied. Recovery: run step 3; no redeploy is needed.

## Testing locally

```bash
npx prisma migrate deploy      # once
npm run dev                    # with RESEND_API_KEY unset
```

Open `/auth`, click "Forgot your password?", submit an existing email or username and copy the
link printed in the server console (`[EMAIL] … Development preview`).

Rate limits: both endpoints share the strict auth bucket of the middleware (10 requests per
15 minutes per IP and per server instance, together with login and register), plus the
per-account limits above (one email every 2 minutes, 5 a day), which live in the database and
therefore hold across instances and IPs.

## Accepted trade-offs

- Someone who knows a username can request resets for it: the owner gets at most 5 emails a
  day, each request invalidates the previous link, and the owner's own request can land inside
  the 2 minute throttle. Every one of those emails is still a working link in the owner's inbox,
  so recovery stays possible; keeping several links alive at once was rejected to preserve
  "only the newest link works".
- The daily cap is per account. A global cap would let one attacker turn recovery off for
  everybody, so volume is left to the IP limiter and to alerting on the provider's errors.
