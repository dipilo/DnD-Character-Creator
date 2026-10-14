# Content import pipeline

All player-facing content is data-driven. Source books become **canonical JSON** in `imports/`
and **generated source modules** in `app/src/data/sourceFiles/`, which the app auto-registers.
There is no network access in any of these scripts — you supply the source files locally.

## Automated import options

### 1. 5etools JSON (recommended — most complete)

[5etools](https://5e.tools) publishes clean, structured JSON for every book. Convert one book at a
time, filtered by its 5etools source abbreviation, from a local folder or from a URL:

```
npm run import:5etools -- --dir ./5etools-data --id tashas \
  --label "Tasha's Cauldron of Everything" --source TCE --category supplement

npm run import:5etools -- --url https://5e.tools/book.html#scc --id strixhaven \
  --label "Strixhaven: A Curriculum of Chaos" --category expansion
```

- `--dir` is searched recursively for `spells/*.json`, `bestiary/*.json`, `races.json`,
  `backgrounds.json`, `feats.json`, `items*.json`, `class/class-*.json`, `optionalfeatures.json`,
  `languages.json`, `actions.json` and the `fluff-*.json` beside them.
- `--source` keeps only entries whose 5etools `source` matches (e.g. `TCE`, `XGE`, `XPHB`, `MM`,
  `XDMG`, `SCC`, `GGR`). Omit it to keep everything in the folder.
- `--include-other-sources` also keeps an entry whose `otherSources` names the book. A book
  5etools credits to its reprint needs this: Elemental Evil's spells sit under XGE with `EEPC` in
  `otherSources`, so a strict match imports its species and none of its 43 spells.
- Writes `imports/<id>.canonical.json` and `app/src/data/sourceFiles/<id>.ts`.

#### Importing from a URL

`--url` takes either a 5e.tools page or a data tree, downloads the tree into `--cache`
(default `.cache/5etools-data`, gitignored) and imports from there:

- `https://5e.tools/book.html#scc` — a page that fetches its data at runtime, so the default
  mirror is used and the hash supplies `--source` when `--source` is absent.
- `https://raw.githubusercontent.com/<owner>/<repo>/<ref>/data` — a data tree directly. A
  `github.com/.../tree/...` URL is rewritten to its raw form, and a repo root gets `/data`.

The file list comes from the `index.json` each split directory publishes, so no directory listing
is needed and any mirror laid out like 5etools works. A split directory's index names only its data
files, so `class/fluff-class-*.json` is derived from it. A cached file is reused; `--refresh`
re-downloads. A body that is not valid JSON never lands in the cache, and a failed download fails
the import rather than shipping a partial book. The cache is ~27 MB across ~185 files, downloaded
once and shared by every later import; keeping it out of the repo keeps licensed content out of
version control.

Every book in the tree is read even when `--source` names one: features, items and choice pools
are resolved across all of it, a reprint copies the book it reprints, and a lineage of another
book's race needs that race.

Covers species (+lineages as variants, their structured proficiencies, size options, language
slots and granted spells), classes with their level tables, subclasses, backgrounds (skills,
tool families, language slots, equipment, suggested characteristics and the feat they grant),
spells, equipment (tool families, foci, versatile dice, Strength requirements), feats (benefits,
granted and open spells, structured prerequisites), monsters (saves, skills, resistances, senses,
spellcasting), languages and combat actions.

Pointers are resolved before anything is mapped: `_copy` is filled in from the entry it copies —
across every book in the folder, since a reprint copies the book it reprints — with its `_mod`
operations applied, and each `_versions` variant becomes an entry of its own. A pointer that
cannot be resolved is warned about and the entry ships with only what it states itself.

Every `_mod` mode is applied, including the four keyed `_` that reach past a named property —
`addSkills`, which derives the bonus from the creature's own ability and challenge rating, and
`addSpells` / `removeSpells` / `replaceSpells`, which change its spellcasting block. A mode this
repo has never seen is still warned about rather than skipped quietly.

Flavor text is a separate file in the tree (`fluff-races.json`, `fluff-items.json`,
`fluff-backgrounds.json`, `class/fluff-class-*.json`) and holds the only prose that says what a
species, book background or class *is* — an entry itself carries only its traits. Species,
backgrounds, classes and equipment fall back to it for their description, trimmed to the write-up's
opening three sentences; a book that contributes only the art still files an entry under the name,
so every printing is read and the first with prose wins. Without these files a pack ships
"<name> from <book>." for 118 of its 167 species.

A lineage whose race the filtered book did not print (MToF's Eladrin, Eberron's dragonmarks,
SCAG's Ghostwise Halfling) is adopted: the base race is folded into it by the rules 5etools itself
renders it with, and it ships as a species of its own named `Race (Lineage)`. Without that, a
source filter drops every one of them — MToF prints one race and fourteen lineages. A `_versions`
choice under such a lineage is renamed against the race too, or SCAG's half-elf descents ship as
eleven species called "Variant; Wood Elf Descent; Fleet of Foot".

Not covered, and warned about rather than dropped silently: a spell list a subclass or patron
*expands* (`additionalSpells.expanded`), and spells a background grants in its own right — the
app has no field for either, and a background's spells normally arrive through the feat it grants.

A monster's spellcasting is rendered to the same shape the free-core packs print it in — a header
paragraph, then one line per frequency group ("At will:", "3/day each:", "1st level (4 slots):") —
and joins the trait, action, bonus action, reaction or legendary list its `displayAs` names.

Choice pools — Eldritch Invocations, Metamagic, Fighting Styles, Infusions, Pact Boons, Maneuvers —
come from `optionalfeatures.json`, matched to the feature that offers them by the
`optionalfeatureProgression` the class or subclass states. Options are read across every book in the
folder, not just `--source`, because a supplement's class draws on the core book's pool.

### 2. D&D Beyond HTML export

D&D Beyond has no public API and scraping it violates their terms, so this path takes a **saved
HTML/text page you already have access to** and extracts what it can:

```
npm run import:source -- --document ./XantharsGuideToEverything.txt --id xanathars \
  --label "Xanathar's Guide to Everything" --category supplement
```

Extraction quality depends on the page structure; the 5etools path is more complete and is
preferred when the data is available there.

A feature whose options the book prints as sub-headings gets them from
`documentChoicePoolConfigs` (`scripts/structured-feature-choices.mjs`): Metamagic, Eldritch
Invocations, Pact Boons, Battle Master maneuvers and each class's Fighting Style list. A config
names the section by its anchor where the title is shared — the Fighter, Paladin and Ranger each
print one called "Fighting Style" with a different list under it.

### 3. Free core (SRD) data

`npm run generate:free-core` rebuilds the bundled Basic Rules species/backgrounds/spells/
equipment/feats/monsters from the `febdnddata` package.

## After importing

1. Add a matching entry to `contentSourceManifest` in `app/src/data/librarySources.ts` so the
   source is labeled and filterable (`id` must equal the `--id` you imported with).
2. If the book has a rules edition, add its `sourceId` to `editionSourceIds` in
   `app/src/lib/builderRules.ts`.
3. Rebuild and confirm content counts; see `AGENTS.md` for import hygiene rules.
