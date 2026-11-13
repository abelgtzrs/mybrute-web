# Original Haxe engine knowledge base

This guide explains the concepts and data structures in the four original Haxe engine modules. It is a reading guide, not a replacement for the source: the linked files remain authoritative for exact combat and progression behavior.

## Start here

- [Arena and combat simulation](arena.md) — turns, attacks, abilities, status, history, and win conditions in [`Arena.hx`](../../LaBrute/src/com/Arena.hx).
- [Shared engine data](data.md) — enums, event records, transport shapes, and weighted weapon, follower, super, and bonus tables in [`Data.hx`](../../LaBrute/src/com/Data.hx).
- [Gladiator construction and progression](gladiator.md) — deterministic stats, level-up offers, permanent bonuses, and followers in [`Gladiator.hx`](../../LaBrute/src/com/Gladiator.hx).
- [Localization](lang.md) — language catalogs, labels, descriptions, and enum-to-name lookup in [`Lang.hx`](../../LaBrute/src/com/Lang.hx).

## General reference

- [Weapons](weapons.md) — every weapon's stats, damage types, and how often it is offered.
- [Skills](skills.md) — permanent abilities, supers, and talents with their effects and weights.
- [Pets](pets.md) — the five followers, their stats, costs, and how they behave in a fight.

## How the modules fit together

[`Gladiator.hx`](gladiator.md) turns an id and a sequence of level-up choices into a fighter's combat statistics and abilities. [`Data.hx`](data.md) defines the enums and tables used by that construction and by combat. [`Arena.hx`](arena.md) schedules fighters and applies the combat rules, optionally recording `_Action` events for playback. [`Lang.hx`](lang.md) supplies localized names and explanatory text for many of those same enum values.

## Reading the source safely

Several tables are indexed by enum position. In particular, weapon, super, follower, permanent-bonus, and language arrays must stay aligned with their corresponding enum declaration. Reordering an enum without updating its indexed tables can silently associate the wrong data or label with an item.

The original code has implementation details that are easy to miss when reading a single file: a gladiator's `lvl` is a count of level-ups (the displayed level is commonly one greater); each team's two properties are assigned by the caller; and the arena's history is an optional playback log rather than the simulation state itself.
