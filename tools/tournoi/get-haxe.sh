#!/bin/sh
# Downloads the Haxe 2.10 compiler (Windows build) into tools/tournoi/.haxe2/ for build.sh.
# Run from the repo root:  sh tools/tournoi/get-haxe.sh
set -e
D="tools/tournoi/.haxe2"
mkdir -p "$D"
curl -L -o "$D/haxe-2.10-win.zip" https://github.com/HaxeFoundation/haxe/releases/download/v2-10/haxe-2.10-win.zip
unzip -o -q "$D/haxe-2.10-win.zip" -d "$D"
ls "$D"
