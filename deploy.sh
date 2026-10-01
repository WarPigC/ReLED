#!/bin/bash
set -e

cd /home/piani/hdd/reLED

git pull --ff-only
docker compose up --build -d --remove-orphans
docker image prune -f

echo "Deploy complete."
