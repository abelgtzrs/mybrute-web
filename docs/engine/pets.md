# Pets

The engine calls pets **followers** (`_Followers`). A pet is a bonus a brute can pick at a level-up; in the fight it appears as an extra fighter on the owner's side. English catalog names are dog A, dog B, dog C, panther and bear ([Lang](lang.md)).

## The five pets

| Pet | English name | Force | Agility | Speed | Endurance | Combo | Dodge | Start delay | Weapon |
|---|---|---|---|---|---|---|---|---|---|
| `DOG_0` | dog A | 6 | 5 | 3 | -6 | 10 | 0 | 10 | `FANGS` |
| `DOG_1` | dog B | 6 | 5 | 3 | -6 | 10 | 0 | 10 | `FANGS` |
| `DOG_2` | dog C | 6 | 5 | 3 | -6 | 10 | 0 | 10 | `FANGS` |
| `PANTHER` | panther | 23 | 16 | 24 | -4 | 60 | 20 | 60 | `FANGS` |
| `BEAR` | bear | 40 | 2 | 1 | 10 | -20 | 0 | 360 | `HANDS` |

Values are from `Data.FOLLOWERS` ([Data](data.md#static-tables-in-data)). All pets have no armor, no riposte, no counter and no parry. "Start delay" is the starting initiative: a bear takes a long time to act first, a dog acts almost immediately.

The three dogs are identical in the data; they are separate entries so that a brute can own several, and so that each can be told apart in the interface.

### Resulting health

A pet's maximum life uses the same formula as a brute at level 0: `50 + endurance x 6`.

| Pet | Maximum life |
|---|---|
| dog (A, B or C) | 14 |
| panther | 26 |
| bear | 110 |

## Getting a pet

Pets are one of the five reward kinds. Level-up weights from `Data.BONUS_WEIGHTS`:

| Pet | Level-up weight |
|---|---|
| dog A | 20 |
| dog B | 8 |
| dog C | 2 |
| bear | 1 |
| panther | 1 |

Rules from [`Gladiator.addBonus`](gladiator.md#other-bonus-kinds):

- A pet is permanently added to the brute's list, and **costs the owner endurance**: dogs -2 each, panther -6, bear -8 (never below 0).
- Almost always (999 times in 1000), owning the panther makes the bear unavailable and vice versa.
- A pet already owned is never offered again (the same rule as every other bonus).

## In a fight

- When the fight starts ([Arena](arena.md#fight-lifecycle)), every pet owned by a main fighter is created on that fighter's team and acts in the same initiative order as everyone else.
- Pets use the default weapon in their table and no supers.
- Enemy attacks and supers pick a random valid target among all enemy fighters, **pets included**, so pets absorb hits meant for the owner. Poison and bombs hit pets as well.
- A pet never ends the fight when it dies. Only the death of a main fighter does.
- When a pet dies it is removed and kept as a **cadaver** (see Tamer below). The opposing team is credited with a "follower defeat", which counts toward the `folfra` achievement (3 follower defeats).
- Pets do not count toward their team's achievement statistics (dodges, parries, strikes and so on).

## Skills that interact with pets

| Skill | Effect on pets |
|---|---|
| Tamer (`TRAPPER`) | Eats the most recently fallen pet to heal: dogs heal 20% of the owner's max life, panther 30%, bear 50%. Needs at least 20 life missing. |
| Cry of the Damned (`SHOUT`) | Each enemy pet has a 50% chance to leave the fight (netted pets are not affected). |
| Hypnosis (`HYPNO`) | Switches every enemy pet to the user's team. |
| Net (`NET`) | A netted pet is delayed so heavily it effectively stops acting. |

See [Skills](skills.md) for the full list and [Arena](arena.md#supers-and-fight-conditions) for the formulas.

## Related pages

- [Weapons](weapons.md) for `FANGS`, the pets' weapon.
- [Gladiator](gladiator.md#constructors-and-helper-methods) for `initFollower`, which builds a pet from the table above.
- [Data](data.md#other-progression-and-combat-enums) for the `_Followers` enum.
