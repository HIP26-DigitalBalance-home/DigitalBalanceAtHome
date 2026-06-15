#!/usr/bin/env bash
# Download high-quality seed photos from Unsplash (1200x900, keyword search).
#
# Run from repo root or server directory:
#   bash server/scripts/download_seed_photos.sh
#
# Re-run any time to refresh images. After downloading, re-seed to push them
# to S3: POST /dev/seed or:
#   docker compose exec api sh -c "PYTHONPATH=/app python /app/scripts/seed_dev.py"
#
# Note: source.unsplash.com returns a random photo matching the keywords each
# run. If you want a specific photo, replace the URL with a direct Unsplash
# photo URL: https://images.unsplash.com/photo-{ID}?w=1200&h=900&q=85&fm=jpg

set -euo pipefail

DEST="$(cd "$(dirname "$0")/seed_photos" && pwd)"
mkdir -p "$DEST"

download() {
    local name="$1"
    local url="$2"
    echo "  → $name"
    curl -fsSL --max-time 30 -L -o "$DEST/$name" "$url"
}

echo "Downloading seed photos to $DEST ..."
echo ""

download baking.jpg       "https://source.unsplash.com/featured/1200x900/?family,baking,children,cookies"
download cooking.jpg      "https://source.unsplash.com/featured/1200x900/?family,cooking,kitchen,children"
download park.jpg         "https://source.unsplash.com/featured/1200x900/?family,park,outdoors,children,playing"
download fort.jpg         "https://source.unsplash.com/featured/1200x900/?blanket,pillow,fort,cozy,indoor"
download drawing.jpg      "https://source.unsplash.com/featured/1200x900/?children,drawing,painting,art,creative"
download planting.jpg     "https://source.unsplash.com/featured/1200x900/?family,gardening,planting,seeds"
download library.jpg      "https://source.unsplash.com/featured/1200x900/?library,books,reading,children"
download playdough.jpg    "https://source.unsplash.com/featured/1200x900/?children,clay,playdough,crafts"
download board_game.jpg   "https://source.unsplash.com/featured/1200x900/?family,board,game,playing"
download picnic.jpg       "https://source.unsplash.com/featured/1200x900/?family,picnic,outdoors,blanket"
download planes.jpg       "https://source.unsplash.com/featured/1200x900/?children,paper,airplane,playing"
download storytelling.jpg "https://source.unsplash.com/featured/1200x900/?parent,reading,story,children,bedtime"

echo ""
echo "✅  Done — 12 photos saved to $(basename "$DEST")/"
echo "   Re-seed to upload them: POST /dev/seed or run seed_dev.py"
