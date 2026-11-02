#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu server for Slov. Safe to run again.
#   sudo bash bootstrap.sh
set -euo pipefail

REPO_SSH="git@github.com:rx7ankit/school-erp.git"
ROOT=/opt/slov
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo: sudo bash bootstrap.sh" >&2; exit 1; }
say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

say "Packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git curl ca-certificates ufw fail2ban unattended-upgrades cron rclone openssl nano
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
mkdir -p $ROOT/data/postgres $ROOT/data/caddy $ROOT/backups $ROOT/.ssh /var/log/slov
chmod 700 $ROOT/.ssh
usermod -aG docker ubuntu 2>/dev/null || true

say "Read access to the code (a deploy key, read only)"
KEY=$ROOT/.ssh/deploy_key
[ -f $KEY ] || ssh-keygen -t ed25519 -N "" -C "slov-server-deploy" -f $KEY >/dev/null
cat > $ROOT/.ssh/config <<CFG
Host github.com
  IdentityFile $KEY
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
  UserKnownHostsFile $ROOT/.ssh/known_hosts
CFG
export GIT_SSH_COMMAND="ssh -F $ROOT/.ssh/config"
if [ ! -d $ROOT/repo/.git ]; then
  until git clone "$REPO_SSH" $ROOT/repo 2>/dev/null; do
    echo
    echo "GitHub does not know this server yet. Add this key to the repository:"
    echo "  GitHub -> rx7ankit/school-erp -> Settings -> Deploy keys -> Add deploy key (leave 'Allow write access' OFF)"
    echo
    cat $KEY.pub
    echo
    read -r -p "Press Enter after adding the key (Ctrl+C to stop)... " _
  done
fi
git -C $ROOT/repo config core.sshCommand "ssh -F $ROOT/.ssh/config"
chown -R ubuntu:ubuntu $ROOT/repo $ROOT/.ssh 2>/dev/null || true

say "Settings file with fresh secrets"
ENVF=$ROOT/repo/infra/prod/.env
if [ ! -f $ENVF ]; then
  cp $ROOT/repo/infra/prod/env.example $ENVF
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" $ENVF
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 48)|" $ENVF
  sed -i "s|^BFF_SECRET=.*|BFF_SECRET=$(openssl rand -hex 32)|" $ENVF
  chmod 600 $ENVF
  echo "Created $ENVF"
else
  echo "$ENVF already exists, kept as is."
fi

BK=$ROOT/repo/infra/prod/backup.env
if [ ! -f $BK ]; then
  cp $ROOT/repo/infra/prod/backup.env.example $BK
  sed -i "s|^BACKUP_PASSPHRASE=.*|BACKUP_PASSPHRASE=$(openssl rand -hex 24)|" $BK
  chmod 600 $BK
  echo "Created $BK  (copy BACKUP_PASSPHRASE somewhere safe: backups cannot be restored without it)"
fi

say "slovctl command and schedule"
ln -sf $ROOT/repo/infra/prod/slovctl /usr/local/bin/slovctl
chmod +x $ROOT/repo/infra/prod/slovctl
cat > /etc/cron.d/slov <<'CRON'
# Slov scheduled work. Server time is India time. Output goes to /var/log/slov/jobs.log
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
30 1 * * *   root slovctl job late-fees            >> /var/log/slov/jobs.log 2>&1
50 23 * * *  root slovctl job record-usage         >> /var/log/slov/jobs.log 2>&1
10 2 1 * *   root slovctl job platform-invoices    >> /var/log/slov/jobs.log 2>&1
40 3 * * 0   root slovctl job notification-cleanup >> /var/log/slov/jobs.log 2>&1
0 9 * * *    root slovctl job library-reminders    >> /var/log/slov/jobs.log 2>&1
30 2 * * *   root slovctl backup daily             >> /var/log/slov/backup.log 2>&1
CRON
chmod 644 /etc/cron.d/slov
cat > /etc/logrotate.d/slov <<'LR'
/var/log/slov/*.log { weekly rotate 8 compress missingok notifempty }
LR

say "Starting Slov"
slovctl deploy

PUB=$(curl -fsS https://checkip.amazonaws.com 2>/dev/null || echo "this server's public IP")
cat <<DONE

Done. Next:
  1. DNS: add an A record  api.slov.tech -> ${PUB}   (the HTTPS certificate is issued automatically a minute later)
  2. Create the platform owner:   slovctl owner you@example.com 'A-strong-Password1' 'Your Name'
  3. Vercel: set BFF_SECRET on the slov-web project to this value (so sign-in limits see real visitor addresses):
       $(grep '^BFF_SECRET=' $ENVF | cut -d= -f2-)
  4. Later: Resend / R2 / Firebase keys go in   slovctl env   then   slovctl deploy
Check anytime with: slovctl status
DONE
