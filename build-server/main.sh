#!/bin/bash
set -e

echo "Starting build worker..."

if [ -n "$GIT_BRANCH" ]; then
    echo "Cloning branch: $GIT_BRANCH from $GIT_REPOSITORY_URL"
    git clone --depth 1 -b "$GIT_BRANCH" "$GIT_REPOSITORY_URL" /home/app/output
else
    echo "Cloning default branch from $GIT_REPOSITORY_URL"
    git clone --depth 1 "$GIT_REPOSITORY_URL" /home/app/output
fi

exec node script.js
