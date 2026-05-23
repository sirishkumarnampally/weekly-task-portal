#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Weekly Task Portal — EC2 deploy script
# Run once on a fresh Amazon Linux 2023 / Ubuntu 22.04 instance.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_URL="https://github.com/sirishkumarnampally/weekly-task-portal.git"
APP_DIR="$HOME/weekly-task-portal"

# ── 1. Install Docker (Amazon Linux 2023) ─────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "Installing Docker..."
  if [ -f /etc/os-release ] && grep -q "Amazon Linux" /etc/os-release; then
    sudo yum update -y
    sudo yum install -y docker git
    sudo systemctl enable --now docker
    sudo usermod -aG docker "$USER"
    echo "Docker installed. Log out and back in, then re-run this script."
    exit 0
  else
    # Ubuntu / Debian
    sudo apt-get update -y
    sudo apt-get install -y ca-certificates curl gnupg git
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
      sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo systemctl enable --now docker
    sudo usermod -aG docker "$USER"
    newgrp docker <<'NEWGRP'
NEWGRP
  fi
fi

# ── 2. Clone / update repo ────────────────────────────────────────────────────
if [ -d "$APP_DIR/.git" ]; then
  echo "Pulling latest changes..."
  git -C "$APP_DIR" pull
else
  echo "Cloning repository..."
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

# ── 3. Create .env if missing ─────────────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.production.example .env
  # Auto-fill EC2 public IP
  PUBLIC_IP=$(curl -sf http://checkip.amazonaws.com || echo "")
  if [ -n "$PUBLIC_IP" ]; then
    sed -i "s|http://<EC2_PUBLIC_IP>|http://${PUBLIC_IP}|g" .env
  fi
  # Generate a random JWT secret
  JWT=$(openssl rand -hex 32)
  sed -i "s|replace_with_a_strong_random_secret|${JWT}|g" .env
  echo ""
  echo "⚠️  .env created. Review and adjust before continuing:"
  cat .env
  echo ""
  read -rp "Press Enter to continue with these settings, or Ctrl-C to edit .env first..."
fi

# ── 4. Open firewall port 80 (informational) ──────────────────────────────────
echo ""
echo "Make sure port 80 (HTTP) is open in your EC2 Security Group."
echo ""

# ── 5. Build and start containers ────────────────────────────────────────────
echo "Building and starting containers (this takes a few minutes on first run)..."
docker compose pull --ignore-buildable 2>/dev/null || true
docker compose up --build -d

echo ""
echo "✅  Deployment complete!"
PUBLIC_IP=$(curl -sf http://checkip.amazonaws.com || echo "<your-ec2-public-ip>")
echo "   App: http://${PUBLIC_IP}"
echo ""
echo "Useful commands:"
echo "  docker compose logs -f           # stream logs"
echo "  docker compose ps                # container status"
echo "  docker compose down              # stop containers"
echo "  docker compose up --build -d     # rebuild & restart"
