# Deploying Slov

```
Browsers ──► Vercel ──► slov-web      app.slov.tech   (staff, parent and owner portals)
         └─► Vercel ──► slov-landing  slov.tech       (marketing site)
Apps/web ──► api.slov.tech ──► one EC2 server: Caddy (HTTPS) ► API ► Postgres + Redis
Backups  ──► Cloudflare R2 (database dumps, encrypted)      Files ──► Cloudflare R2 (separate bucket)
```

The server runs four containers with Docker Compose (`infra/prod`). One command, `slovctl`, does everything you need.

## 1. DNS (at the domain registrar)

| Name | Type | Value |
|---|---|---|
| `api` | A | the server's public IP (EC2 Elastic IP recommended so it never changes) |
| `app` | CNAME | `cname.vercel-dns.com` |
| `@` (slov.tech) | A | `76.76.21.21` |
| `www` | CNAME | `cname.vercel-dns.com` |

## 2. The server (once)

On your own computer, with the repository checked out and the key file:

```bash
scp -i slov.pem infra/prod/bootstrap.sh ubuntu@<server-ip>:
ssh -i slov.pem ubuntu@<server-ip>
sudo BFF_SECRET=<value already set on the Vercel project> bash bootstrap.sh
```

(`BFF_SECRET` is optional: leave it out and the script generates one and prints it, then set that on Vercel instead.) It installs Docker, sets India time, a firewall (22, 80, 443 only), a small swap file, log limits, fail2ban and automatic security updates; creates a read-only deploy key (it prints the public key: add it under GitHub, repository Settings, Deploy keys); writes `/opt/slov/repo/infra/prod/.env` with fresh random secrets; installs the daily schedule; and starts everything. Run it again any time, it is safe.

Then create the platform owner:

```bash
slovctl owner you@slov.tech 'A-strong-Password1' 'Your Name'
```

## 3. Vercel

Both projects are connected to the repository (`main` deploys to production).

- `slov-web`: root `apps/web`. Environment: `NEXT_PUBLIC_API_URL=https://api.slov.tech`, `API_URL=https://api.slov.tech`, `BFF_SECRET=<the value bootstrap printed, also in the server's .env>`.
- `slov-landing`: root `apps/landing`. No environment needed.

`BFF_SECRET` lets the API see each visitor's real address (sign-in lockouts and the audit log) even though the web app's server makes the call.

## 4. Everyday

```bash
slovctl status            # what is running, disk, last backups, public health check
slovctl deploy            # pull latest code from GitHub, back up, migrate, restart
slovctl logs api          # follow logs (db, redis, caddy too)
slovctl env               # edit settings, then slovctl deploy
slovctl job late-fees     # run any scheduled job now
```

Deploy after each merge to `main`. The migration step runs before the new version starts, and a backup is taken first.

Scheduled jobs (`/etc/cron.d/slov`, India time): late fees 01:30, backup 02:30, usage count 23:50, platform invoices on the 1st at 02:10, notification cleanup Sundays, library reminders 09:00. Output: `/var/log/slov/`.

## 5. Keys, when you have them

Put them in `slovctl env`, then `slovctl deploy`:

- **Email (Resend):** `EMAIL_BACKEND=resend`, `RESEND_API_KEY=`. Verify `slov.tech` in Resend first. Until then login emails only reach the server log (`slovctl logs api`).
- **Files (Cloudflare R2):** `STORAGE_BACKEND=r2` and the four `R2_*` values. Keep the bucket private and add a CORS rule allowing `PUT` from `https://app.slov.tech`.
- **Push (Firebase):** `PUSH_BACKEND=fcm`, `FCM_PROJECT_ID`, `FCM_SERVICE_ACCOUNT`.

## 6. Backups

`slovctl backup` runs every night at 02:30 and before every deploy. Dumps are kept 7 days on the server and, once R2 is set up, copied there and kept 30 days. They are encrypted with `BACKUP_PASSPHRASE` (in `backup.env`, **copy it somewhere safe**: a backup cannot be opened without it).

To switch R2 on: create a bucket `slov-backups` (private) and an API token limited to it, then `slovctl env backup.env` and fill the four `BACKUP_R2_*` lines. `slovctl backup` prints "Copied to R2" when it works.

Restore: `slovctl fetch-backup` lists what is in R2, download one with the `rclone` line it prints, then `slovctl restore /opt/slov/backups/<file>`. Try a restore on a spare server once before you need it.

Redis keeps only short-lived data (sign-in lockouts), so it is not backed up. For a second layer, also take an EBS snapshot of the server's disk weekly (AWS console, Data Lifecycle Manager).

## 7. Good to know

- Restrict SSH (port 22) in the EC2 security group to your own IP. Ports 80 and 443 stay open to everyone.
- Give the server an Elastic IP before you create the DNS record.
- One t2.medium comfortably serves dozens of schools. Move Postgres to a managed database (RDS, Neon) if you outgrow it: change `DATABASE_URL` and stop the `db` container.
