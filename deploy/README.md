# Alice — Hetzner deploy

Files in this directory:

| File | Where it lives on Hetzner | Purpose |
|------|---------------------------|---------|
| `alice.service`        | `/etc/systemd/system/alice.service` | systemd unit running the Astro Node server + signal worker |
| `Caddyfile`            | `/etc/caddy/Caddyfile`              | Caddy config: TLS via Let's Encrypt, reverse proxy to localhost:4321, HTTP Basic Auth on owner endpoints |
| `secrets.env.example`  | template for `/etc/alice/secrets.env` | env vars consumed by `alice.service` (encryption key, DB URL, API keys, basic-auth hash) |
| `deploy.sh`            | runs from your laptop                | pushes the latest main + linux-x64 `.node` artifact, restarts the unit |

## One-time setup (run on the Hetzner host)

These steps are intentionally not scripted — they touch billing, SSH keys, and
secrets. Walk through once during initial provisioning, then `deploy.sh` handles
all subsequent deploys.

```bash
# As root on a fresh Hetzner CCX13 in the Hillsboro, OR datacenter.

# 1. System packages
apt update
apt upgrade -y
apt install -y curl ca-certificates gnupg git build-essential

# 2. Node.js 22 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# 3. Caddy 2 (official repo)
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy

# 4. Application user (no shell login, no home dir password — SSH key only via deploy)
useradd --system --create-home --shell /bin/bash alice
mkdir -p /opt/alice /etc/alice /var/log/caddy
chown alice:alice /opt/alice
chown root:alice /etc/alice
chmod 750 /etc/alice

# 5. Authorize the deploy SSH key for the alice user
mkdir -p /home/alice/.ssh
chmod 700 /home/alice/.ssh
# Append your laptop's PUBLIC key (from ~/.ssh/alice_hetzner.pub):
echo 'ssh-ed25519 AAAA... alice-hetzner' >> /home/alice/.ssh/authorized_keys
chmod 600 /home/alice/.ssh/authorized_keys
chown -R alice:alice /home/alice/.ssh

# 6. Allow alice to restart its own service WITHOUT a password
cat >/etc/sudoers.d/alice <<'EOF'
alice ALL=(root) NOPASSWD: /bin/systemctl restart alice.service, /bin/systemctl status alice.service
EOF
chmod 440 /etc/sudoers.d/alice

# 7. Clone the repo as the alice user
sudo -u alice git clone https://github.com/<your-org>/Einstein.git /opt/alice
cd /opt/alice
sudo -u alice npm ci

# 8. Pull the linux-x64 .node from CI
#    (alternatively, do this from your laptop first time and SCP it over)
#    On your laptop:
#      gh run download --name alice-signals-linux-x64 -D /tmp/alice-deploy
#      scp /tmp/alice-deploy/alice-signals.linux-x64-gnu.node alice@<host>:/opt/alice/src-rs/

# 9. Astro server build
sudo -u alice npx astro build

# 10. Configure secrets
cp /opt/alice/deploy/secrets.env.example /etc/alice/secrets.env
# Edit /etc/alice/secrets.env — fill in:
#   ALICE_ENCRYPTION_KEY  (openssl rand -base64 32)
#   ALICE_PG_URL          (Supabase pooler URL)
#   ANTHROPIC_API_KEY
#   OWNER_BASICAUTH_HASH  (caddy hash-password)
chown root:alice /etc/alice/secrets.env
chmod 640 /etc/alice/secrets.env

# 11. Install the systemd unit
cp /opt/alice/deploy/alice.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable alice.service
systemctl start alice.service
systemctl status alice.service     # confirm "active (running)"

# 12. Install the Caddyfile
cp /opt/alice/deploy/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy
journalctl -u caddy --since '1 minute ago'   # confirm cert provisioning

# 13. Set the owner password (one-time)
sudo -u alice -H bash -c 'cd /opt/alice && npm run set-owner-password -- "<your-real-password>"'

# 14. Visit https://fweeo.com/ and log in.
```

## Ongoing deploys (run from your laptop)

```bash
# 1. Push your changes
git push origin main

# 2. Wait for the GitHub Actions `signal-reproducibility` workflow to finish
#    (it builds linux-x64.node with RUSTFLAGS=target-cpu=x86-64-v3 and uploads
#    it as the `alice-signals-linux-x64` artifact).

# 3. Pull the artifact down
gh run download --name alice-signals-linux-x64 -D /tmp/alice-deploy

# 4. Run the deploy script
ALICE_DEPLOY_HOST=<hetzner-ip> \
LOCAL_NODE_BINARY=/tmp/alice-deploy/alice-signals.linux-x64-gnu.node \
deploy/deploy.sh
```

## Provisioning a new subject

```bash
# On your laptop, point at the Supabase DB:
ALICE_PG_URL='postgres://...supabase...' \
  npm run create-subject -- '<username>' '<temp-password>' '<iana-tz>' '<display-name>'
```

Hand the username + temp password to the subject through a private channel
(Signal, in person, etc.). They sign in at `https://fweeo.com/enter`, are
forced to reset the password, then land on their daily question.

## Key facts to never forget

- **`ALICE_ENCRYPTION_KEY` is permanent.** Lose it = lose every encrypted
  subject response. Backed up in your password manager AND in
  `/etc/alice/secrets.env`. Both copies must survive.
- **Owner endpoints are gated by HTTP Basic Auth in Caddy** until session-based
  owner auth lands. The hash is in `OWNER_BASICAUTH_HASH`; generate via
  `caddy hash-password`. Never commit the hash.
- **Database migrations are not automated.** Apply by hand against Supabase:
  `psql -d "$ALICE_PG_URL" -f db/sql/migrations/NNN_*.sql`. Audit before running.
- **Reproducibility flag is mandatory.** The CI's `build-linux-x64` job sets
  `RUSTFLAGS="-C target-cpu=x86-64-v3"`. Do not bypass — Hetzner CCX silently
  mixes Milan and Genoa hosts; without the flag, FP output diverges across
  the fleet and breaks bit-identity.
