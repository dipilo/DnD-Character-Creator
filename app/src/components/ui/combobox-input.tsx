import { useMemo, useState, type ComponentProps, type KeyboardEvent } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Splits a CSV-style value into the already-completed entries and the
// in-progress segment currently being typed (the text after the last comma).
function splitActiveSegment(value: string) {
  const segments = value.split(",")
  const active = segments[segments.length - 1]?.trimStart() ?? ""
  const completed = segments.slice(0, -1).map((segment) => segment.trim())
  return { active, completed }
}

// A suggestion that carries more than its own text: a subtitle shown under it, and the words it
// answers to besides its value (a timezone's abbreviations, say).
export interface ComboboxOption {
  readonly value: string
  readonly label?: string
  readonly description?: string
  readonly keywords?: readonly string[]
}

export type ComboboxSuggestion = string | ComboboxOption

interface ComboboxInputProps extends Readonly<Omit<ComponentProps<typeof Input>, "value" | "onChange" | "onSelect">> {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly suggestions: readonly ComboboxSuggestion[]
  // When true (default), value is treated as a comma-separated list and
  // suggestions filter/insert against the segment currently being typed.
  // When false, suggestions match and replace the entire value.
  readonly multiValue?: boolean
  readonly maxSuggestions?: number
  // Overrides the default commit behavior (CSV append / whole-value replace)
  // so a caller can treat this as a "pick to insert elsewhere" search box.
  readonly onSelect?: (value: string) => void
}

export function ComboboxInput({
  value,
  onChange,
  suggestions,
  multiValue = true,
  maxSuggestions = 8,
  className,
  onFocus,
  onBlur,
  onKeyDown,
  onSelect,
  ...inputProps
}: ComboboxInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const options = useMemo(
    () =>
      suggestions.map((suggestion) => {
        const option = typeof suggestion === "string" ? { value: suggestion } : suggestion;
        const searchable = [option.value, option.label, option.description, ...(option.keywords ?? [])];
        return { ...option, haystack: searchable.filter(Boolean).join(" ").toLowerCase() };
      }),
    [suggestions],
  );

  const { active, completed } = useMemo(() => (multiValue ? splitActiveSegment(value) : { active: value, completed: [] }), [value, multiValue]);

  const alreadyChosen = useMemo(() => new Set(completed.map((entry) => entry.toLowerCase())), [completed]);

  const filteredSuggestions = useMemo(() => {
    const query = active.trim().toLowerCase();
    return options
      .filter((option) => !alreadyChosen.has(option.value.toLowerCase()))
      .filter((option) => query.length === 0 || option.haystack.includes(query))
      .slice(0, maxSuggestions);
  }, [options, active, alreadyChosen, maxSuggestions]);

  const showDropdown = isOpen && filteredSuggestions.length > 0;

  const commitSuggestion = ({ value: option }: ComboboxOption) => {
    if (onSelect) {
      onSelect(option);
    } else if (multiValue) {
      onChange(`${[...completed, option].join(", ")}, `);
    } else {
      onChange(option);
    }
    setIsOpen(false);
    setHighlightedIndex(0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !showDropdown) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) => (current + 1) % filteredSuggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) => (current - 1 + filteredSuggestions.length) % filteredSuggestions.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      commitSuggestion(filteredSuggestions[highlightedIndex]);
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <Input
        {...inputProps}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
          setHighlightedIndex(0);
        }}
        onFocus={(event) => {
          setIsOpen(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsOpen(false);
          onBlur?.(event);
        }}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
        autoComplete="off"
        className={className}
      />
      {showDropdown ? (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-input bg-popover p-1 text-popover-foreground shadow-md">
          {filteredSuggestions.map((option, index) => {
            const isHighlighted = index === highlightedIndex;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-sm px-2 py-1.5 text-left text-sm",
                    isHighlighted ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => commitSuggestion(option)}
                >
                  {option.label ?? option.value}
                  {option.description ? (
                    <span className="block text-xs text-muted-foreground">{option.description}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
