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

/** Searched by abbreviation and offset too; free text still saves, to be surfaced not refused. */
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
