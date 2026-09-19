#!/usr/bin/env bash
set -euo pipefail
source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
deploy_parent="$(mktemp -d "${TMPDIR:-/tmp}/dynasty-deploy.XXXXXX")"
deploy_dir="$deploy_parent/scout-grid"
git clone --branch main --single-branch https://github.com/ZacharyWasilewski/Dynasty-Scouting.git "$deploy_dir"
rsync -a --exclude='.git/' --exclude='node_modules/' --exclude='.next/' --exclude='.env*' --exclude='*.tsbuildinfo' --exclude='next-env.d.ts' --exclude='.DS_Store' "$source_dir/" "$deploy_dir/"
cd "$deploy_dir"
npm ci
npm run lint
npm test
npm run build
git add --all
if git diff --cached --quiet; then
  echo "These files are already present on main. Nothing to push."
  exit 0
fi
git commit -m "Fix Dynasty Database audit items 1-16"
git push origin HEAD:main
echo "Pushed to main. Railway will deploy if this branch is connected with autodeploy enabled."
echo "Deployment checkout: $deploy_dir"
