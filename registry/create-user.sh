#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
    printf 'Usage: %s <username>\n' "$0" >&2
    exit 2
fi

username=$1
if [[ -z "$username" || "$username" == *:* || "$username" == *$'\n'* ]]; then
    printf 'Username must be non-empty and must not contain a colon or newline.\n' >&2
    exit 2
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
auth_dir="$script_dir/auth"
htpasswd_file="$auth_dir/htpasswd"
mkdir -p "$auth_dir"
umask 077

if [[ -f "$htpasswd_file" ]]; then
    chmod 600 "$htpasswd_file"
fi

IFS= read -r -s -p 'Password: ' password || {
    printf '\nFailed to read password.\n' >&2
    exit 1
}
printf '\n'
if [[ -z "$password" ]]; then
    printf 'Password must not be empty.\n' >&2
    exit 2
fi

hash_line="$(printf '%s\n' "$password" | docker run --rm -i --entrypoint htpasswd httpd:2 -Bni "$username")"
unset password
printf '%s\n' "$hash_line" >> "$htpasswd_file"
chmod 600 "$htpasswd_file"
printf 'User %s added to the registry credentials.\n' "$username"
