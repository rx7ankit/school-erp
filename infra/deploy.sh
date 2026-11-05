#!/usr/bin/env bash
# Deploy the latest main to production from your Mac: ./infra/deploy.sh
# Push first. Runs on the server: git pull, backup, migrate, restart. Needs infra/keys/slov.pem.
set -euo pipefail
cd "$(dirname "$0")/.."
ssh -i infra/keys/slov.pem -o StrictHostKeyChecking=accept-new ubuntu@13.203.105.249 'krevoctl update'
curl -fsS https://api.krevo.tech/api/v1/health/ready && echo
