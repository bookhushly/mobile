#!/usr/bin/env bash
# PreToolUse (Edit|Write): block edits that must never happen. Exit 2 = block + tell Claude why.
f=$(jq -r '.tool_input.file_path // empty')
[ -z "$f" ] && exit 0
case "$f" in
  */.env|*/.env.*|*.p8|*.p12|*.jks|*.key|*.mobileprovision)
    echo "Blocked: never write env/credential files ($f). Use EAS environment variables; only public values go in EXPO_PUBLIC_*." >&2; exit 2 ;;
  */ios/*|*/android/*)
    case "$f" in */mobile/ios/*|*/mobile/android/*)
      echo "Blocked: ios/ and android/ are generated (CNG). Configure native behaviour in app.json / config plugins." >&2; exit 2 ;; esac ;;
  */bookhushly/web/*|*/bookhushly/web-aw/*)
    echo "Blocked: the web repo is read-only from mobile sessions. Record the gap in docs/BACKEND_STATUS.md §9 instead." >&2; exit 2 ;;
  */package-lock.json)
    echo "Blocked: don't hand-edit package-lock.json. Use 'npx expo install <pkg>'." >&2; exit 2 ;;
esac
exit 0
