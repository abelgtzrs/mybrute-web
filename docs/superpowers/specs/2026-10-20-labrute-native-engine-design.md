# LaBrute Native: the plan, in plain words

Date: 2026-10-20
Status: design, waiting for your review

---

## 1. What we're building

A **desktop version of La Brute written in C++**, in its own new GitHub repo called **`labrute-native`**.

It has three jobs:

1. **Play the original game** exactly as it was. Same rules and same fights.
2. **Be a mod bench.** Try new ideas like Shield → Shield+ → Shield++ without breaking the original.
3. **Teach you porting.** The C++ code follows the original Haxe code closely enough that you can open the two side by side and see how one turns into the other.

It's offline and runs on Windows first. There are no accounts and no server.

---

## 2. What we're starting from

Everything we need is in the `LaBrute/` folder of this repo. It has two very different kinds of stuff:

| What | Where | How hard to bring to C++ |
|---|---|---|
| **The rules**: how a brute is built from its seed, how a fight plays out | `LaBrute/src/com/` (`Arena.hx`, `Gladiator.hx`, `Data.hx`), about 1,600 lines | Medium. It's plain logic, and we can translate it line by line. |
| **The fight animation**: how a fight is shown on screen | `LaBrute/fla/client/src/` (`Game.hx`, `Fighter.hx`, the `st/` folder) | Medium. Also logic, but it needs graphics to exist first. |
| **The art**: brutes, weapons, pets, arena | `.swf` and `.fla` files (Flash) | Hard. C++ can't read Flash files. We'll **export** the art once with a free tool (JPEXS FFDec) into normal images, then animate them ourselves. |

We also have a **reference engine**: the JavaScript copy of the original rules that mybrute-plus already uses (`packages/engine`). It's the answer key. If the C++ version and the JS version give the same fight for the same input, the C++ version is correct.

---

## 3. The big picture: four parts, built in this order

The whole project is too big to do in one go, so it's split into four parts. Each one gets its own design → plan → build cycle. **This document covers Part 1 in detail.** The others get their own documents when we reach them.

| # | Part | What you get at the end | Has graphics? |
|---|---|---|---|
| **1** | **Engine port** | The fight rules in C++. A command-line tool that runs a fight and prints the result. | No |
| **3** | **Art + fight playback** | A window that shows a fight with the real brute art, animated. | Yes |
| **4** | **Game shell** | Make a brute, level up, pick opponents, save your progress. The full original game. | Yes |
| **2** | **Mod layer** | Tiered weapons and skills (Shield+/++), editable game data, with "original rules" always one switch away. | Yes |

(The numbers are the original names. You chose to build 1 → 3 → 4 → 2: the original game first, mods last.)

---

## 4. Part 1 in detail: the engine port

### 4.1 The goal in one sentence

Translate the La Brute fight rules from Haxe into C++, and **prove** they're identical by checking thousands of fights against the JavaScript answer key.

### 4.2 Words you'll see

- **Seed**: a number that controls the "random" choices. The same seed always gives the same "random" results. That's how La Brute builds the same brute from the same seed every time.
- **RNG (random number generator)**: the little machine that turns a seed into a stream of random-looking numbers. La Brute's is called `mt.Rand`.
- **Fixture**: a saved example with an input and the correct output. Tests load it, run our code and compare.
- **Parity**: "gives exactly the same results as the original".
- **History**: the list of everything that happened in a fight ("brute 1 attacks brute 2 for 12 damage", "brute 2 dies", ...). The renderer in Part 3 will animate this list.
- **CMake**: the standard tool for building C++ projects. It works with Visual Studio.
- **doctest**: a tiny C++ testing library.
- **CI**: GitHub automatically builds and tests the code on every push.

### 4.3 How a fight works (what we're porting)

```
You give it:     a fight seed + two brutes (each = seed + level + level-up choices)
        │
        ▼
Gladiator        builds each brute: strength, agility, speed, HP,
                 weapons, skills, pets (all decided by the brute's seed
                 and which level-up options were picked)
        │
        ▼
Arena            runs the fight turn by turn using the fight seed,
                 until one team is dead (or 1000 actions pass)
        │
        ▼
You get back:    who won + the history (every event in order)
                 + team stats (dodges, blocks, ...) + achievements
```

### 4.4 What the new repo will look like

```
labrute-native/
  CMakeLists.txt              ← build instructions
  engine/                     ← the rules, as a library (no files, no JSON)
    include/labrute/
      Rand.h                  ← the random number machine
      Data.h                  ← lists: weapons, skills, pets, their numbers
      Gladiator.h             ← builds a brute from seed + level-ups
      Arena.h                 ← runs the fight
      History.h               ← the fight's event list
    src/                      ← one .cpp per file above, same function names as the Haxe
  tools/fight/main.cpp        ← command-line tool: fight in → result out (as JSON)
  tests/
    fixtures/                 ← answer-key files made from the JS engine
    *_test.cpp                ← tests that compare our results to the answer key
  docs/porting-notes.md       ← your learning log: every Haxe→C++ trick and trap
```

### 4.5 The answer key (fixtures)

A small script **in this repo** (`packages/engine/scripts/gen-native-fixtures.cjs`) runs the JS engine and saves three answer-key files. It's modeled on the `make-golden.cjs` script that's already there.

| File | What's in it | Checks |
|---|---|---|
| `rand.json` | 20 seeds, the first 1,000 random numbers from each | The RNG |
| `glads.json` | 500 brutes (random seed, level 1–150, random level-up choices) and their final stats | Brute building |
| `fights.json` | 2,000 full fights, input and complete result | The whole fight engine |

You copy these into `labrute-native/tests/fixtures/` once. They never change unless the original engine changes, and it won't.

`fights.json` includes an "easy" group (low levels, no pets), so we can test the basic fight loop before weapons and skills are ported.

### 4.6 The build steps

Each step is **finished only when its tests pass**. No moving on with broken tests.

| Step | What we build | Done when |
|---|---|---|
| 1 | Empty project: CMake, doctest, a fixture loader, GitHub CI | It builds on Windows + Linux and one dummy test passes |
| 2 | `Rand`: the random number machine | Every number in `rand.json` matches |
| 3 | `Data`: weapons, skills, pets tables | Spot checks pass (right count, right values) |
| 4 | `Gladiator`: building a brute | Every brute in `glads.json` matches |
| 5 | `Arena`: the fight, in small pieces: plain punches → weapons → dodge/block/counter → skills → pets | Every fight in `fights.json` matches |
| 6 | The `fight` command-line tool | Running any fixture input prints exactly the expected output |

Step 5 is the biggest, since `Arena.hx` is about 880 lines. That's why it's done in pieces.

### 4.7 When a test fails, it tells you where

A bad test doesn't just say "fight #812 is wrong". It says:

> Fight #812: event #37 is different.
> Expected: `Attack(1 → 2, damage 14)`
> Got: `Attack(1 → 2, damage 13)`
> (plus the 3 events before it)

Almost every porting bug shows up as "the random numbers got out of sync at some point". So the `fight` tool also gets a `--trace` switch that prints every random number used and which function asked for it. You compare that against the JS version and find the exact line where they split.

### 4.8 The traps (the main things you'll learn)

These are the places where "translate line by line" quietly gives the wrong answer. Each one goes into `porting-notes.md` with an example.

| In Haxe/JS... | In C++ we must... | Why |
|---|---|---|
| `seed * 16807 % 2147483647` just works | Do the math in 64-bit (`int64_t`) | The number gets too big for 32 bits and silently breaks |
| `Math.round(-2.5)` gives `-2` | Use `floor(x + 0.5)`, **not** `std::round` (which gives `-3`) | Different rounding rules |
| `Std.int(3.9)` gives `3` | Cut off the decimals toward zero | Same as C++ casting, but be explicit |
| Sorting a list keeps equal items in order | Use `std::stable_sort`, **not** `std::sort` | Otherwise turn order can shuffle and every fight after that point is different |
| Objects are shared by reference | Store brutes once (`unique_ptr`) and pass pointers around | Copying a brute by accident means damage hits the copy, not the real one |
| Enum order (`Knife`, `Sword`, ...) | Keep the **exact same order** | The code uses positions as numbers, and the level-up choices depend on them |
| Decimal math is the same everywhere | Turn off compiler "fast math" (`/fp:precise`, `-ffp-contract=off`) | Otherwise tiny decimal differences change who wins |
| `mt.Rand` and some helpers have no Haxe source | Port them from the compiled JS in `packages/engine/src/generated/` | That's the only place they exist |

### 4.9 What Part 1 does NOT include

So it doesn't grow forever:

- **No graphics, no window, no art.** That's Part 3.
- **No menus, saving, or creating brutes in a UI.** That's Part 4. (The engine *will* be able to list a brute's level-up options, because building brutes needs that anyway.)
- **No mods or Shield+.** That's Part 2. One small thing helps later for free: the weapon and skill numbers are stored as tables, not buried in code.
- **No** translations (`Lang.hx`), tournaments (`Tournoi.hx`), inventory screen, or mybrute-plus's own extra features. Each can be added later if a part needs it.

### 4.10 How Part 1 hands off to Part 3

Part 3 (the animated fight) uses the engine like this:

1. Give `Arena` the fight.
2. Get back the history list.
3. Play each event with the matching animation. The original has one animation file per event type in `fla/client/src/st/` (Attack, Grab, Steal, Bomb, ...), and we'll port those in Part 3.

The history list's shape is locked in at the end of Part 1, so Part 3 can rely on it.

### 4.11 Part 1 is done when

- [ ] All 20 RNG seeds, 500 brutes and 2,000 fights match the answer key **100%**
- [ ] On both Windows (Visual Studio) and Linux (GCC), checked by GitHub CI
- [ ] The `fight` tool reproduces any fixture exactly
- [ ] `porting-notes.md` explains every trap we hit

---

## 5. Risks, honestly

| Risk | How likely | What we do about it |
|---|---|---|
| A tiny math difference makes a few fights not match | Likely at first | `--trace` and the first-difference report find it fast. It's normal porting work. |
| The JS answer key has a mybrute-plus change in it that the original didn't have | Low | The only known change is the `teamStats` export, which is documented. We match the JS as-is. |
| Part 3 (art) turns out much harder than expected | Medium | That's why it's a separate part with its own design. Part 1 is useful on its own either way. |

---

## 6. What happens next

1. **You review this document** and tell me what to change.
2. I write a **step-by-step build plan** for Part 1: the exact files, the exact tests, in order.
3. We create the `labrute-native` repo and start at Step 1.
