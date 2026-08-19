import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type KeyboardEvent } from "react"
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

/** Below this the list is not worth showing on the near side; flip to the other one instead. */
const MIN_LIST_HEIGHT = 120
const MAX_LIST_HEIGHT = 224
const LIST_GAP = 8

interface ListPlacement {
  readonly above: boolean
  readonly maxHeight: number
}

const DEFAULT_PLACEMENT: ListPlacement = { above: false, maxHeight: MAX_LIST_HEIGHT }

/**
 * Where the suggestion list fits, read from the *visual* viewport — the one an on-screen keyboard
 * shrinks. Sizing it to a constant put most of the list behind the keyboard on a phone, which
 * reads as a list that cannot be scrolled rather than one that was never on screen.
 */
function placementFor(anchor: HTMLElement | null): ListPlacement {
  if (!anchor) return DEFAULT_PLACEMENT
  const rect = anchor.getBoundingClientRect()
  const viewport = window.visualViewport
  const top = viewport?.offsetTop ?? 0
  const bottom = top + (viewport?.height ?? window.innerHeight)
  const room = { below: bottom - rect.bottom - LIST_GAP, above: rect.top - top - LIST_GAP }
  const above = room.below < MIN_LIST_HEIGHT && room.above > room.below
  const available = above ? room.above : room.below
  return { above, maxHeight: Math.max(MIN_LIST_HEIGHT, Math.min(MAX_LIST_HEIGHT, Math.round(available))) }
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
  const [placement, setPlacement] = useState<ListPlacement>(DEFAULT_PLACEMENT)
  const anchorRef = useRef<HTMLDivElement>(null)

  const measure = useCallback(() => {
    const next = placementFor(anchorRef.current)
    setPlacement((current) =>
      current.above === next.above && current.maxHeight === next.maxHeight ? current : next,
    )
  }, [])

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

  // The keyboard opens *after* the focus that opened the list, so the measurement that matters
  // arrives as a visualViewport resize. Subscribing only — nothing is set from the effect body.
  useEffect(() => {
    if (!showDropdown) return;
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", measure);
    viewport?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      viewport?.removeEventListener("resize", measure);
      viewport?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [showDropdown, measure]);

  const openList = () => {
    setIsOpen(true);
    setHighlightedIndex(0);
    measure();
  };

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
    <div className="relative" ref={anchorRef}>
      <Input
        {...inputProps}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          openList();
        }}
        onFocus={(event) => {
          openList();
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
        <ul
          // `touch-action` and the contained overscroll keep a drag on the list scrolling the list,
          // rather than handing the gesture to the dialog or the page behind it.
          style={{ maxHeight: placement.maxHeight }}
          className={cn(
            "absolute z-50 w-full touch-pan-y overscroll-contain overflow-y-auto rounded-md border border-input bg-popover p-1 text-popover-foreground shadow-md",
            placement.above ? "bottom-full mb-1" : "top-full mt-1",
          )}
        >
          {filteredSuggestions.map((option, index) => {
            const isHighlighted = index === highlightedIndex;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full flex-col justify-center rounded-sm px-2 py-1.5 text-left text-sm coarse:min-h-11",
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
