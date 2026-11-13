# Weapons

A general reference for every weapon in the original engine. The numbers come from `Data.WEAPONS` and the level-up weights from `Data.BONUS_WEIGHTS` in [`Data.hx`](data.md#static-tables-in-data); how each field is used in a fight is described in [Arena](arena.md#attacks-defense-and-damage).

## How weapons work

- Every brute fights bare-handed (`HANDS`) until a weapon is drawn. `HANDS` is the **default weapon** for brutes; [pets](pets.md) default to `FANGS` (dogs and panther) or `HANDS` (bear).
- Weapons are gained as a level-up reward ([Gladiator](gladiator.md#other-bonus-kinds)). A brute may carry many, but only one is held at a time.
- At the start of each action the brute may draw a weapon. Each carried weapon is weighted by its `toss` value (see below), so common weapons are drawn more often. A held weapon is often kept for a while before swapping.
- Losing a weapon (disarmed, stolen, sabotaged, destroyed by vandalism, or thrown away) returns the brute to its default weapon.
- A weapon is either **Brawl** (melee) or **Throw** (ranged). Throwing weapons use the throw damage formula and do not trigger counters or ripostes.
- Some brutes cannot be offered certain weapons at all: when a brute is created, up to two common weapons are disabled, and each of the eight rare weapons (leek, mug, frying pan, piopio, trombone, keyboard, noodle bowl, racquet) is disabled with a 3 in 4 chance ([Gladiator](gladiator.md#constructors-and-helper-methods)).

## Weapon stat glossary

| Stat | Meaning |
|---|---|
| Damage (`deg`) | Base damage; also scales how much of the brute's force is added. |
| Tempo | Base delay before the next action. Higher is slower; the real delay also depends on the brute's speed. |
| Zone | Reach class. The difference between the two fighters' zones changes the counter chance. |
| Combo | Added to the brute's combo and agility to set the chance of an extra attack. |
| Riposte (`rip`) | Added to the brute's riposte chance. |
| Accuracy (`rap`) | Subtracted from the target's dodge chance. |
| Dodge (`dod`) | Added to the holder's own dodge chance. |
| Penetration (`per`) | Subtracted from the target's parry chance. |
| Parry (`par`) | Added to the holder's own parry chance. |
| Disarm (`dis`) | Added to the chance of knocking the target's weapon away. |
| Toss | Weight when the brute draws a weapon during a fight. |
| Damage type (`dt`) | Which damage multiplier applies (see below). |

### Damage types

`dt` selects an entry of the brute's damage multiplier list:

| `dt` | Family | Boosted by |
|---|---|---|
| 0 | Fists and bites (`HANDS`, `FANGS`, `MUG`) | Brawl Master (+100%) |
| 1 | Blades (`KNIFE`, `SWORD`, `SCIMETAR`, `BIG_SWORD`, `HALBERD`) | Blade Master (+50%) |
| 2 | Spears and pointed (`LANCE`, `STICK`, `TRIDENT`, `SAI`) | Nothing extra |
| 3 | Axe | Nothing extra |
| 4 | Blunt (`HAMMER`, clubs, `FLAIL`, `POIREAU`, `POELE`, `TROMBONNE`, `KEYBOARD`, `RACKET`) | Reduced by Lead Skeleton on the target; Bodybuilder speeds up blunt weapons |
| 5 | Fan | Nothing extra |
| 6 | Thrown (`SHURIKEN`, `POUSSIN`, `NOODLES`) | Nothing extra |
| 7 | Whip | Nothing extra |

The attack animation is `Fist`, `Slash`, `Estoc` (thrust) or `Whip`.

## Offense table

English names are those in the English catalog ([Lang](lang.md)); some are loose translations of the French originals.

| Weapon | English name | Type | Damage | Tempo | Zone | Combo | Level-up weight |
|---|---|---|---|---|---|---|---|
| `HANDS` | hands | Brawl | 5 | 120 | 0 | 0 | not obtainable |
| `KNIFE` | knife | Brawl | 7 | 60 | 0 | 30 | 80 |
| `SWORD` | broadsword | Brawl | 10 | 120 | 1 | 0 | 100 |
| `LANCE` | lance | Brawl | 12 | 120 | 3 | 0 | 40 |
| `STICK` | baton | Brawl | 6 | 100 | 3 | 10 | 70 |
| `TRIDENT` | trident | Brawl | 14 | 140 | 3 | 0 | 10 |
| `AXE` | hatchet | Brawl | 17 | 150 | 1 | 0 | 40 |
| `SCIMETAR` | scimitar | Brawl | 10 | 80 | 1 | 15 | 6 |
| `HAMMER` | axe | Brawl | 55 | 230 | 1 | -40 | 3 |
| `BIG_SWORD` | sword | Brawl | 28 | 180 | 2 | 0 | 4 |
| `FAN` | fan | Brawl | 4 | 28 | 0 | 45 | 2 |
| `SHURIKEN` | shuriken | Throw | 3 | 12 | 0 | 30 | 8 |
| `FANGS` | fangs | Brawl | 3 | 100 | 0 | 10 | pets only |
| `WOOD_CLUB` | bumps | Brawl | 30 | 200 | 1 | -60 | 50 |
| `IRON_CLUB` | morning star | Brawl | 20 | 150 | 1 | 0 | 6 |
| `BONE_CLUB` | mammoth bone | Brawl | 14 | 160 | 1 | -10 | 20 |
| `FLAIL` | flail | Brawl | 36 | 220 | 1 | 30 | 4 |
| `WHIP` | whip | Brawl | 10 | 150 | 5 | 35 | 3 |
| `SAI` | sai | Brawl | 8 | 60 | 0 | 30 | 6 |
| `POIREAU` | leek | Brawl | 5 | 110 | 1 | 200 | 2 |
| `MUG` | mug | Brawl | 8 | 90 | 0 | 40 | 2 |
| `POELE` | frying pan | Brawl | 17 | 120 | 1 | -40 | 2 |
| `POUSSIN` | piopio | Throw | 5 | 32 | 0 | 0 | 2 |
| `HALBERD` | halbard | Brawl | 24 | 180 | 4 | 0 | 2 |
| `TROMBONNE` | trombone | Brawl | 20 | 250 | 2 | 30 | 2 |
| `KEYBOARD` | keyboard | Brawl | 7 | 100 | 1 | 50 | 2 |
| `NOODLES` | noodle bowl | Throw | 10 | 45 | 0 | 30 | 2 |
| `RACKET` | racquet | Brawl | 6 | 80 | 1 | 0 | 2 |

Weapons with a weight of 2 are uncommon. Of those, every one except the halberd is also subject to the per-brute rare-weapon disabling described above.

## Defense and utility table

| Weapon | Riposte | Accuracy | Dodge | Penetration | Parry | Disarm | Toss |
|---|---|---|---|---|---|---|---|
| `HANDS` | 0 | 20 | 10 | 0 | -25 | 5 | 10 |
| `KNIFE` | 0 | 50 | 10 | 0 | 0 | 0 | 5 |
| `SWORD` | 10 | 0 | 0 | 0 | 15 | 15 | 5 |
| `LANCE` | -10 | 0 | 0 | 0 | 0 | 10 | 2 |
| `STICK` | 30 | 0 | 5 | 0 | 25 | 25 | 3 |
| `TRIDENT` | 5 | 0 | 0 | 0 | 0 | 20 | 3 |
| `AXE` | 0 | 0 | 0 | 0 | -10 | 0 | 3 |
| `SCIMETAR` | 0 | 20 | 0 | 0 | 10 | 0 | 3 |
| `HAMMER` | -20 | -30 | -40 | 50 | -50 | 10 | 5 |
| `BIG_SWORD` | 0 | -10 | -20 | -20 | 0 | 10 | 5 |
| `FAN` | 50 | 50 | 60 | 0 | -50 | -50 | 5 |
| `SHURIKEN` | 0 | 0 | 15 | 0 | -10 | -50 | 5 |
| `FANGS` | 0 | 0 | 0 | 0 | 0 | 0 | 10 |
| `WOOD_CLUB` | -30 | -35 | -30 | 30 | -30 | 10 | 5 |
| `IRON_CLUB` | 0 | -5 | -10 | 30 | 0 | 10 | 5 |
| `BONE_CLUB` | 0 | 0 | 0 | 50 | 0 | 10 | 5 |
| `FLAIL` | 0 | -10 | -30 | 150 | -50 | -20 | 5 |
| `WHIP` | -10 | 30 | 30 | -20 | -20 | 30 | 5 |
| `SAI` | 0 | 25 | 10 | 0 | 30 | 100 | 5 |
| `POIREAU` | 100 | 100 | 0 | 200 | -50 | 0 | 2 |
| `MUG` | 0 | 30 | 15 | 0 | -10 | 0 | 2 |
| `POELE` | 0 | 0 | 0 | 0 | 40 | 0 | 2 |
| `POUSSIN` | 0 | 0 | 0 | 0 | -10 | 0 | 2 |
| `HALBERD` | 0 | -40 | 0 | 0 | 0 | 10 | 2 |
| `TROMBONNE` | 0 | -10 | 0 | 20 | 20 | 50 | 2 |
| `KEYBOARD` | 0 | 20 | 10 | 0 | 0 | 0 | 2 |
| `NOODLES` | 0 | 0 | 10 | 0 | -10 | 0 | 2 |
| `RACKET` | 100 | 0 | 10 | 0 | 20 | 0 | 2 |

## Quick guide by playstyle

- **Fast and flurry-based:** `FAN`, `SHURIKEN`, `KNIFE`, `SAI`, `MUG` have low tempo and high combo, so they attack often but hit lightly.
- **Heavy hitters:** `HAMMER` (damage 55), `FLAIL`, `WOOD_CLUB` and `BIG_SWORD` hit hard but are slow and hurt the holder's dodge and parry.
- **Defensive:** `STICK`, `SWORD` and `POELE` add parry; `FAN` and `RACKET`/`POIREAU` add riposte.
- **Disarmers:** `SAI` (+100), `TROMBONNE` (+50) and `STICK` (+25) make it easier to knock the target's weapon away.
- **Armor-ignoring:** high penetration (`FLAIL` 150, `POIREAU` 200) mostly reduces the target's chance to parry.

## Related pages

- [Skills](skills.md) for abilities that change weapon behavior (Weapons Master, Brawl Master, Vandalism, Choc, Thief and others).
- [Data](data.md#weapon-records-and-the-weapon-table) for the field definitions in code form.
- [Arena](arena.md#attacks-defense-and-damage) for the formulas.
