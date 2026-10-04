#!/usr/bin/env bash
# Stop: if app source changed, require a clean typecheck before Claude finishes. Loop-safe.
in=$(cat)
[ "$(echo "$in" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0
git status --porcelain -- src app.json 2>/dev/null | grep -Eq '\.(ts|tsx|json)$' || exit 0
out=$(npx --no-install tsc --noEmit 2>&1) && exit 0
{ echo "Typecheck failed — fix before finishing (npx tsc --noEmit):"; echo "$out" | head -40; } >&2
exit 2
