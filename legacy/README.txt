Run:   cd ruffle && python3 -m http.server 8000   then open http://localhost:8000  (keep every file in this folder together: index.html, labrute.js, glad.js, fight.js, fightlog.js, fights.json, client.swf, mini_perso.swf, perso.swf)
Needs internet once (loads Ruffle web from unpkg). Do not open index.html via file:// .
Paste any captured payload into the box on the page: it is decoded, the dead art URL is replaced by the local mini_perso.swf, and it is re-encoded in your browser (labrute.js).

glad.js is the oracle's Gladiator compiled to JS (source: ../oracle/GladAPI.hx; rebuild: haxe -cp . -js glad.js GladAPI).
 GladAPI.describe(id, levelUps, choicesArray) -> {levels:[{opts:[o0,o1],bit}], fin:{stats,weapons,supers,...}, check}
 choicesArray[i] is 0/1 for level-up i (shown level i+2); packed into _bits LSB-first, ceil(levelUps/8) bytes.
fight.js = the oracle's Arena compiled to JS (source ../oracle/FightAPI.hx): FightAPI.run({seed,glads,p0,p1}) -> {win,history}. fightlog.js turns the history into text.
perso.swf = standalone brute renderer. FlashVars: data=<gfx string "a;b;...;p"> and chk=<hash>, optional stop=1 (freeze) flip=1 (mirror) head=1 (smaller).
 chk = h=1; for each gfx field x (int): h=((h*11)^x) % 2097151   (perso.swf refuses to draw if chk does not match)
 gfx[0] picks the body variant, gfx[1..10] pick part variants (value mod the part's frame count), gfx[11..15] pick the 5 palette colours (value mod palette size).
 In fights the client overwrites gfx[1] with the brute's armor level (Fighter.setGladiator).
Status: fight player confirmed working in Ruffle by the user. Preview, gfx editor, paste box and action log were tested in Node/jsdom only.
2v2 / N-brute fights: use "Add a brute" on the page (or LaBrute session.addGlad/removeGlad). Both the simulator (fight.js) and the Flash client (client.swf, patched Arena.checkDeaths; original saved as client.swf.bak) end a fight only when all non-support brutes on a team are dead; followers and temporary brutes do not count. The client stacks one HUD panel per brute on each side (Game.addInterGlad); how it positions 4 fighters in the arena is untested.
