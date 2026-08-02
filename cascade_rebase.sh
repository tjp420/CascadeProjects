#!/usr/bin/env bash
# cascade_rebase.sh - Sequentially rebase the Track 10-24 development stack
set -euo pipefail

# Ensure local tracking references are completely fresh
git fetch origin

# Define the precise chronological branch dependency chain
BRANCHES=(
  "feature/track10-hsm-audit"
  "feature/track10-kek-rotation"
  "feature/track11-groundwork"
  "feature/track12-groundwork"
  "feature/track13-groundwork"
  "feature/track14-groundwork"
  "feature/track15-groundwork"
  "feature/track16-groundwork"
  "feature/track17-groundwork"
  "feature/track18-groundwork"
  "feature/track19-groundwork"
  "feature/track20-groundwork"
  "feature/track21-groundwork"
  "feature/track22-groundwork"
  "feature/track23-groundwork"
  "feature/track24-groundwork"
)

# Establish the ultimate root base branch that holds the workflow patch
CURRENT_BASE="origin/feature/track10-aes-kw"

for branch in "${BRANCHES[@]}"; do
  echo "========== Processing Branch: $branch =========="

  # Checkout local branch and sync it with origin context
  git checkout "$branch"
  git reset --hard "origin/$branch"

  echo "Rebasing $branch onto base: $CURRENT_BASE..."
  if ! git rebase "$CURRENT_BASE"; then
    echo "Rebase conflict encountered on $branch! Aborting script."
    git rebase --abort
    exit 1
  fi

  echo "Pushing verified rebase to origin..."
  git push --force-with-lease origin "$branch"

  # Move the tracking baseline forward so the next branch rebases onto this updated stack
  CURRENT_BASE="$branch"
  echo "Successfully advanced stack base to: $CURRENT_BASE"
done

echo "All 16 Track branches have been successfully rebased and pushed!"