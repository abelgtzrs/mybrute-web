# Shared engine data

[`Data.hx`](../../LaBrute/src/com/Data.hx) is the vocabulary shared by fighter generation, the arena, clients, and playback. It declares typed records and enums first, then static game tables in `Data`.

## Transport and inventory records

| Type | Fields | Purpose |
|---|---|---|
| `CreateData` | `_perso`, `_create` (`String`) | Two string fields for a creation-related payload. |
| `InventoryData` | `_l`, `_a`, `_s`, `_name`, `_level`, `_bits` | Encoded inventory state: string payload, boolean flag, integer value, name, level, and packed level-choice bytes. |
| `ClientData` | `_seed`, `_glads`, `_mini`, `_end`, `_arena`, `_p0`, `_p1` | Fight/client payload, including seed, fighter inputs, playback URLs, arena value, and the two team properties. Each `_glads` entry carries id, team, appearance, level, choice bytes, and name. |
| `TournamentData` | `_glads`, `_perso`, `_view`, `_fight`, `_user`, `_league`, `_max` | Tournament/view payload. Each fighter entry contains id, appearance, level, name, user, and an integer field. |

These are structural shapes only; this file does not define serialization or endpoint behavior.

## Playback events

The `_Action` enum is the arena history's event union. Each constructor records enough information for a viewer to reproduce or describe a combat event:

| Event | Information recorded |
|---|---|
| `AddFighter`, `AddFollower` | Fighter appearance/identity or follower type and team. |
| `Leave` | A temporary fighter leaving. |
| `Weapon`, `Trash` | Weapon selection/sabotage or discarding a weapon. |
| `Attack`, `ThrowAttack` | Attacker, target, damage, and (for `Attack`) optional disarm/sabotage flags. |
| `Steal`, `Grab`, `Bomb`, `Medecine` | Super use and its target or resulting damage/healing. |
| `Status`, `Net` | Status id/value or net target. |
| `Escape`, `Hypno` | Followers removed or reassigned. |
| `MoveTo`, `MoveBack` | Animation movement and offset. |
| `Death`, `EndFight` | Fighter death or winning team. |
| `Downpour`, `Eat`, `Poison` | Weapon barrage, healing from a cadaver, or poison damage. |
| `FxResistDamage` | Visual feedback when damage resistance reduces a hit. |

The arena is the producer of these events; see [arena history](arena.md#weapons-followers-and-history).

## Bonus and fighter enums

### `_Permanent`

Permanent combat abilities: `SUPER_FORCE`, `SUPER_AGILITY`, `SUPER_SPEED`, `SUPER_LIFE`, `IMMORTALITY`, `BLADE_MASTER`, `BRAWL_MASTER`, `VIGILANCE`, `PUGNACITY`, `TWISTER`, `SHIELD`, `ARMOR`, `LEATHER_SKIN`, `UNTOUCHABLE`, `VANDALISM`, `CHOC`, `BLUNT_MASTER`, `MERCILESS`, `SURVIVAL`, `LEAD_BONES`, `BALLERINA`, `STAYER`, `WARM_BLOODED`, `INCREVABLE`, `DIESEL`, `COUNTER`, and `IRON_HEAD`.

The names identify the permanent-bonus enum; their actual stat changes are implemented in [`Gladiator.addBonus`](gladiator.md#permanent-bonus-effects).

### `_Super`

One-use or limited-use combat abilities: `THIEF`, `BRUTE`, `MEDECINE`, `NET`, `BOMB`, `GRAB`, `SHOUT`, `HYPNO`, `DOWNPOUR`, and `TRAPPER`. Their arena behavior is described in [supers](arena.md#supers-and-fight-conditions).

### Other progression and combat enums

- `_Talent`: `HYPERACTIVE`, `COOK`, `SPY`, `SABOTEUR`, and `STRIKER`. The source comments describe them as +1 daily training fight, poisoning future opponents, revealing opponent stats, sabotaging future opponents, and joining higher-level teammates' fights, respectively. Their acquisition is handled by [`Gladiator`](gladiator.md); the timed effects are supplied through team properties or surrounding game systems.
- `_Followers`: `DOG_0`, `DOG_1`, `DOG_2`, `PANTHER`, and `BEAR`.
- `_Weapons`: `HANDS`, `KNIFE`, `SWORD`, `LANCE`, `STICK`, `TRIDENT`, `AXE`, `SCIMETAR`, `HAMMER`, `BIG_SWORD`, `FAN`, `SHURIKEN`, `FANGS`, `WOOD_CLUB`, `IRON_CLUB`, `BONE_CLUB`, `FLAIL`, `WHIP`, `SAI`, `POIREAU`, `MUG`, `POELE`, `POUSSIN`, `HALBERD`, `TROMBONNE`, `KEYBOARD`, `NOODLES`, and `RACKET`.
- `_Status`: `ST_BRUTE` and `ST_NET`, represented by positions 0 and 1 in an arena combatant's status array.
- `_Bonus`: a tagged choice of `Permanent`, `Super`, `Followers`, `Talent`, or `Weapons`.
- `WeaponType`: `Throw` or `Brawl`; controls the attack path.
- `StrikeType`: `Fist`, `Slash`, `Estoc`, or `Whip`; describes the animation style.

## Shared records

### `TeamProperty`

`_poi` enables poison, `_sab` enables weapon sabotage, and `_st` optionally describes a support fighter with its id/seed (`_s`), appearance (`_gfx`), level (`_lvl`), and packed choices (`_bits`). The arena consumes these properties; they are not the fighter's permanent stats.

### `BonusSlot`

`id` is a `_Bonus` and `w` is its generation weight. `Data.BONUS_WEIGHTS` is the weighted pool used by level-up generation. A zero weight removes an item from the pool.

### Weapon records and the weapon table

| `Weap` field | Meaning in combat |
|---|---|
| `id` | Weapon enum key. |
| `toss` | Weight in random weapon selection. |
| `deg` | Base damage contribution. |
| `tempo` | Base delay before the fighter's next turn. |
| `rip`, `zone` | Riposte chance contribution and weapon reach class used by counter checks. |
| `rap`, `dod` | Weapon accuracy/precision and dodge modifiers. |
| `per`, `par` | Attacker penetration and defender parry modifiers. |
| `combo` | Contribution to repeated-attack chance. |
| `dt` | Damage-type index used by the fighter's `damageCoef`; hammer-type checks use index 4. |
| `dis` | Contribution to weapon/shield disarm checks. |
| `type`, `anim` | Attack path (`Brawl`/`Throw`) and animation (`Fist`/`Slash`/`Estoc`/`Whip`). |

`Sup` stores a super's enum `id`, selection weight (`toss`), and number of uses (`use`).

## Static tables in `Data`

- `WEAPONS` maps each `_Weapons` value, by enum index, to its `Weap` combat record. `HANDS` is the default bare-handed entry.
- `FOLLOWERS` maps each `_Followers` value to force, agility, speed, life adjustment, combat chances, starting initiative, and default weapon.
- `SUPERS` maps each `_Super` to its selection weight and use count.
- `BONUS_WEIGHTS` assigns each permanent, super, follower, weapon, and talent a level-up draw weight.

These arrays are positional, not keyed maps. Keep each table in the same order as its enum, and see [gladiator progression](gladiator.md#choice-bits-and-deterministic-generation) for how weights and choice bits are applied.
