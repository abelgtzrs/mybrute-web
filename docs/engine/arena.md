# Arena and combat simulation

[`Arena.hx`](../../LaBrute/src/com/Arena.hx) runs a seeded, two-team fight. It converts [`Gladiator`](gladiator.md) fighters into mutable combatants, advances them in initiative order, applies attacks and abilities, and can record a playback history using the event types from [`Data.hx`](data.md).

## Main concepts

### `Glad`: one combatant during a fight

`Glad` is the mutable arena-time wrapper around a `Gladiator`. It contains:

- The original fighter (`gl`) and current team.
- Current life, initiative, active weapon, carried weapons, and remaining super uses.
- A `status` array, where index 0 is the brute-charge state and index 1 is the net state (`ST_BRUTE` and `ST_NET` in [`Data.hx`](data.md#other-progression-and-combat-enums)).
- Weapon retention (`keep`, `flKeep`), a one-use ballerina dodge, retry-attack and counter flags.
- Optional `timeLimit` and sabotage weapon for temporary support fighters and sabotaged equipment.
- `ct`, a speed-derived timing factor, and `lifeLog`, the sequence of damage values applied to this combatant.

### `Team` and `TeamStat`

A `Team` holds the team's [`TeamProperty`](data.md#shared-records) and an integer counter for every `TeamStat`: `DODGE`, `PARADE`, `DISARM`, `RIPOSTE`, `COUNTER`, `FOL_FRAG`, `DAMAGE_MAX`, `STRIKE`, and `MISSILE_LIGHT` (`MISSILE_HEAVY` is commented out). They track dodges, parries, disarms, ripostes, counters, follower defeats, maximum damage, strikes, and light missile attacks.

`Arena.achievements` is a pair of string-code lists, one per team. At fight end, thresholds award codes: `dodge` at 10 dodges, `parade` at 20 parries, `disarm` at 8 disarms, `ripost` at 8 ripostes, `countr` at 5 counters, `folfra` at 3 follower defeats, `barbar`/`brute` at 50/100 maximum damage, `tornad` at 20 strikes, or `dca` at 20 light missiles. `perfec` is awarded when the winning main fighter has full life remaining.

### Team properties

The arena reads three team-wide settings from `TeamProperty`:

- `_poi`: poison the acting fighter after their action while an opposing main fighter remains alive.
- `_sab`: choose one of a main fighter's weapons as sabotaged before the fight. When that weapon is drawn, it is discarded.
- `_st`: a support fighter specification. When a fighter acts while injured, the support may enter temporarily; the property is cleared when support is used.

The caller supplies these properties with `setTeamProperty`. The arena does not decide how they are selected.

## Fight lifecycle

1. **Initialize.** `new Arena(baseSeed)` creates two blank teams and initializes the random generator from `baseSeed`. `init()` resets the random generator, combatants, followers, history, team statistics, and the arena's internal id counter. A later call to `init()` does not reset `teamWin`, `achievements`, or `handicap`; the constructor initializes the latter two.
2. **Add main fighters.** `addGladiator` builds a `Gladiator` from the fighter id, level, choice bytes, name, and team, then adds a `Glad` state and an `AddFighter` history event.
3. **Add followers and prepare.** `fight()` creates followers for the fighters already present, applies team initiative handicaps, and selects sabotage weapons where requested.
4. **Schedule turns.** The arena repeatedly sorts fighters by initiative and lets the lowest-initiative fighter act. Initial initiative starts at the fighter's `startInit` plus a small random offset; the team's handicap is then added.
5. **Resolve actions.** An action can remove an expired temporary fighter, summon support, use a super, draw or retain a weapon, and then perform a brawl or throw. Poison damage and the next initiative delay are applied afterward.
6. **Check deaths and finish.** Follower deaths remove the follower and save its body as a cadaver. A main fighter's death sets the opposing team as winner. On a winner, `endFight()` records the result and evaluates achievements.

The scheduler has a 1,000-iteration bound. `fight()` calls `endFight()` when `teamWin` has been set; code consuming the arena should account for a fight that reaches the bound without a winner.

The public entry points are `addGladiator`, `setTeamProperty`, `fight`, and `noHistory`. Internally, `sortGlads` selects the next turn, `action` resolves one turn, `attacks`/`attack`/`throwAttack` resolve attacks, and helpers such as `getBrawlDamage`, `getThrowDamage`, `testParade`, `testEsquive`, and `testRiposte` calculate damage and defensive outcomes.

## Attacks, defense, and damage

### Brawling

`attacks` begins with one attack. Additional attacks may occur while the seeded random roll succeeds against a combo chance based on the fighter's combo, weapon combo, and agility; the chance is halved for each continuation. A stayer can retry after an ineffective attack. After the sequence, the defender may riposte unless their net status or a counter condition prevents it.

Each brawl attack computes damage from weapon damage and force, applies the fighter's damage multiplier for that weapon's damage type, doubles it under the brute status, subtracts armor, and floors the result at one. Lead bones reduce hammer-type (`dt == 4`) damage. A successful attack can also trigger vandalism, disarm a held weapon or shield, or let iron head disarm the attacker.

### Throws and other damage

Throw damage uses weapon damage, force, and agility, then subtracts armor and floors at one. Thrown weapons are discarded after the attack; a weapon with `Throw` type remains available and counts toward the light-missile statistic.

The grab super uses a force-based damage roll multiplied by four. Bombs hit each enemy combatant. Downpour throws a subset of the user's carried weapons. Poison damages the acting combatant at the end of their action. Damage is ultimately applied through `hit`, which also handles nets, special damage resistance, temporary-fighter time limits, and survival.

### Defense checks

- **Counter:** depends on the defender's counter stat and the difference between the defender's and attacker's weapon zones.
- **Parry:** combines the defender's parry and weapon parry values against the attacker's weapon penetration; a successful parry can enable a counter attack.
- **Dodge:** combines dodge, the difference in agility, defender weapon dodge, attacker accuracy, and attacker weapon precision. Ballerina guarantees one dodge, then clears its flag.
- **Riposte:** uses the defender's riposte and weapon riposte values, or consumes an already-triggered counter.

The detailed values and field meanings for weapons are in [`Data.hx`](data.md#weapon-records-and-the-weapon-table).

## Supers and fight conditions

Supers are drawn using their `toss` weights and have a limited number of uses. The arena implements:

| Super | Arena effect |
|---|---|
| `THIEF` | Steals an opponent's non-default weapon, subject to weapon-retention checks. |
| `BRUTE` | Applies the damage-doubling brute status. |
| `MEDECINE` | Restores a random portion of missing life when enough life is missing and clears the team's poison property. |
| `NET` | Nets an opponent, delaying their next action; a hit removes the net. |
| `BOMB` | Damages every opposing combatant. |
| `GRAB` | Performs a high-damage force-based attack. |
| `SHOUT` | May remove opposing animal followers from the arena. |
| `HYPNO` | Changes eligible opposing followers to the user's team. |
| `DOWNPOUR` | Throws a subset of the fighter's weapons at an opponent. |
| `TRAPPER` | Uses a dead follower as meat to restore life, with healing based on follower type. |

Several status checks and support/super effects change initiative as well as life or team membership. Their exact emitted events are listed under [`_Action`](data.md#playback-events).

## Weapons, followers, and history

`addGlad` resolves a fighter's weapon and super enums through the tables in [`Data.hx`](data.md#weapon-records-and-the-weapon-table). Followers are generated from each main fighter's follower list and join the same team. Team statistics generally exclude followers; follower defeats are credited separately to the opposing team.

When history is enabled, the arena appends `_Action` values for fighter creation, movement, weapon changes, attacks, status changes, deaths, and the fight result. `noHistory()` disables this recording by setting `history` to `null`; it does not disable the fight itself. These events are the bridge between the simulation and an animation or playback client.
