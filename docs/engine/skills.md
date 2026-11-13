# Skills

"Skills" here means everything a brute can gain at a level-up other than a weapon or a pet: **permanent abilities**, **supers** (active abilities with limited uses) and **talents**. Names are from the English catalog ([Lang](lang.md)). Weights are the initial level-up weights from `Data.BONUS_WEIGHTS`; a higher number means the skill is offered more often.

## How skills are gained

At every level-up the brute is offered two rewards ([Gladiator](gladiator.md#level-up-choice-type)): usually one random bonus (a skill, weapon or pet, drawn by weight) against a plain characteristic increase. A bonus the brute already has is never offered again.

Three rare skills are usually disabled for a given brute when it is created: Thief, Flash Flood and Hypnosis are each removed with a 2 in 3 chance, and Immortality with a 5 in 6 chance. This is decided by the brute's id, so it never changes.

## Permanent abilities

These are always on. Effects are the ones applied in [`Gladiator.addBonus`](gladiator.md#permanent-bonus-effects).

### Characteristic boosts

| Skill | English name | Weight | Effect |
|---|---|---|---|
| `SUPER_FORCE` | Herculean Strength | 60 | Force +3, then x1.5 |
| `SUPER_AGILITY` | Feline Agility | 60 | Agility +3, then x1.5 |
| `SUPER_SPEED` | Lightning Bolt | 60 | Speed +3, then x1.5 |
| `SUPER_LIFE` | Vitality | 60 | Endurance +3, then x1.5 |
| `IMMORTALITY` | Immortality | 1 | Endurance x3.5; force, agility and speed x0.75 |
| `DIESEL` | Reconnaissance | 1 | Speed +5 and x2.5, but starting initiative +200 (acts later) |

Each of the first four skills lowers the weight of all four to 3 after the first one is taken, then 1, then 0, so a brute rarely stacks many of them. The English catalog's names for `DIESEL` and `INCREVABLE` are loose translations of the French originals.

### Offense

| Skill | English name | Weight | Effect |
|---|---|---|---|
| `BLADE_MASTER` | Weapons Master | 10 | Blade damage +50% |
| `BRAWL_MASTER` | Martial Arts | 10 | Bare-handed and bite damage +100% |
| `TWISTER` | Fists of Fury | 10 | Combo chance +20 |
| `MERCILESS` | Relentless | 1 | Accuracy +30 (reduces the target's dodge) |
| `CHOC` | Shock | 10 | Disarm +50 |
| `VANDALISM` | Sabotage | 3 | A damaging hit destroys one of the target's other weapons |
| `STAYER` | Determination | 4 | After a failed attack, 70% chance to attack again |
| `BLUNT_MASTER` | Bodybuilder | 5 | Heavy (blunt) weapons cost 25% less delay |
| `WARM_BLOODED` | First Strike | 8 | Starting initiative -200 (acts earlier) |

### Defense

| Skill | English name | Weight | Effect |
|---|---|---|---|
| `SHIELD` | Shield | 20 | Parry +45; a shield can later be knocked off |
| `ARMOR` | Armor | 4 | Armor +5, speed x0.9 |
| `LEATHER_SKIN` | Toughened Skin | 30 | Armor +2 |
| `UNTOUCHABLE` | Untouchable | 1 | Dodge +30 |
| `BALLERINA` | Ballet Shoes | 4 | The first attack of each fight is dodged automatically |
| `SURVIVAL` | Survival | 4 | The first lethal hit leaves the brute at 1 life |
| `INCREVABLE` | Resistant | 3 | A single hit can remove at most 20% of max life |
| `LEAD_BONES` | Lead Skeleton | 4 | Blunt weapon damage against this brute -30% |

### Reaction

| Skill | English name | Weight | Effect |
|---|---|---|---|
| `VIGILANCE` | 6th Sense | 20 | Counter stat +1 (see counter formula in [Arena](arena.md#defense-checks)) |
| `PUGNACITY` | Hostility | 4 | Riposte +30 |
| `COUNTER` | Counter-Attack | 10 | Counterattacks after each parry; parry +10 |
| `IRON_HEAD` | Iron Head | 4 | 30% chance that an attacker who hits loses their weapon |

The Spanish catalog and `DESCADVANCED` text in [Lang](lang.md) describe the same effects in each language.

## Supers

Supers are active abilities. During a fight the brute may use one in place of a normal attack: each is drawn by its **fight weight** (`toss`) and can be used a limited number of times. The **level-up weight** controls how often it is offered as a reward. Effects are detailed in [Arena](arena.md#supers-and-fight-conditions).

| Super | English name | Uses | Fight weight | Level-up weight | What it does |
|---|---|---|---|---|---|
| `THIEF` | Thief | 2 | 8 | 10 | Takes the opponent's held weapon (if it is not its default weapon). |
| `BRUTE` | Fierce Brute | 1 | 5 | 20 | Next attack deals double damage. |
| `MEDECINE` | Tragic Potion | 1 | 5 | 8 | Heals 25-50% of lost life (needs 50+ missing) and ends poison. |
| `NET` | Net | 1 | 5 | 16 | Immobilizes a target until it is hit. |
| `BOMB` | Bomb | 2 | 2 | 6 | 15-24 damage to every enemy. |
| `GRAB` | Hammer | 1 | 2 | 1 | Big force-based slam, four times a normal roll. |
| `SHOUT` | Cry of the Damned | 2 | 8 | 4 | Scares away enemy pets (each has a 50% chance to flee). |
| `HYPNO` | Hypnosis | 1 | 3 | 2 | Turns every enemy pet to your side. |
| `DOWNPOUR` | Flash Flood | 1 | 2 | 2 | Throws half of your carried weapons at the enemy. |
| `TRAPPER` | Tamer | 4 | 20 | 4 | Eats a fallen pet to heal. |

The in-game names in the English catalog differ from the code names in a few places (for example `GRAB` is shown as "Hammer" and `TRAPPER` as "Tamer").

## Talents

Talents are daily-use boosts handled by the surrounding game rather than inside a fight. A brute can only ever hold one talent: choosing it disables the other four.

| Talent | English name | Level-up weight | Effect |
|---|---|---|---|
| `HYPERACTIVE` | Regeneration | 3 | One extra training fight per day. |
| `COOK` | Chef | 3 | Future opponents are poisoned for 24 hours (they lose 2% of max life after each action). |
| `SPY` | Spy | 3 | Reveals opposing brutes' stats for 24 hours. |
| `SABOTEUR` | Saboteur | 3 | One weapon of each future opponent is sabotaged for 24 hours. |
| `STRIKER` | Backup | 5 | Your brute can join higher-level teammates' fights. |

Cook, Saboteur and Striker (Backup) are the three that reach the arena, through the team properties `_poi`, `_sab` and `_st` ([Data](data.md#teamproperty)). The team properties are supplied by the caller; the arena only applies them.

## Related pages

- [Weapons](weapons.md) and [Pets](pets.md) for the other two reward kinds.
- [Gladiator](gladiator.md) for how rewards are offered, chosen and applied.
- [Data](data.md#bonus-and-fighter-enums) for the enum definitions.
