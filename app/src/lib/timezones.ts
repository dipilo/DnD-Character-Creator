/**
 * The timezone picker's data. A zone is stored as its IANA id, but nobody thinks in those: they
 * think in "CST" and "six hours behind", so every option carries its current UTC offset and both
 * of its abbreviations as search keywords.
 *
 * Abbreviations are read from the platform rather than tabulated — `Intl` names the zone in
 * January and in July, which is what separates EST from EDT without a hardcoded list.
 */

/** A zone as the combobox shows it: the id, its offset line, and everything it answers to. */
export interface TimeZoneOption {
  value: string;
  description: string;
  keywords: string[];
}

/** Enough to pick from when `Intl.supportedValuesOf` is missing; everything else is free text. */
const FALLBACK_ZONES = [
  'UTC', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Berlin', 'Europe/Moscow', 'Asia/Kolkata',
  'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland',
];

function listTimeZones(): string[] {
  const withValues = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  try {
    const zones = withValues.supportedValuesOf?.('timeZone');
    if (zones && zones.length > 0) return zones;
  } catch (e) {
    console.warn('could not list time zones', e instanceof Error ? e.message : e);
  }
  return FALLBACK_ZONES;
}

/** The zone this device is set to, and the one a new seat starts on. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch (e) {
    console.warn('could not read the browser time zone', e instanceof Error ? e.message : e);
    return '';
  }
}

function timeZonePart(zone: string, at: Date, name: 'short' | 'shortOffset'): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: name }).formatToParts(at);
    return parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
  } catch (e) {
    console.warn('could not format time zone', zone, e instanceof Error ? e.message : e);
    return '';
  }
}

const offsetPattern = /GMT([+-])(\d{1,2})(?::(\d{2}))?/;

/** Minutes east of UTC at `at`, or null when the platform will not say. */
export function timeZoneOffsetMinutes(zone: string, at: Date): number | null {
  const raw = timeZonePart(zone, at, 'shortOffset');
  if (!raw) return null;
  if (raw === 'GMT') return 0;
  const match = offsetPattern.exec(raw);
  if (!match) return null;
  const minutes = Number.parseInt(match[2], 10) * 60 + Number.parseInt(match[3] ?? '0', 10);
  return match[1] === '-' ? -minutes : minutes;
}

export function formatUtcOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const total = Math.abs(minutes);
  const hours = String(Math.floor(total / 60)).padStart(2, '0');
  return `UTC${sign}${hours}:${String(total % 60).padStart(2, '0')}`;
}

/** "CST" and friends. A zone with no name of its own is reported as "GMT+8", which is not one. */
function abbreviation(zone: string, at: Date): string | null {
  const raw = timeZonePart(zone, at, 'short');
  return /^[A-Z]{2,5}$/.test(raw) ? raw : null;
}

/** The words a zone answers to besides its id: its two abbreviations, its offset, its place name. */
function keywordsFor(zone: string, abbreviations: string[], offset: string): string[] {
  const place = zone.split('/').flatMap((segment) => segment.split('_'));
  return [...new Set([...abbreviations, offset, offset.replace('UTC', 'GMT'), ...place])];
}

/**
 * One line under the id: what the zone is offset by right now, and what it is called. Winter and
 * summer names are both shown when they differ, so a search for either one reads as a match.
 */
function describe(offset: string, abbreviations: string[]): string {
  return abbreviations.length > 0 ? `${offset} \u00b7 ${abbreviations.join(' / ')}` : offset;
}

/**
 * Every zone the platform knows, sorted west to east and labelled with its offset. Reads the clock
 * once — offsets are seasonal, so the caller decides when that is (a `useMemo`, never a render).
 */
export function timeZoneOptions(now: Date = new Date()): TimeZoneOption[] {
  const year = now.getUTCFullYear();
  const january = new Date(Date.UTC(year, 0, 15));
  const july = new Date(Date.UTC(year, 6, 15));

  const ranked = listTimeZones().map((zone) => {
    const minutes = timeZoneOffsetMinutes(zone, now) ?? 0;
    const offset = formatUtcOffset(minutes);
    const abbreviations = [...new Set([abbreviation(zone, january), abbreviation(zone, july)])]
      .filter((name): name is string => Boolean(name));
    return {
      minutes,
      option: {
        value: zone,
        description: describe(offset, abbreviations),
        keywords: keywordsFor(zone, abbreviations, offset),
      },
    };
  });

  ranked.sort((a, b) => a.minutes - b.minutes || a.option.value.localeCompare(b.option.value));
  return ranked.map((entry) => entry.option);
}

/** "America/Chicago (UTC-05:00)" for read-only display; the bare id when it cannot be resolved. */
export function describeTimeZone(zone: string | null | undefined, now: Date = new Date()): string | null {
  if (!zone) return null;
  const minutes = timeZoneOffsetMinutes(zone, now);
  return minutes === null ? zone : `${zone} (${formatUtcOffset(minutes)})`;
}
