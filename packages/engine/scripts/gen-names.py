# Regenerates src/generated/names.ts from the original game's Lang.hx and Data.hx.
# Usage (from the repo root, with the LaBrute/ sources present): python packages/engine/scripts/gen-names.py .
import json, re, sys
repo = sys.argv[1]
data = open(repo + '/LaBrute/src/com/Data.hx', encoding='utf-8', errors='replace').read()
lang = open(repo + '/LaBrute/src/com/Lang.hx', encoding='utf-8-sig').read()

def enum(name):
    body = re.search(r'enum ' + name + r'\s*\{(.*?)\}', data, re.S).group(1)
    body = re.sub(r'//[^\n]*', '', body)
    return [x.strip() for x in body.split(';') if x.strip()]

# engine bonus kind -> (enum, Lang.hx array)
KINDS = {"Permanent": ("_Permanent", "PERMANENTS"), "Super": ("_Super", "SUPERS"), "Talent": ("_Talent", "TALENTS"),
         "Weapons": ("_Weapons", "WEAPONS"), "Followers": ("_Followers", "FOLLOWERS")}
LANGS = ["en", "fr", "es", "de"]

out = {}
for lg in LANGS:
    start = lang.index('Reflect.setField(Lang,"%s",{' % lg)
    nxt = [lang.index('Reflect.setField(Lang,"%s",{' % o) for o in LANGS if lang.index('Reflect.setField(Lang,"%s",{' % o) > start]
    block = lang[start:min(nxt) if nxt else len(lang)]
    out[lg] = {}
    for kind, (en, arr) in KINDS.items():
        m = re.search(arr + r'\s*:\s*\[(.*?)\]', block, re.S)
        names = [json.loads(s) for s in re.findall(r'"(?:\\.|[^"\\])*"', m.group(1))]
        ids = enum(en)
        assert len(names) == len(ids), (lg, kind, len(names), len(ids))
        out[lg][kind] = {i: n[0].upper() + n[1:] for i, n in zip(ids, names)}

src = """// GENERATED from the original game's Lang.hx (LaBrute/src/com/Lang.hx) and Data.hx enum order. Do not edit.
// Official reward names per language, keyed by the engine's bonus kind and id. Helpers live in src/names.ts.
export const BONUS_NAMES = """ + json.dumps(out, ensure_ascii=False, indent=1) + """ as const;
"""
open(repo + '/packages/engine/src/generated/names.ts', 'w', encoding='utf-8').write(src)
print({lg: {k: len(v) for k, v in out[lg].items()} for lg in out})
