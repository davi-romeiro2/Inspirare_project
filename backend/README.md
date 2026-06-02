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

All responses are JSON. Error shape: `{ "error": "<code>", "fields": { ... }? }`.

## Environment variables

See `.env.example`. Required:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only; never expose to the browser)

## Notes

- The frontend stores the `access_token` in `localStorage` under `inspirare_token` and sends it as `Authorization: Bearer ...`.
- For v1, "Confirm email" is disabled in the Supabase dashboard so signup returns a session immediately. Re-enable when SMTP/Resend is wired.
- The Express process is the only thing that should ever read the service role key.
