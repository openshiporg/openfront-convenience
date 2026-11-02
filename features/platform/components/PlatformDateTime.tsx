"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PlatformSelect, RequiredProxy } from "./PlatformSelect";
import { dateKey, formatDateKey, parseDateKey, splitLocalDateTime, timeOptions } from "../lib/date-fields";

type Aria = { "aria-invalid"?: boolean; "aria-describedby"?: string; "aria-label"?: string };

/**
 * Date field ("yyyy-MM-dd" string, like <input type="date">) that opens the Calendar in a popover.
 * `name` submits it with a GET/POST form through a hidden input.
 */
export function PlatformDateInput({
  id,
  name,
  value,
  defaultValue = "",
  onChange,
  disabled = false,
  placeholder = "Pick a date",
  clearable = true,
  required = false,
  className,
  ...aria
}: {
  required?: boolean;
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  clearable?: boolean;
  className?: string;
} & Aria) {
  const [inner, setInner] = React.useState(defaultValue);
  const current = value ?? inner;
  const [open, setOpen] = React.useState(false);
  const selected = parseDateKey(current);
  function set(next: string) {
    if (value === undefined) setInner(next);
    onChange?.(next);
  }
  return (
    <>
      {name ? <input type="hidden" name={name} value={current} /> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          <button
            type="button"
            id={id}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={aria["aria-label"]}
            aria-invalid={aria["aria-invalid"] || undefined}
            aria-describedby={aria["aria-describedby"]}
            className={cn(
              "flex h-10 w-full min-w-0 items-center gap-2 rounded-[6px] border border-input bg-background px-3 text-left text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive",
              className,
            )}
          >
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className={cn("min-w-0 truncate tabular-nums", !selected && "text-muted-foreground")}>{selected ? formatDateKey(current) : placeholder}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={4} collisionPadding={12} className="w-auto rounded-[6px] p-2">
          <Calendar
            mode="single"
            selected={selected ?? undefined}
            defaultMonth={selected ?? undefined}
            onSelect={(day) => { set(day ? dateKey(day) : ""); setOpen(false); }}
            autoFocus
          />
          {clearable && current ? (
            <div className="flex justify-end border-t px-1 pt-2">
              <button type="button" className="min-h-9 rounded-[6px] px-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => { set(""); setOpen(false); }}>Clear</button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
      {required ? <RequiredProxy value={current} disabled={disabled} onInvalid={() => setOpen(true)} /> : null}
    </>
  );
}

/** Time-of-day field ("HH:mm") as a searchable popover list in `step`-minute increments. */
export function PlatformTimeInput({
  id,
  value,
  onChange,
  disabled = false,
  step = 15,
  placeholder = "Time",
  className,
  ...aria
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  step?: number;
  placeholder?: string;
  className?: string;
} & Aria) {
  const options = React.useMemo(() => timeOptions(step, value), [step, value]);
  return <PlatformSelect id={id} options={options} value={value} onValueChange={onChange} disabled={disabled} placeholder={placeholder} searchable className={className} {...aria} />;
}

/**
 * Date and time field producing the same "yyyy-MM-ddTHH:mm" string as <input type="datetime-local">.
 * Choosing a date first fills `defaultTime` so the value is complete; both halves stay editable.
 */
export function PlatformDateTimeInput({
  id,
  value,
  onChange,
  disabled = false,
  defaultTime = "09:00",
  className,
  ...aria
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  defaultTime?: string;
  className?: string;
} & Aria) {
  const { date, time } = splitLocalDateTime(value);
  return (
    <div className={cn("grid min-w-0 grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2", className)}>
      <PlatformDateInput
        id={id}
        value={date}
        disabled={disabled}
        onChange={(nextDate) => onChange(nextDate ? `${nextDate}T${time || defaultTime}` : "")}
        aria-label={aria["aria-label"] ? `${aria["aria-label"]} date` : undefined}
        aria-invalid={aria["aria-invalid"]}
        aria-describedby={aria["aria-describedby"]}
      />
      <PlatformTimeInput
        value={time}
        disabled={disabled || !date}
        onChange={(nextTime) => onChange(date ? `${date}T${nextTime}` : "")}
        aria-label={aria["aria-label"] ? `${aria["aria-label"]} time` : "Time"}
        aria-invalid={aria["aria-invalid"]}
      />
    </div>
  );
}

/** Form version of PlatformDateTimeInput: uncontrolled, submitted under `name` like <input type="datetime-local">. */
export function PlatformDateTimeField({
  name,
  defaultValue = "",
  required = false,
  disabled = false,
  className,
  ...aria
}: { name: string; defaultValue?: string; required?: boolean; disabled?: boolean; className?: string } & Aria) {
  const [value, setValue] = React.useState(defaultValue);
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <PlatformDateTimeInput value={value} onChange={setValue} disabled={disabled} className={className} {...aria} />
      {required ? <RequiredProxy value={value} disabled={disabled} /> : null}
    </>
  );
}
