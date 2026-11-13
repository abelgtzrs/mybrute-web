#!/bin/sh
# Rebuilds apps/web/public/swf/tournoi.swf from the original La Brute tournament bracket (Haxe 2.10, Flash 8).
# Run from the repo root:  sh tools/tournoi/build.sh
# Needs the Haxe 2.10 compiler in tools/tournoi/.haxe2/ (sh tools/tournoi/get-haxe.sh), or set HAXE2_HOME.
# Also needs the original sources in LaBrute/ (Data.hx and the gfx.swf art library).
set -e
T="tools/tournoi"
HX="${HAXE2_HOME:-$T/.haxe2/haxe-2.10-win}"
# Haxe 2 finds its standard library through these two variables
export HAXE_LIBRARY_PATH="$HX/std"
export HAXE_STD_PATH="$HX/std"
"$HX/haxe.exe" -swf apps/web/public/swf/tournoi.swf -swf-version 8 \
  -swf-lib LaBrute/fla/tournoi/gfx.swf -main Tournoi \
  -cp "$T/src" -cp "$T/lib" -cp LaBrute/src/com \
  --flash-strict -swf-header 800:600:40:FAF8C3
ls -l apps/web/public/swf/tournoi.swf
