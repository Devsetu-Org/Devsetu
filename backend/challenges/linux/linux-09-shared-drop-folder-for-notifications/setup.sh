#!/usr/bin/env bash
# payment-bot drops the receipt. order-bot reads it, then drops the confirmation.
# The folder starts locked to root, so neither bot can use it yet.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

box_script <<'EOF'
getent group notify >/dev/null || groupadd notify
for u in order-bot payment-bot auditor; do
  id "$u" >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin "$u"
done
usermod -aG notify order-bot
usermod -aG notify payment-bot
gpasswd -d auditor notify >/dev/null 2>&1 || true
rm -rf /srv/notifications
install -d -m 755 -o root -g root /srv/notifications/outbox
EOF
ok "notify group and bots created; /srv/notifications/outbox is root-only"
