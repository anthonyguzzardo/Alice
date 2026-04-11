#!/bin/bash
# Quick commit and push for Marrow
# Usage: ./m "commit message"

if [ -z "$1" ]; then
  echo "Usage: ./m \"commit message\""
  exit 1
fi

git add . && git commit -m "$1" && git push origin main
