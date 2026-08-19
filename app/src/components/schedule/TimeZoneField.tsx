import { useMemo } from 'react';
import { ComboboxInput, type ComboboxSuggestion } from '@/components/ui/combobox-input';
import { timeZoneOptions } from '@/lib/timezones';

interface TimeZoneFieldProps {
  readonly id: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  /** The scheduler's view picker also accepts `local`, which means "whatever this device is set to". */
  readonly allowLocal?: boolean;
}

const LOCAL_OPTION: ComboboxSuggestion = {
  value: 'local',
  description: 'Whatever this device is set to',
  keywords: ['device', 'browser', 'here'],
};

/**
 * Pick an IANA zone by the name people actually use for it. The list is searched by abbreviation
 * and offset as well as by id, so "CST", "-06" and "Chicago" all reach America/Chicago, and the
 * offset is shown under each option because the id alone does not say what it means.
 *
 * Free text still saves: the server stores whatever it is given, and an unrecognised zone is a
 * problem to surface rather than a value to refuse mid-typing.
 */
export function TimeZoneField({ id, value, onChange, placeholder, allowLocal = false }: TimeZoneFieldProps) {
  // Offsets are seasonal, so the clock is read once per mount rather than during a render.
  const options = useMemo(() => {
    const zones = timeZoneOptions();
    return allowLocal ? [LOCAL_OPTION, ...zones] : zones;
  }, [allowLocal]);

  return (
    <ComboboxInput
      id={id}
      value={value}
      onChange={onChange}
      suggestions={options}
      multiValue={false}
      maxSuggestions={10}
      placeholder={placeholder}
    />
  );
}
