#!/usr/bin/env bash
# Linux CI only. ORAS provides unchanged registry manifest bytes for digest binding.
# https://github.com/oras-project/oras/releases/tag/v1.4.0
set -euo pipefail
umask 077
test "$#" -eq 1
destination="$1"
test ! -e "$destination"
test ! -L "$destination"
mkdir -m 700 "$destination"
curl --fail --location --silent --show-error --proto '=https' --proto-redir '=https' \
  --connect-timeout 20 --max-time 120 --max-filesize 6030754 \
  https://github.com/oras-project/oras/releases/download/v1.4.0/oras_1.4.0_linux_amd64.tar.gz \
  --output "$destination/oras.tar.gz"
test "$(stat -c %s "$destination/oras.tar.gz")" = 6030754
printf '%s  %s\n' d8e1dce2fd8ce996f1d901845b688eb0cf505a6082897606f053825bb47935d1 \
  "$destination/oras.tar.gz" | sha256sum --check --strict
tar -xzf "$destination/oras.tar.gz" --no-same-owner --no-same-permissions \
  -C "$destination" oras
chmod 700 "$destination/oras"
"$destination/oras" version
