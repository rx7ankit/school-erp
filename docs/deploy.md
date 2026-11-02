# Deploying Krevo

```
Browsers ──► Vercel ──► krevo-web      app.krevo.tech   (staff, parent and owner portals)
         └─► Vercel ──► krevo-landing  krevo.tech       (marketing site)
Apps/web ──► api.krevo.tech ──► one EC2 server: Caddy (HTTPS) ► API ► Postgres + Redis
Backups  ──► Cloudflare R2 (database dumps, encrypted)      Files ──► Cloudflare R2 (separate bucket)
```

The server runs four containers with Docker Compose (`infra/prod`). One command, `krevoctl`, does everything you need.

## 1. DNS (at the domain registrar)

| Name | Type | Value |
|---|---|---|
| `api` | A | the server's public IP (EC2 Elastic IP recommended so it never changes) |
| `app` | CNAME | `cname.vercel-dns.com` |
| `@` (krevo.tech) | A | `76.76.21.21` |
| `www` | CNAME | `cname.vercel-dns.com` |

## 2. The server (once, then automatic)

Deploys run from GitHub: every push to `main` runs the tests, copies the code to the server over SSH and runs `krevoctl deploy` (migrations, backup first, restart). Nothing is installed on the server by hand and it holds no GitHub key.

In GitHub, repository Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|---|---|
| `EC2_HOST` | the server's public IP (use an Elastic IP) |
| `EC2_SSH_KEY` | the full text of `krevo.pem`, including the BEGIN and END lines |
| `BFF_SECRET` | the same value as on the Vercel `krevo-web` project |

Then Actions → "CI and deploy" → Run workflow (tick "Skip the tests" the very first time if you want it fast). The first run also sets the server up (Docker, firewall, India time, swap, log limits, fail2ban, security updates, daily schedule, fresh random secrets for Postgres and JWT) and starts everything. Later pushes only deploy.

Then create the platform owner (once, on the server):

```bash
krevoctl owner you@krevo.tech 'A-strong-Password1' 'Your Name'
```

The server's settings live in `/opt/krevo/config/.env` and `backup.env` (outside the code folder, so deploys never touch them).

## 3. Vercel

Both projects are connected to the repository (`main` deploys to production).

- `krevo-web`: root `apps/web`. Environment: `NEXT_PUBLIC_API_URL=https://api.krevo.tech`, `API_URL=https://api.krevo.tech`, `BFF_SECRET=<same value as the GitHub secret>`.
- `krevo-landing`: root `apps/landing`. No environment needed.

`BFF_SECRET` lets the API see each visitor's real address (sign-in lockouts and the audit log) even though the web app's server makes the call.

## 4. Everyday

```bash
krevoctl status            # what is running, disk, last backups, public health check
krevoctl deploy            # pull latest code from GitHub, back up, migrate, restart
krevoctl logs api          # follow logs (db, redis, caddy too)
krevoctl env               # edit settings, then krevoctl deploy
krevoctl job late-fees     # run any scheduled job now
```

Deploy after each merge to `main`. The migration step runs before the new version starts, and a backup is taken first.

Scheduled jobs (`/etc/cron.d/krevo`, India time): late fees 01:30, backup 02:30, usage count 23:50, platform invoices on the 1st at 02:10, notification cleanup Sundays, library reminders 09:00. Output: `/var/log/krevo/`.

## 5. Keys, when you have them

Put them in `krevoctl env`, then `krevoctl deploy`:

- **Email (Resend):** `EMAIL_BACKEND=resend`, `RESEND_API_KEY=`. Verify `krevo.tech` in Resend first. Until then login emails only reach the server log (`krevoctl logs api`).
- **Files (Cloudflare R2):** `STORAGE_BACKEND=r2` and the four `R2_*` values. Keep the bucket private and add a CORS rule allowing `PUT` from `https://app.krevo.tech`.
- **Push (Firebase):** `PUSH_BACKEND=fcm`, `FCM_PROJECT_ID`, `FCM_SERVICE_ACCOUNT`.

## 6. Backups

`krevoctl backup` runs every night at 02:30 and before every deploy. Dumps are kept 7 days on the server and, once R2 is set up, copied there and kept 30 days. They are encrypted with `BACKUP_PASSPHRASE` (in `backup.env`, **copy it somewhere safe**: a backup cannot be opened without it).

To switch R2 on: create a bucket `krevo-backups` (private) and an API token limited to it, then `krevoctl env backup.env` and fill the four `BACKUP_R2_*` lines. `krevoctl backup` prints "Copied to R2" when it works.

Restore: `krevoctl fetch-backup` lists what is in R2, download one with the `rclone` line it prints, then `krevoctl restore /opt/krevo/backups/<file>`. Try a restore on a spare server once before you need it.

Redis keeps only short-lived data (sign-in lockouts), so it is not backed up. For a second layer, also take an EBS snapshot of the server's disk weekly (AWS console, Data Lifecycle Manager).

## 7. Good to know

- **Database role.** The API signs in as a plain `krevo` role, never as the Postgres admin: a Postgres superuser skips the row level security that keeps one school's data away from another. `krevoctl deploy` creates the role and keeps its password in step with `APP_DB_PASSWORD`, and the API refuses to start in production if its role could skip it. The admin account (`krevo_admin`) is only used by `krevoctl` for backups and maintenance. CI tests with a plain role for the same reason.

- Restrict SSH (port 22) in the EC2 security group to your own IP. Ports 80 and 443 stay open to everyone.
- Give the server an Elastic IP before you create the DNS record.
- One t2.medium comfortably serves dozens of schools. Move Postgres to a managed database (RDS, Neon) if you outgrow it: change `DATABASE_URL` and stop the `db` container.
