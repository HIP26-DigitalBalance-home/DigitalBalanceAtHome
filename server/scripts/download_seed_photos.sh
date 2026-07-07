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
echo "Downloading curated collage photos (pinned, watermark-free) ..."
echo ""

# Curated 3×3 "completed collage" set used by the showcase challenge in
# seed_dev.py ("Unsere Familienmomente"). Unlike the keyword URLs above, these
# are PINNED to specific Unsplash photo IDs so the demo collage is reproducible
# and never pulls a watermarked Unsplash+ preview. Served straight from
# images.unsplash.com (no watermark) at 1200×900, cropped.
collage() {
    local name="$1"
    local id="$2"
    echo "  → $name"
    curl -fsSL --max-time 40 -L -o "$DEST/$name" \
        "https://images.unsplash.com/photo-$id?w=1200&h=900&fit=crop&q=80"
}

collage collage_baking.jpg    1605433247501-698725862cea  # two kids mixing dough
collage collage_cooking.jpg   1628191012047-e789922abfdf  # mum + toddler at the counter
collage collage_reading.jpg   1543556153-663aaf154a81     # bedtime story by lamplight
collage collage_painting.jpg  1560421683-6856ea585c78     # colourful finger painting
collage collage_planting.jpg  1657664058691-2633847111c4  # dad + daughter watering a pot
collage collage_park.jpg      1561049527-9743861dce35     # family in a golden-hour park
collage collage_fort.jpg      1626965640390-e15068539462  # cosy blanket fort with plants
collage collage_boardgame.jpg 1611891487122-207579d67d98  # colourful board-game meeples
collage collage_dancing.jpg   1758598738278-b1f60933a015  # mum + daughter dancing

echo ""
echo "✅  Done — 12 keyword photos + 9 pinned collage photos saved to $(basename "$DEST")/"
echo "   Re-seed to upload them: POST /dev/seed or run seed_dev.py"
