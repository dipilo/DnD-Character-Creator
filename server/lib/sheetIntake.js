/**
 * The canonical player-intake schema, and the pure logic that turns sheet rows into seat writes.
 *
 * This is the single source of truth for what a campaign intake form asks and which `players`
 * column each answer lands in. It used to live as ten hardcoded `readMappedOrVariants(...)` alias
 * lists inside `POST /api/sync` — one per field, invented alongside a Google Form nobody had
 * written down. The Form questions below *are* those aliases, so the template a DM copies and the
 * importer that reads it can no longer drift apart. `GET /api/sheet-template` serves this to the
 * client so the mapping UI and the copy-this-template card are generated from it too.
 *
 * Everything here is pure. The planner takes rows and the campaign's existing seats and returns
 * what it *would* write; the route does the writing. That is what makes it testable without a
 * network round trip to Google (`npm run test:sheet-intake`).
 */

/**
 * @typedef {object} IntakeField
 * @property {string} key        stable id, used by the mapping API and the client
 * @property {string} column     the `players` column the answer is stored in
 * @property {string} label      short human name, for the mapping UI
 * @property {string} question   the Form question, verbatim — this is the template's wording
 * @property {'short'|'paragraph'|'choice'} type
 * @property {boolean} [required]
 * @property {boolean} [identity] participates in matching a row to an existing seat
 * @property {string[]} aliases  header spellings accepted without an explicit mapping
 * @property {string} [help]     shown under the question in the template instructions
 * @property {string[]} [choices] suggested options for a multiple-choice question
 */

/** @type {IntakeField[]} */
const INTAKE_FIELDS = [
  {
    key: 'name',
    column: 'name',
    label: 'Player name',
    question: 'What is your name?',
    type: 'short',
    required: true,
    identity: true,
    aliases: ['name', 'player name', 'player', 'full name', 'your name'],
    help: 'What the DM should call them. This is what the roster lists.',
  },
  {
    key: 'discord',
    column: 'discord',
    label: 'Discord handle',
    question: 'What is your Discord username?',
    type: 'short',
    identity: true,
    aliases: ['discord', 'discord username', 'discord handle', 'discord name', 'discord tag'],
    help: 'Matched first when re-importing, so a rename does not create a duplicate seat.',
  },
  {
    key: 'timezone',
    column: 'timezone',
    label: 'Time zone',
    question: 'What time zone are you in?',
    type: 'short',
    required: true,
    aliases: ['timezone', 'time zone', 'tz', 'your timezone'],
    help: 'An abbreviation (EST, PST, GMT, CET) or an IANA name (Europe/London). Availability is read in this zone.',
  },
  {
    key: 'notes',
    column: 'notes',
    label: 'Availability',
    question: 'When are you generally free to play?',
    type: 'paragraph',
    required: true,
    aliases: ['availability', 'notes', 'availability notes', 'when are you free', 'free times', 'when are you generally free to play'],
    help: 'Free text. Parsed into calendar blocks — "Mon, Wed, Fri 8pm-midnight" and "weekends after 5pm" both work.',
  },
  {
    key: 'age',
    column: 'age',
    label: 'Age',
    question: 'How old are you?',
    type: 'short',
    aliases: ['age', 'how old are you'],
    help: 'Optional. Some tables group by age range.',
  },
  {
    key: 'computer_access',
    column: 'computer_access',
    label: 'Computer access',
    question: 'What will you play on?',
    type: 'choice',
    aliases: ['computer access', 'computer', 'what will you play on', 'device'],
    choices: ['Desktop or laptop', 'Tablet', 'Phone only', 'Varies'],
    help: 'A phone-only player cannot share a screen, which changes which VTT works.',
  },
  {
    key: 'pref_party_size',
    column: 'pref_party_size',
    label: 'Preferred party size',
    question: 'What party size do you prefer?',
    type: 'choice',
    aliases: ['preferred party size', 'party size', 'pref party size'],
    choices: ['2–3', '4–5', '6+', 'No preference'],
  },
  {
    key: 'pref_session_length',
    column: 'pref_session_length',
    label: 'Preferred session length',
    question: 'How long do you like sessions to run?',
    type: 'choice',
    aliases: ['preferred session length', 'session length', 'pref session length'],
    choices: ['2 hours', '3 hours', '4 hours', '4+ hours', 'No preference'],
  },
  {
    key: 'pref_vtt',
    column: 'pref_vtt',
    label: 'Preferred VTT',
    question: 'Which virtual tabletop do you prefer?',
    type: 'choice',
    aliases: ['preferred vtt', 'vtt', 'pref vtt', 'virtual tabletop'],
    choices: ['Roll20', 'Foundry VTT', 'Owlbear Rodeo', 'Theatre of the mind', 'In person', 'No preference'],
  },
  {
    key: 'pref_play_with',
    column: 'pref_play_with',
    label: 'Plays well with',
    question: 'Is there anyone you would especially like to play with?',
    type: 'short',
    aliases: ['prefer play with', 'prefer to play with', 'preferred players', 'players you prefer', 'play with'],
    help: 'Names, comma separated. Matched against the roster and used as a soft constraint by the group suggester.',
  },
  {
    key: 'pref_play_not_with',
    column: 'pref_play_not_with',
    label: 'Would rather not play with',
    question: 'Is there anyone you would rather not play with?',
    type: 'short',
    aliases: ['prefer not play with', 'prefer not to play with', 'players you prefer not to play with', 'do not play with', 'dont play with'],
    help: 'Kept private to the DM. Also a soft constraint, never a hard one.',
  },
];

/** Columns a sheet import must never write over a seat someone has already claimed. */
const IDENTITY_COLUMNS = ['name', 'discord'];

/**
 * Google Forms decorates its response headers ("Timestamp", trailing spaces, smart punctuation)
 * and DMs retype questions by hand, so headers are compared on letters and digits alone.
 */
function normaliseHeader(value) {
  return String(value ?? '')
    .toLowerCase()
    .replaceAll(/[‘’“”]/g, "'")
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Case- and punctuation-insensitive identity comparison for names and Discord handles. */
function normaliseIdentity(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/^@/, '')
    .replaceAll(/[^a-z0-9]+/g, '')
    .trim();
}

const ALIAS_LOOKUP = new Map();
for (const field of INTAKE_FIELDS) {
  for (const alias of [field.question, field.label, field.key, ...field.aliases]) {
    const normalised = normaliseHeader(alias);
    if (normalised && !ALIAS_LOOKUP.has(normalised)) ALIAS_LOOKUP.set(normalised, field.key);
  }
}

function intakeFields() {
  return INTAKE_FIELDS;
}

/**
 * Auto-maps a sheet's headers onto the schema. A header matching no field is reported rather than
 * dropped silently — a DM who renamed "What is your name?" needs to be told, not to watch the
 * import produce blank seats.
 *
 * @returns {{ mapping: Record<string,string>, unmatchedHeaders: string[], missingRequired: string[] }}
 */
function matchHeaders(headers = []) {
  const mapping = {};
  const unmatchedHeaders = [];

  for (const header of headers) {
    const key = ALIAS_LOOKUP.get(normaliseHeader(header));
    if (key && !mapping[key]) {
      mapping[key] = header;
      continue;
    }
    if (!key) unmatchedHeaders.push(header);
  }

  const missingRequired = INTAKE_FIELDS.filter((f) => f.required && !mapping[f.key]).map((f) => f.key);
  return { mapping, unmatchedHeaders, missingRequired };
}

/** Reads one field out of a row, preferring the caller's mapping and falling back to the aliases. */
function readField(row, field, mapping) {
  const mapped = mapping?.[field.key];
  if (mapped && row[mapped] !== undefined && row[mapped] !== null && String(row[mapped]).trim() !== '') {
    return String(row[mapped]).trim();
  }

  for (const candidate of Object.keys(row)) {
    if (ALIAS_LOOKUP.get(normaliseHeader(candidate)) !== field.key) continue;
    const value = row[candidate];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

function readRow(row, mapping) {
  const values = {};
  for (const field of INTAKE_FIELDS) values[field.key] = readField(row, field, mapping);
  return values;
}

/**
 * Finds the seat a row belongs to, **within the campaign only**. Discord wins over name because it
 * is the stabler handle: a player who changes their display name should update their seat, not
 * grow a second one.
 */
function findExistingSeat(values, seats) {
  const discord = normaliseIdentity(values.discord);
  if (discord) {
    const byDiscord = seats.find((seat) => normaliseIdentity(seat.discord) === discord);
    if (byDiscord) return byDiscord;
  }

  const name = normaliseIdentity(values.name);
  if (!name) return null;
  return seats.find((seat) => normaliseIdentity(seat.name) === name) ?? null;
}

/**
 * Decides what a sync would do, without doing any of it.
 *
 * The route this replaced derived a player id from the sheet's **row index** and then wrote
 * `INSERT OR REPLACE INTO players (id, ...)`. Importing a five-row sheet therefore overwrote
 * players 1–5 *in the whole database*, whichever campaigns they belonged to, and blanked columns
 * the sheet had no opinion about. Matching happens inside `seats` — the campaign's own roster —
 * and a row that matches nothing becomes a new seat with a server-assigned id.
 *
 * @param {object} input
 * @param {object[]} input.rows            parsed sheet rows
 * @param {object[]} input.seats           the campaign's current players
 * @param {Record<string,string>} [input.mapping]
 * @param {Set<number>|number[]} [input.claimedSeatIds] seats a user has claimed
 * @returns {{ creates: object[], updates: object[], skipped: object[] }}
 */
function planSheetImport({ rows = [], seats = [], mapping = null, claimedSeatIds = [] }) {
  const claimed = claimedSeatIds instanceof Set ? claimedSeatIds : new Set(claimedSeatIds);
  const creates = [];
  const updates = [];
  const skipped = [];
  // A row already matched cannot match again, or two blank-name rows both land on the same seat.
  const takenSeatIds = new Set();

  for (const [index, row] of rows.entries()) {
    const values = readRow(row, mapping);
    if (!values.name && !values.discord) {
      skipped.push({ rowIndex: index, reason: 'no_identity' });
      continue;
    }

    const candidate = findExistingSeat(values, seats.filter((seat) => !takenSeatIds.has(seat.id)));
    if (!candidate) {
      creates.push({ rowIndex: index, values });
      continue;
    }

    takenSeatIds.add(candidate.id);
    const isClaimed = claimed.has(candidate.id);
    const columns = {};
    for (const field of INTAKE_FIELDS) {
      // A blank answer means "no opinion", never "clear what is there" — the old importer wrote
      // every column on every row and wiped anything the sheet did not carry.
      if (values[field.key] === '') continue;
      // A claimed seat's owner has a name and a handle of their own; the sheet does not get to
      // rewrite who they are, only what they said about playing.
      if (isClaimed && IDENTITY_COLUMNS.includes(field.column)) continue;
      // An answer identical to what the seat already holds is not a change. Counting it as one
      // would tell a DM "4 seats updated" after a re-import that altered nothing, and re-parsing
      // availability that did not move would drop hand-edited blocks for no reason.
      if (String(candidate[field.column] ?? '') === values[field.key]) continue;
      columns[field.column] = values[field.key];
    }

    if (Object.keys(columns).length === 0) {
      skipped.push({ rowIndex: index, seatId: candidate.id, reason: 'nothing_to_update' });
      continue;
    }

    updates.push({ rowIndex: index, seatId: candidate.id, values, columns, claimed: isClaimed });
  }

  return { creates, updates, skipped };
}

module.exports = {
  INTAKE_FIELDS,
  IDENTITY_COLUMNS,
  intakeFields,
  matchHeaders,
  normaliseHeader,
  normaliseIdentity,
  readRow,
  findExistingSeat,
  planSheetImport,
};
