#!/bin/bash
# Songwon.command — Double-click to launch the Songwon dev server
# Opens http://localhost:3000 in your default browser
#
# Gotchas:
# - Must have Node.js installed (brew install node)
# - First run after clone needs: npm install
# - Port 3000 must be free — kill other dev servers first

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Starting Songwon..."
echo "Opening http://localhost:3000 in your browser..."

open "http://localhost:3000" &
npx next dev --turbopack
