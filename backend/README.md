# Inspirare — Backend

Node.js + Express API that proxies authentication to Supabase. The static frontend in the parent directory (`../login`, `../signup`, etc.) talks to this server over `fetch()`.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure env
cp .env.example .env
# open .env and fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
# (find them at Supabase dashboard -> Project Settings -> API)

# 3. (one-time, in Supabase) Run `backend/sql/001_profiles.sql` in the SQL Editor.
#    This creates the `profiles` table, RLS policies and the on_auth_user_created
#    trigger. The script is idempotent; it updates the `role` CHECK to accept
#    ('user', 'admin', 'funcionario') if the table already exists.

# 4. Run the server
npm run dev          # API on http://localhost:3000 (auto-reload)
```

In a second terminal, serve the static frontend:

```bash
cd ..
npx http-server -p 8080 -c-1
# Open http://localhost:8080/login/index.html
```

## Endpoints

- `GET  /api/health`           — liveness probe
- `POST /api/auth/signup`      — body: `{ fullname, email, phone, password }`
- `POST /api/auth/login`       — body: `{ email, password }`
- `GET  /api/auth/me`          — requires `Authorization: Bearer <access_token>`
- `POST /api/auth/forgot`      — body: `{ identifier }` — starts password reset, sends a 6-digit code
- `POST /api/auth/forgot/verify` — body: `{ identifier, code }` — validates the code, returns `resetToken`
- `POST /api/auth/reset`       — body: `{ resetToken, newPassword }` — sets the new password

- `GET    /api/plans`                  — public, returns `{ plans: [...] }` ordered by `display_order`
- `GET    /api/plans/:slug`            — public, returns `{ plan }` or 404
- `POST   /api/plans`                  — admin only, body: `{ title, icon?, base_price, consultations_per_month, discount_active?, discount_percent?, discount_start?, discount_end? }` → `{ plan }` (201)
- `PATCH  /api/plans/:id`              — admin only, partial update of any editable field → `{ plan }`
- `DELETE /api/plans/:id`              — admin only, 204; fixed plans (`slug in {avulsa, mensal}`) return 409 `cannot_delete_fixed_plan`

All responses are JSON. Error shape: `{ "error": "<code>", "fields": { ... }? }`.

## Password reset (custom 6-digit code)

Flow: user submits e-mail → backend generates a code, stores `sha256(code + salt)` in `public.password_reset_codes`, and emails the plain code via Resend → user types the 6 digits → backend validates and returns a one-shot `resetToken` → user submits a new password with that token. Tokens are uuid v4 (122 bits entropy), expire after `RESET_CODE_TTL_MINUTES` (default 10), and are invalidated after `RESET_MAX_ATTEMPTS` bad attempts (default 5).

If `RESEND_API_KEY` is empty in `.env`, the code is **printed to the server console** instead of being emailed (dev mode). Set the key when you want real sends.

## Environment variables

See `.env.example`. Required:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only; never expose to the browser)

## Notes

- The frontend stores the `access_token` in `localStorage` under `inspirare_token` and sends it as `Authorization: Bearer ...`.
- For v1, "Confirm email" is disabled in the Supabase dashboard so signup returns a session immediately. Re-enable when SMTP/Resend is wired.
- The Express process is the only thing that should ever read the service role key.
