# Gladiator construction and progression

[`Gladiator.hx`](../../LaBrute/src/com/Gladiator.hx) builds a fighter's stats and abilities from a numeric id and its level-up choices. Its random generator is initialized from that id, so the same id and choice bits reproduce the same generated path. The [`Arena`](arena.md) then uses this mostly static fighter data to create mutable combat state.

## Level-up choice type

`LevelUp` has two alternatives:

- `LCaracs(c1, c2?)`: choose one or two of the four characteristics.
- `LBonus(b)`: gain a tagged [`_Bonus`](data.md#bonus-and-fighter-enums).

At a level-up, `nextLevel()` returns two alternatives. It first may offer one eligible weighted bonus alongside a three-point characteristic choice. If no bonus is selected or eligible, it returns two characteristic choices. A bonus already owned is not offered again. At levels below 80, bonus selection is attempted without the high-level probability reduction; from level 80 onward, the attempt chance decreases with level (`80 / lvl`).

## Choice bits and deterministic generation

`setLevels(n, levels)` rebuilds the fighter up to `n` level-ups. The byte array packs one bit per level, least-significant bit first: bit `i` selects one of the two offers for level-up `i`. If no byte array is supplied, the method creates random choice bytes from the id-seeded generator.

The second offer changes the random seed before generation continues. This means an earlier choice can change later offers, stats, and bonuses even when the later bits are identical. In this code, `lvl` starts at zero and counts completed level-ups; the displayed level is typically `lvl + 1`.

## Base stats and level-up characteristics

The four characteristics are force, agility, speed, and life maximum. A new fighter starts with each at 2, then receives two one-point increases selected from a weighted characteristic pool. On level-up:

- A single characteristic offer adds 3 points to that characteristic.
- A two-characteristic offer adds 2 points to its first characteristic and 1 to its second.
- The selected option may instead add a bonus.

After level-ups, `applyMulti()` applies accumulated multipliers to the four characteristics and converts the results to integers. `getLife()` derives current maximum life as `int(50 + (lifeMax + lvl * 0.25) * 6)`.

## Permanent bonus effects

The following are the effects implemented by `addBonus`; the enum names and weighted pool are in [`Data.hx`](data.md#bonus-and-fighter-enums).

| Permanent | Effect |
|---|---|
| `SUPER_FORCE` | Force +3 and force multiplier x1.5. |
| `SUPER_AGILITY` | Agility +3 and agility multiplier x1.5. |
| `SUPER_SPEED` | Speed +3 and speed multiplier x1.5. |
| `SUPER_LIFE` | Life maximum +3 and life multiplier x1.5. |
| `IMMORTALITY` | Life multiplier x3.5; force, agility, and speed multipliers x0.75. |
| `BLADE_MASTER` | Adds 0.5 to damage coefficient index 1. |
| `BRAWL_MASTER` | Adds 1 to damage coefficient index 0. |
| `VIGILANCE` | Counter stat +1. |
| `PUGNACITY` | Riposte +30. |
| `TWISTER` | Combo +20. |
| `SHIELD` | Parry +45 and enables a shield. |
| `ARMOR` | Armor +5, armor level +1, and speed multiplier x0.9. |
| `LEATHER_SKIN` | Armor +2. |
| `UNTOUCHABLE` | Dodge +30. |
| `VANDALISM` | Enables weapon destruction on a successful attack. |
| `CHOC` | Disarm +50. |
| `BLUNT_MASTER` | Enables the heavy-arms timing effect. |
| `MERCILESS` | Accuracy +30. |
| `SURVIVAL` | Enables survival from a lethal hit with 1 life. |
| `LEAD_BONES` | Enables reduced hammer-type damage. |
| `BALLERINA` | Grants a guaranteed one-time dodge. |
| `STAYER` | Enables a chance to retry an ineffective attack. |
| `WARM_BLOODED` | Starting initiative -200. |
| `INCREVABLE` | Limits incoming damage per hit. |
| `DIESEL` | Speed +5, speed multiplier x2.5, and starting initiative +200. |
| `COUNTER` | Enables counter attacks and adds parry +10. |
| `IRON_HEAD` | Enables a chance to disarm an attacker who hits. |

The four `SUPER_*` bonuses also adjust their own future bonus weights through `superMalus`, making subsequent bonuses in that group less likely. Other weight changes include limiting multiple talent choices to one and making the panther/bear pair mutually exclusive with high probability. See [`Data.BONUS_WEIGHTS`](data.md#static-tables-in-data) for the initial weights.

## Other bonus kinds

- **Super:** adds the super to the fighter's super list; its uses and arena behavior are in [`Arena`](arena.md#supers-and-fight-conditions).
- **Weapon:** adds that weapon to the fighter's available weapons.
- **Follower:** adds the follower to the generated follower list and reduces the fighter's life maximum. The specific adjustment depends on the follower; follower combat stats are in [`Data.FOLLOWERS`](data.md#static-tables-in-data).
- **Talent:** makes the talent choice exclusive by setting the weights of all talent options to zero.

## Field groups

`Gladiator` keeps its data in several related groups:

- **Identity:** `id`, optional `name`, `lvl`, and optional `fol` (follower type).
- **Core characteristics:** `force`, `agility`, `speed`, `lifeMax`, and their four `multi*` multipliers.
- **Combat chances and defense:** `counter`, `riposte`, `combo`, `armor`, `parry`, `dodge`, `disarm`, `accuracy`, `armorLevel`, and `shieldLevel`.
- **Combat behavior flags:** survival, vandalism, heavy arms, lead bones, ballerina, stayer, damage resistance, counter, and iron head.
- **Equipment and acquired bonuses:** `defaultWeapon`, `weapons`, `supers`, `followers`, `bonus`, `lastBonus`, and `lastCarac`.
- **Generation data:** `damageCoef`, `bonusWeight`, `caracWeight`, `totalBonusWeight`, and the id-seeded random generator.
- **Initiative and stance:** `startInit` and `stanceId`. A stance is assigned only on a rare seeded roll during destiny initialization.

`SHIELD_VALUE` is the shared shield-parry amount (45), also used when an opponent disarms a shield in the arena. `lastBonus` and `lastCarac` retain the most recently applied bonus or characteristic choice for consumers that need to inspect progression.

## Constructors and helper methods

- `new Gladiator(id, name?, follower?)` seeds generation from `id`, then initializes either a follower template or a generated fighter.
- `initDestiny()` prepares the characteristic and bonus weight pools and applies seeded restrictions to rare bonuses, rare weapons, and unavailable weapons.
- `initCaracs()` initializes an ordinary fighter's base stats and combat values.
- `initFollower(fol)` copies the follower template from [`Data.FOLLOWERS`](data.md#static-tables-in-data).
- `nextLevel()` creates the two deterministic level-up offers.
- `setLevels(n, bits?)` replays the selected offers up to the requested level-up count.
- `addBonus()` applies a chosen bonus; `setWeight()` updates the weighted bonus pool.
- `caracUp()` applies a characteristic increase; `superMalus()` progressively reduces future weights for the four `SUPER_*` bonuses.
- `have(bonus)` checks whether a bonus is already owned.
- `getSample(bonuses, level, base)` searches ids for a generated fighter with the requested bonuses and level.

See the [arena guide](arena.md) for how the fighter's values are used during a fight.
