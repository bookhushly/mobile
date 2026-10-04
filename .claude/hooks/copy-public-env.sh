#!/usr/bin/env bash
# Owner-approved exception (2026-10-04): copy ONLY the two public Supabase values from the web repo's
# .env.local into this repo's gitignored .env.local. Reads no other variable; prints names + lengths only.
set -euo pipefail
src="/Users/mac/Developer/bookhushly/web/.env.local"
dst="$(cd "$(dirname "$0")/../.." && pwd)/.env.local"
[ -f "$src" ] || { echo "source not found" >&2; exit 1; }
get() { awk -v k="$1" 'index($0,k"=")==1 { v=substr($0,length(k)+2); gsub(/^["'\'']|["'\'']$/,"",v); print v; exit }' "$src"; }
url="$(get NEXT_PUBLIC_SUPABASE_URL)"; key="$(get NEXT_PUBLIC_SUPABASE_ANON_KEY)"
[ -n "$url" ] && [ -n "$key" ] || { echo "one of the two public values is missing" >&2; exit 1; }
umask 077
{
  echo "EXPO_PUBLIC_SUPABASE_URL=$url"
  echo "EXPO_PUBLIC_SUPABASE_ANON_KEY=$key"
  echo "EXPO_PUBLIC_API_BASE_URL=https://www.bookhushly.com"
} > "$dst"
echo "wrote $(basename "$dst"): EXPO_PUBLIC_SUPABASE_URL (len ${#url}), EXPO_PUBLIC_SUPABASE_ANON_KEY (len ${#key}), EXPO_PUBLIC_API_BASE_URL"
case "$key" in eyJ*) echo "key looks like a JWT (legacy anon key)";; sb_publishable_*) echo "key is a publishable key";; *) echo "key format unrecognised";; esac
role=$(printf '%s' "$key" | cut -d. -f2 | tr '_-' '/+' | base64 -d 2>/dev/null | grep -o '"role":"[a-z_]*"' || true)
[ -n "$role" ] && echo "jwt claim: $role"
