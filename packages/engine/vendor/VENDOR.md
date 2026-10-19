# Vendored original engine

These files are copied from the working laboratory (`Downloads/flash/client`, also kept in `/legacy`).
They are the source of truth for La Brute mechanics. **Do not edit them** except for the patch listed below.
`src/generated/*.js` wraps them as ES modules (see `scripts/gen-esm.mjs`) without changing their source.

| File | Origin | Original SHA-256 |
|---|---|---|
| glad.js | Haxe 4.3.7 build of `oracle/GladAPI.hx` (Gladiator) | 73cacfe1b7a81a1b1b9bf59b2becc3ae63fbbfcf8d0f1f6f1de42180ccff1573 |
| fight.js | Haxe 4.3.7 build of `oracle/FightAPI.hx` (Arena) | ddc048996b221445fc26bb4cb6d1a4ac65e1c083b48d7009e4040c9efa372d6e |
| labrute.js | client.swf FlashVars codec (port of the Python tools) | f74f34a01be81dd01e5e753c9f5471bea1d82a6e97f0fc82d0028d84cf5dc102 |
| fightlog.js | history → readable text | 90caf9ba90f5d082620d45d1599ba2d79cefd938d25c12161bd349c5d7136e1b |
| inventory.js | inventory.swf payload + DOM panel (only `params` is used) | 2892f4661828c4e3735866143409b49a2ab1b490ca3e8f1a15cb9562253d3de1 |

The Haxe sources (`oracle/`, `codec/`) are not in this repository, so the compiled JS cannot be rebuilt here.

## Patches

### fight.js, line 1267 (FightAPI wrapper only, not Arena)

```diff
-	return { win : arena1, history : result};
+	return { win : arena1, history : result, teamStats : [arena.teams[0].stats.slice(),arena.teams[1].stats.slice()], achievements : arena.achievements}; // MyBrute++ patch …
```

Adds two read-only outputs: `teamStats` (the Arena's `TeamStat` counters: DODGE, PARADE, DISARM, RIPOSTE, COUNTER,
FOL_FRAG, DAMAGE_MAX, STRIKE, MISSILE_LIGHT; followers are excluded by `Arena.st`) and `achievements`.
`win` and `history` are unchanged; `test/golden.test.ts` checks them against the outputs of the unpatched file.
Patched SHA-256: cc27c5888345489f5894bdfa7248b4f422a3e4fa5a572b253799b3c959ca4875

## SWF assets (apps/web/public/swf)

| File | SHA-256 |
|---|---|
| client.swf (patched Arena.checkDeaths for N-brute teams; original kept as client.swf.bak in the old folder) | 6dfb99d5a2eb0a2e7f7a4498514057f61fb0ca166e5e2af42a5aac89de85a507 |
| perso.swf | d51c64b18809293458e6f607d5411c6733e20aab8369fa3314ccc2fc1880db0e |
| inventory.swf | 4472050814fe6b7e1b05f21cc9da2b5e27958c0744056e1c93737e4bab39caac |
| mini_perso.swf | bf4a3ac17e3e70f5c4e0d88bbf93dad1ccb2162b680f93b98e91ce73ed29c513 |

### Derived: inventory-transparent.swf (apps/web/public/swf)

Generated from the original `inventory.swf` by `apps/web/scripts/derive-inventory.mjs` (the original stays unchanged).
The only change empties the exported sprite `mcBg` (character 272): a full-stage `#faf8c3` rectangle that the
inventory script attaches at depth 0 as a backdrop and never reads. With Ruffle's `wmode: transparent` the
inventory then renders on the page's own background. SHA-256: db8dd76706f55ce37722c963f521c980cb8b81f98272ef3a32d6184f74ead2b0
