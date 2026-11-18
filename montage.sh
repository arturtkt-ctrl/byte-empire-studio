#!/usr/bin/env bash
# Cut : assemble les plans de Rec en une vidéo verticale 1080x1920 prête pour TikTok, Shorts et Reels.
# Usage : ./montage.sh rush/ "Texte d'accroche" sortie.mp4 [durée_max_s]
set -euo pipefail
DIR="$1"; HOOK="$2"; OUT="$3"; MAX="${4:-40}"
FONT="${FONT:-/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf}"
TMP="$(mktemp -d)"

# 1. Chaque plan : on coupe le chargement, on met au format 1080x1920 sur fond sombre.
i=0
for row in $(jq -c '.[]' "$DIR/shots.json"); do
  f=$(echo "$row" | jq -r .file); t=$(echo "$row" | jq -r .trim)
  ffmpeg -loglevel error -y -ss "$t" -i "$f" -an \
    -vf "scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x0b0b14,fps=30,format=yuv420p" \
    -c:v libx264 -preset veryfast -crf 20 "$TMP/p$(printf %02d $i).mp4"
  i=$((i+1))
done
ls "$TMP"/p*.mp4 | sed "s/.*/file '&'/" > "$TMP/list.txt"
ffmpeg -loglevel error -y -f concat -safe 0 -i "$TMP/list.txt" -c copy "$TMP/body.mp4"

# 2. Accroche en haut pendant 3 s, appel à jouer en bas sur les 4 dernières secondes.
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/body.mp4")
END=$(awk -v d="$DUR" -v m="$MAX" 'BEGIN{print (d<m?d:m)}')
CTA_START=$(awk -v e="$END" 'BEGIN{s=e-4; print (s<0?0:s)}')
# Une ligne de texte = un drawtext centré (accroche coupée en lignes de 22 caractères max).
line() { # fichier taille couleur_texte couleur_boite y debut fin
  echo "drawtext=fontfile=$FONT:textfile=$1:fontsize=$2:fontcolor=$3:box=1:boxcolor=$4:boxborderw=18:x=(w-text_w)/2:y=$5:enable='between(t,$6,$7)'"
}
FILTERS=()
n=0
while IFS= read -r l; do
  [ -z "$l" ] && continue
  printf '%s' "$l" > "$TMP/hook$n.txt"
  FILTERS+=("$(line "$TMP/hook$n.txt" 62 white 0x000000B0 $((160 + n*100)) 0 3)")
  n=$((n+1))
done < <(printf '%s\n' "$HOOK" | fold -s -w 22 | sed 's/ *$//' | head -3)
printf '%s' "Joue gratuitement" > "$TMP/cta1.txt"
printf '%s' "byte-empire.com" > "$TMP/cta2.txt"
FILTERS+=("$(line "$TMP/cta1.txt" 58 0x0b0b14 0xffc93cF0 1560 "$CTA_START" 999)")
FILTERS+=("$(line "$TMP/cta2.txt" 66 0x0b0b14 0xffc93cF0 1660 "$CTA_START" 999)")
VF=$(IFS=,; echo "${FILTERS[*]}")
ffmpeg -loglevel error -y -i "$TMP/body.mp4" -f lavfi -i anullsrc=r=44100:cl=stereo -t "$END" \
  -vf "$VF" -map 0:v -map 1:a -shortest -c:v libx264 -preset veryfast -crf 20 -c:a aac -b:a 128k -movflags +faststart "$OUT"
rm -rf "$TMP"

# 3. Contrôle technique de Vigie : vertical, 5 à 60 s.
W=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$OUT")
H=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$OUT")
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")
echo "Vidéo : ${W}x${H}, ${D}s"
awk -v w="$W" -v h="$H" -v d="$D" 'BEGIN{ if (h<=w || d<5 || d>60) { print "REFUS VIGIE : format ou durée hors règles"; exit 1 } }'
