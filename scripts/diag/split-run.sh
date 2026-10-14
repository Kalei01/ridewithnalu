#!/usr/bin/env bash
# usage: scripts/diag/split-run.sh <kind> <start> <end> <Name> <target>
# Extracts, prunes imports, formats, proves the moved text is identical (ignoring whitespace/trailing commas), typechecks.
set -euo pipefail
kind=$1; s=$2; e=$3; name=$4; target=$5
norm() { tr -d ' \n' | sed 's/,)/)/g;s/,}/}/g;s/,\]/]/g;s/{""}//g'; }
sed -n "${s},${e}p" src/routes/index.tsx | norm > /tmp/split-before.txt
node scripts/diag/split-extract.mjs "$kind" "$s" "$e" "$name" "$target"
node scripts/diag/split-prune-imports.mjs src/routes/index.tsx
npx prettier --write src/routes/index.tsx "$target" >/dev/null 2>&1
norm < "$target" > /tmp/split-after.txt
python3 - <<'PY'
b=open('/tmp/split-before.txt').read(); a=open('/tmp/split-after.txt').read()
import sys
print("IDENTICAL-MOVE" if b in a else "MISMATCH")
sys.exit(0 if b in a else 1)
PY
bun run typecheck 2>&1 | tail -15
wc -l src/routes/index.tsx
