#!/usr/bin/env bash
# PreToolUse (Bash): enforce project command rules. Exit 2 = block + tell Claude why.
cmd=$(jq -r '.tool_input.command // empty')
[ -z "$cmd" ] && exit 0
if echo "$cmd" | grep -Eq '(^|[;&|] *)(npm (i|install|add)|yarn add|pnpm (add|i|install)|bun (add|i|install)) +[^-]'; then
  echo "Blocked: add packages with 'npx expo install <pkg>' so versions match SDK 57." >&2; exit 2
fi
if echo "$cmd" | grep -Eq 'git +push.*(--force|-f( |$))'; then
  echo "Blocked: no force pushes." >&2; exit 2
fi
if echo "$cmd" | grep -Eq 'git +add +(-A|--all|\.)( |$)'; then
  echo "Blocked: stage specific paths, not 'git add -A' / 'git add .'." >&2; exit 2
fi
if echo "$cmd" | grep -Eq 'git +(commit|push)'; then
  br=$(git branch --show-current 2>/dev/null)
  if [ "$br" = "main" ] || [ "$br" = "master" ]; then
    echo "Blocked: never commit or push on '$br'. Create a feature branch first (and only commit when the user asks)." >&2; exit 2
  fi
fi
if echo "$cmd" | grep -Eq '(cat|less|head|tail|grep|rg|source) .*(\.\./web|bookhushly/web)[^ ]*/\.env'; then
  echo "Blocked: don't read the web repo's .env files. The only approved path is .claude/hooks/copy-public-env.sh (public Supabase URL + anon key)." >&2; exit 2
fi
exit 0
