# Hetzner SSH cheat-sheet

Box: `alice-prod`, CCX13, Hillsboro OR
Public IPv4: `5.78.203.243`
Local key: `~/.ssh/alice_hetzner` (ed25519, passphrase-protected)

## Connect as root (host setup, systemd, /etc, package installs)

```
ssh -i ~/.ssh/alice_hetzner root@5.78.203.243
```

## Connect as alice (deploys, app dir, restart alice.service)

```
ssh -i ~/.ssh/alice_hetzner alice@5.78.203.243
```

`alice` has passwordless sudo for `systemctl restart alice.service` and
`systemctl status alice.service` only. Anything else (apt, /etc edits) needs
the root login.

## Skip the passphrase prompt for a session

```
ssh-add ~/.ssh/alice_hetzner
```

(Type passphrase once. It's cached until logout or `ssh-add -D`.)

## Disconnect

`exit` or `Ctrl+D`. Closing the terminal is also fine — `alice.service` and
`caddy.service` are systemd units, they run independently of the SSH session.

## Common one-liners

Status of both services:
```
ssh -i ~/.ssh/alice_hetzner root@5.78.203.243 'systemctl status alice.service caddy --no-pager | head -30'
```

Tail app logs:
```
ssh -i ~/.ssh/alice_hetzner root@5.78.203.243 'journalctl -u alice.service -n 50 --no-pager'
```

Quick health check from outside:
```
curl -I https://fweeo.com/
```

## If SSH fails with `Permission denied (publickey)`

1. Wrong identity file — check `ls -la ~/.ssh/alice_hetzner*`
2. Pubkey not in `~alice/.ssh/authorized_keys` on the box (root-login still
   works, fix from there)
3. Passphrase typed wrong (you'd see passphrase prompt loop, not denied)

## If you forget the IP

Hetzner Cloud Console → project `alice` → Servers → `alice-prod` → Public IP.
