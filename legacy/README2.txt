Run:   cd ruffle && python3 -m http.server 8000   then open http://localhost:8000
Needs internet once (loads Ruffle web from unpkg). Do not open index.html via file:// .
Custom fights: python3 ../codec/makepayload.py fight.json  -> paste the output as a "params" string in fights.json
 (makepayload already sets _mini to the local mini_perso.swf; _end defaults to "" -- use "javascript:()" if the client misbehaves).
Untested in Ruffle at time of writing.
