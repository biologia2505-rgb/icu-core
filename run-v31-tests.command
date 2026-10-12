#!/bin/zsh
set -eu
cd "${0:A:h}"
icu_node_path=$(command -v node || true)
if [[ -z "$icu_node_path" ]]; then
  icu_node_path="/Users/sajfiddin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [[ ! -x "$icu_node_path" ]]; then
  print "Для проверки нужен Node.js."
  exit 1
fi
if [[ -z "${ICU_REPORT_PYTHON:-}" && -x /Users/sajfiddin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 ]]; then
  export ICU_REPORT_PYTHON=/Users/sajfiddin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3
fi
"$icu_node_path" tests/run-all.mjs
