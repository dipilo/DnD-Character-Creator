# Content import pipeline

All player-facing content is data-driven. Source books become **canonical JSON** in `imports/`
and **generated source modules** in `app/src/data/sourceFiles/`, which the app auto-registers.
There is no network access in any of these scripts — you supply the source files locally.

## Automated import options

### 1. 5etools JSON (recommended — most complete)

[5etools](https://5e.tools) publishes clean, structured JSON for every book. Download the data
files you own into a local folder, then convert one book at a time, filtered by its 5etools
source abbreviation:

```
npm run import:5etools -- --dir ./5etools-data --id tashas \
  --label "Tasha's Cauldron of Everything" --source TCE --category supplement
```

- `--dir` is searched recursively for `spells/*.json`, `bestiary/*.json`, `races.json`,
  `backgrounds.json`, `feats.json`, `items*.json`, and `class/class-*.json`.
- `--source` keeps only entries whose 5etools `source` matches (e.g. `TCE`, `XGE`, `XPHB`, `MM`,
  `XDMG`). Omit it to keep everything in the folder.
- Writes `imports/<id>.canonical.json` and `app/src/data/sourceFiles/<id>.ts`.

Covers species (+lineages as variants), subclasses, backgrounds, spells, equipment, feats, and
monsters. Full class tables are not imported (5etools models them as feature graphs).

### 2. D&D Beyond HTML export

D&D Beyond has no public API and scraping it violates their terms, so this path takes a **saved
HTML/text page you already have access to** and extracts what it can:

```
npm run import:source -- --document ./XantharsGuideToEverything.txt --id xanathars \
  --label "Xanathar's Guide to Everything" --category supplement
```

Extraction quality depends on the page structure; the 5etools path is more complete and is
preferred when the data is available there.

### 3. Free core (SRD) data

`npm run generate:free-core` rebuilds the bundled Basic Rules species/backgrounds/spells/
equipment/feats/monsters from the `febdnddata` package.

## After importing

1. Add a matching entry to `contentSourceManifest` in `app/src/data/librarySources.ts` so the
   source is labeled and filterable (`id` must equal the `--id` you imported with).
2. If the book has a rules edition, add its `sourceId` to `editionSourceIds` in
   `app/src/lib/builderRules.ts`.
3. Rebuild and confirm content counts; see `AGENTS.md` for import hygiene rules.
