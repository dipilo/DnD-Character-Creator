// Download a 5etools data tree over HTTP into a local cache, so an import can name a URL
// instead of a directory. The adapter still reads the filesystem; this only fills it.

import fs from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_5ETOOLS_DATA_URL = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data';

// The keys `collectFromDir` reads live in these files; everything else in the tree is page data.
// A `fluff-*.json` holds the flavor text; without it every species ships a "<name> from <book>."
// stub, since an entry itself carries only its traits.
const TOP_LEVEL_FILES = [
  'actions.json',
  'backgrounds.json',
  'feats.json',
  'fluff-backgrounds.json',
  'fluff-items.json',
  'fluff-races.json',
  'items.json',
  'items-base.json',
  'languages.json',
  'optionalfeatures.json',
  'races.json'
];

// 5etools publishes an index.json per split directory, so the file list needs no directory listing.
const INDEXED_DIRECTORIES = ['class', 'spells', 'bestiary'];

// A split directory's index names only the data files; its fluff sits beside each one.
const FLUFF_INDEXED_DIRECTORIES = new Set(['class']);

const SITE_HOST_PATTERN = /(^|\.)5e\.tools$/i;

const stripTrailingSlash = (value) => value.replace(/\/+$/, '');

// 5e.tools/book.html#scc is a page that fetches its data at runtime; the hash is the source abbr.
const readSourceAbbrFromHash = (hash) => {
  const raw = decodeURIComponent(String(hash ?? '').replace(/^#/, '')).split(',')[0].trim();
  return /^[a-z0-9-]+$/i.test(raw) ? raw : undefined;
};

export const resolveRemoteDataUrl = (input) => {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`Not a URL: ${input}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported URL scheme "${url.protocol}" — use http(s).`);
  }

  if (SITE_HOST_PATTERN.test(url.hostname)) {
    return { dataUrl: DEFAULT_5ETOOLS_DATA_URL, sourceAbbr: readSourceAbbrFromHash(url.hash) };
  }

  let pathname = stripTrailingSlash(url.pathname);
  if (url.hostname === 'github.com') {
    // github.com/<owner>/<repo>/tree/<ref>/<dir> is a browser page, not the file itself.
    pathname = pathname.replace(/^\/([^/]+)\/([^/]+)\/(?:tree|blob)\/(.+)$/, '/$1/$2/$3');
    url = new URL(`https://raw.githubusercontent.com${pathname}`);
    pathname = stripTrailingSlash(url.pathname);
  }

  const dataUrl = /(^|\/)data$/.test(pathname) ? `${url.origin}${pathname}` : `${url.origin}${pathname}/data`;
  return { dataUrl, sourceAbbr: readSourceAbbrFromHash(url.hash) };
};

const fetchText = async (url) => {
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'dnd-character-creator-importer' } });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
};

const mapWithConcurrency = async (items, limit, worker) => {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
};

const readIndexFileList = async (dataUrl, directory) => {
  const index = JSON.parse(await fetchText(`${dataUrl}/${directory}/index.json`));
  const files = Object.values(index).filter((value) => typeof value === 'string' && value.endsWith('.json'));
  const fluff = FLUFF_INDEXED_DIRECTORIES.has(directory) ? files.map((file) => `fluff-${file}`) : [];
  return [...files, ...fluff].map((file) => `${directory}/${file}`);
};

export const listRemote5eToolsFiles = async (dataUrl) => {
  const indexed = await Promise.all(INDEXED_DIRECTORIES.map((directory) => readIndexFileList(dataUrl, directory)));
  return [...TOP_LEVEL_FILES, ...indexed.flat()];
};

export const fetchRemote5eToolsData = async (dataUrl, cacheDir, { refresh = false, concurrency = 8, log = () => {} } = {}) => {
  const base = stripTrailingSlash(dataUrl);
  log(`Listing ${base} ...`);
  const files = await listRemote5eToolsFiles(base);
  log(`${files.length} data files to reconcile against ${cacheDir}`);

  let downloaded = 0;
  let cached = 0;
  const failures = [];

  await mapWithConcurrency(files, concurrency, async (relativePath) => {
    const target = path.join(cacheDir, relativePath);
    if (!refresh) {
      const existing = await fs.stat(target).catch(() => null);
      if (existing?.isFile() && existing.size > 0) {
        cached += 1;
        return;
      }
    }
    try {
      const body = await fetchText(`${base}/${relativePath}`);
      JSON.parse(body); // a truncated or rate-limited body must not land in the cache as data
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, body, 'utf8');
      downloaded += 1;
    } catch (error) {
      failures.push(`${relativePath}: ${error.message}`);
    }
  });

  log(`Downloaded ${downloaded}, reused ${cached} cached${failures.length ? `, ${failures.length} failed` : ''}.`);
  return { files, downloaded, cached, failures };
};
