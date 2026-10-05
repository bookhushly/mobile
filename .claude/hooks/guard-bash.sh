#!/usr/bin/env bash
# PreToolUse (Bash): enforce project command rules. Exit 2 = block + tell Claude why.
cmd=$(jq -r '.tool_input.command // empty')
[ -z "$cmd" ] && exit 0
if echo "$cmd" | grep -Eq '(^|[;&|] *)(npm (i|install|add)|yarn add|pnpm (add|i|install)|bun (add|i|install)) +[^-]'; then
  echo "Blocked: add packages with 'npx expo install <pkg>' so versions match SDK 57." >&2; exit 2
fi
# Normalise `git -C dir` / `git -c k=v` so the push/commit checks below still match.
cmd=$(printf '%s' "$cmd" | sed -E 's/git( +-[cC] +[^ ]+)+/git/g')
# A leading '+' on a refspec is a force push in disguise.
if echo "$cmd" | grep -Eq 'git +push( +[^ ]+)* +\+[^ ]'; then
  echo "Blocked: '+refspec' is a force push. Use --force-with-lease on a feature branch if a rewrite is really needed." >&2; exit 2
fi
# Force pushes: only --force-with-lease, and never to main/master.
if echo "$cmd" | grep -Eq 'git +push.*(--force([^-]|$)|-f( |$))'; then
  echo "Blocked: no plain force pushes. Use --force-with-lease on a feature branch if a rewrite is really needed." >&2; exit 2
fi
if echo "$cmd" | grep -Eq 'git +push.*--force-with-lease' && echo "$cmd" | grep -Eq '(^|[ :/])(main|master)( |$)'; then
  echo "Blocked: never force-push main/master." >&2; exit 2
fi
# Owner rule (2026-10-05): never add a Claude co-author trailer to commits.
COAUTHOR='co-authored-by:.*(claude|anthropic)'
if echo "$cmd" | grep -Eq 'git +commit' && echo "$cmd" | grep -Eiq "$COAUTHOR"; then
  echo "Blocked: owner rule — never include a 'Co-Authored-By: Claude' line in commit messages." >&2; exit 2
fi
if echo "$cmd" | grep -Eq 'git +push'; then
  if git rev-parse --verify -q origin/main >/dev/null; then
    bad=$(git log --format='%B' origin/main..HEAD 2>/dev/null | grep -Eic "$COAUTHOR")
  else
    bad=$(git log --format='%B' HEAD --not --remotes 2>/dev/null | grep -Eic "$COAUTHOR")
  fi
  if [ "${bad:-0}" -gt 0 ]; then
    echo "Blocked: commits about to be pushed contain a Claude co-author trailer (owner rule). Rewrite those messages first, then push." >&2; exit 2
  fi
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
