#!/usr/bin/env bash
# PostToolUse (Edit|Write): reject forbidden patterns in app source. Exit 2 feeds stderr back to Claude.
f=$(jq -r '.tool_input.file_path // empty')
case "$f" in *.ts|*.tsx) ;; *) exit 0 ;; esac
case "$f" in */src/*) ;; *) exit 0 ;; esac
[ -f "$f" ] || exit 0
is_test=0; case "$f" in *.test.ts|*.test.tsx|*/__tests__/*) is_test=1 ;; esac
problems=()
grep -nEi 'service_role|TICKET_TOKEN_SECRET|sk_(test|live)_[A-Za-z0-9]+|NOWPAYMENTS_API_KEY|PAYSTACK_SECRET' "$f" >/dev/null && problems+=("secret-looking identifier (service_role / TICKET_TOKEN_SECRET / provider secret) — secrets must never be in the app")
grep -nE '@ts-ignore|:\s*any\b|\bas any\b|<any>' "$f" >/dev/null && problems+=("'any' or @ts-ignore — use unknown + narrowing, or @ts-expect-error with a reason")
if [ $is_test -eq 0 ]; then
  grep -nE '\bconsole\.(log|debug)\(' "$f" >/dev/null && problems+=("console.log in app code — use the logger module (no PII/tokens/ticket codes in logs)")
  case "$f" in */src/theme/*|*/src/shared/theme/*|*/src/constants/*) ;; *)
    grep -nE '#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b' "$f" >/dev/null && problems+=("raw hex colour — use design tokens from the theme")
  esac
  case "$f" in */src/theme/*|*/src/ui/*|*/src/shared/theme/*|*/src/shared/ui/*) ;; *)
    grep -nE '\bfontWeight\b' "$f" >/dev/null && problems+=("fontWeight — custom fonts are loaded one family per weight; use the Text variant/weight props from src/ui")
    grep -nE 'width:\s*withTiming|height:\s*withTiming|(top|left|right|bottom|margin[A-Za-z]*|padding[A-Za-z]*):\s*(withTiming|withSpring)' "$f" >/dev/null && problems+=("animating a layout property — animate transform/opacity only (docs/MOTION.md §5)")
  esac
fi
case "$f" in */src/app/*) ;; */src/features/*/domain/*)
  grep -nE "from ['\"](react|react-native|expo[^'\"]*)['\"]" "$f" >/dev/null && problems+=("domain/ code must not import react / react-native / expo (keep it pure and unit-testable)") ;;
esac
case "$f" in */src/features/*)
  grep -nE "from ['\"]@/features/" "$f" | grep -v "@/features/$(echo "$f" | sed -E 's#.*/src/features/([^/]+)/.*#\1#')/" >/dev/null && problems+=("feature imports another feature — go through src/shared instead") ;;
esac
if [ ${#problems[@]} -gt 0 ]; then
  { echo "check-source: $f"; for p in "${problems[@]}"; do echo " - $p"; done; echo "Fix these (see docs/ENGINEERING_STANDARDS.md). If a hit is a false positive, say so explicitly."; } >&2
  exit 2
fi
exit 0
