# Source files

This folder is auto-loaded at build time.

To add a new source pack:
1. Create a new `.ts` file in this folder.
2. Export a default object that matches `ImportedContentSourceFile` from `../librarySources`.
3. Restart the dev server so Vite can pick up the new file.

The importer script at `scripts/import-source.mjs` can generate or refresh source modules directly in this folder.

Some files are generated from local canonical or SRD/free-core data; others remain placeholders until a compatible source document or canonical pack is imported.
