#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu server for Krevo. Safe to run again.
# The GitHub deploy workflow runs this automatically on the first deploy:
#   sudo BFF_SECRET=<same value as on Vercel> bash /opt/krevo/repo/infra/prod/bootstrap.sh
set -euo pipefail

ROOT=/opt/krevo
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo: sudo bash bootstrap.sh" >&2; exit 1; }
say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

say "Packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y rsync curl ca-certificates ufw fail2ban unattended-upgrades cron rclone openssl nano
if ! command -v docker >/dev/null 2>&1; then
  apt-get install -y docker.io docker-compose-v2 || { curl -fsSL https://get.docker.com | sh; }
fi
docker compose version >/dev/null 2>&1 || apt-get install -y docker-compose-v2 docker-compose-plugin || true
systemctl enable --now docker cron fail2ban

say "Time zone (India) and a little swap"
timedatectl set-timezone Asia/Kolkata || true
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

say "Docker logs stay small"
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
JSON
systemctl restart docker

say "Firewall: only SSH, HTTP, HTTPS"
ufw allow 22/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true

say "Folders"
mkdir -p $ROOT/data/postgres $ROOT/data/caddy $ROOT/backups $ROOT/config /var/log/krevo
usermod -aG docker ubuntu 2>/dev/null || true

say "Code"
[ -f $ROOT/repo/infra/prod/krevoctl ] || { echo "The code is not on this server yet. It is copied here by the GitHub deploy workflow." >&2; exit 1; }
chown -R ubuntu:ubuntu $ROOT/repo 2>/dev/null || true

say "Settings file with fresh secrets"
ENVF=$ROOT/config/.env
if [ ! -f $ENVF ]; then
  cp $ROOT/repo/infra/prod/env.example $ENVF
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" $ENVF
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 48)|" $ENVF
  sed -i "s|^BFF_SECRET=.*|BFF_SECRET=${BFF_SECRET:-$(openssl rand -hex 32)}|" $ENVF
  chmod 600 $ENVF
  echo "Created $ENVF"
else
  echo "$ENVF already exists, kept as is."
fi

BK=$ROOT/config/backup.env
if [ ! -f $BK ]; then
  cp $ROOT/repo/infra/prod/backup.env.example $BK
  sed -i "s|^BACKUP_PASSPHRASE=.*|BACKUP_PASSPHRASE=$(openssl rand -hex 24)|" $BK
  chmod 600 $BK
  echo "Created $BK  (copy BACKUP_PASSPHRASE somewhere safe: backups cannot be restored without it)"
fi

say "krevoctl command and schedule"
ln -sf $ROOT/repo/infra/prod/krevoctl /usr/local/bin/krevoctl
chmod +x $ROOT/repo/infra/prod/krevoctl
cat > /etc/cron.d/krevo <<'CRON'
# Krevo scheduled work. Server time is India time. Output goes to /var/log/krevo/jobs.log
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
30 1 * * *   root krevoctl job late-fees            >> /var/log/krevo/jobs.log 2>&1
50 23 * * *  root krevoctl job record-usage         >> /var/log/krevo/jobs.log 2>&1
10 2 1 * *   root krevoctl job platform-invoices    >> /var/log/krevo/jobs.log 2>&1
40 3 * * 0   root krevoctl job notification-cleanup >> /var/log/krevo/jobs.log 2>&1
0 9 * * *    root krevoctl job library-reminders    >> /var/log/krevo/jobs.log 2>&1
30 2 * * *   root krevoctl backup daily             >> /var/log/krevo/backup.log 2>&1
CRON
chmod 644 /etc/cron.d/krevo
cat > /etc/logrotate.d/krevo <<'LR'
/var/log/krevo/*.log { weekly rotate 8 compress missingok notifempty }
LR

say "Starting Krevo"
krevoctl deploy

PUB=$(curl -fsS https://checkip.amazonaws.com 2>/dev/null || echo "this server's public IP")
cat <<DONE

Done. Next:
  1. DNS: an A record  api.krevo.tech -> ${PUB}   (the HTTPS certificate is issued automatically a minute later)
  2. Create the platform owner:   krevoctl owner you@example.com 'A-strong-Password1' 'Your Name'
  3. Later: Resend / R2 / Firebase keys go in   krevoctl env   then   krevoctl deploy
Check anytime with: krevoctl status
DONE
