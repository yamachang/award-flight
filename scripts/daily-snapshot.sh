#!/bin/bash
# Daily award flight snapshot collector
# Add to crontab: crontab -e
# 0 9 * * * /path/to/award-flight/scripts/daily-snapshot.sh >> /path/to/award-flight/data/cron.log 2>&1

set -e

# Change to project directory
cd "$(dirname "$0")/.."

# Your seats.aero API key
export SEATS_API_KEY="${SEATS_API_KEY:-your_api_key_here}"

echo "=== Snapshot: $(date) ==="

# Run the snapshot collector via Node.js directly (no MCP needed)
node -e "
import { collectSnapshot } from './build/tools/snapshot.js';

const routes = [
  // ---- Customize these routes ----
  { origin: 'JFK,EWR,BOS,ORD', destination: 'NRT,HND', cabin: 'business' },
  { origin: 'JFK,EWR,BOS,ORD', destination: 'TPE', cabin: 'business' },
  // Add more routes as needed
];

for (const r of routes) {
  console.log('Collecting: ' + r.origin + ' → ' + r.destination + ' (' + r.cabin + ')');
  const result = await collectSnapshot(r);
  console.log(result.content[0].text);
  console.log('');
}
"

echo "=== Done ==="
