#!/bin/bash
export GIT_REPOSITORY_URL="$GIT_REPOSITORY_URL"
git clone "$GIT_REPOSITORY_URL" /home/build-server/source

exec node build.js
