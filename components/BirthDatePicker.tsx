"use client";

import { DatePicker, Flex, NativeSelect, parseDate, Portal, useDatePickerContext, type DateValue } from "@chakra-ui/react";
import { CalendarDays } from "lucide-react";

const pad = (n: number) => String(n).padStart(2, "0");

// Always day / month / year, whatever the language: that is how dates are written in Burundi.
const toText = (d: DateValue) => `${pad(d.day)}/${pad(d.month)}/${d.year}`;

// "5/3/2010", "05-03-2010", "05.03.2010" → 2010-03-05. Not a real day (31/02) → nothing.
function fromText(text: string): DateValue | undefined {
  const m = text.trim().match(/^(\d{1,2})\s*[/.\- ]\s*(\d{1,2})\s*[/.\- ]\s*(\d{4})$/);
  if (!m) return undefined;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  try {
    const value = parseDate(`${year}-${pad(month)}-${pad(day)}`);
    return value.day === day && value.month === month ? value : undefined;
  } catch {
    return undefined;
  }
}

const safeParse = (iso: string) => {
  try {
    return iso ? parseDate(iso) : undefined;
  } catch {
    return undefined;
  }
};

// A date of birth: type it (DD/MM/YYYY) or pick it in a calendar that jumps to any month and
// year from two dropdowns, so nobody has to click back twenty years. `value` is "YYYY-MM-DD" or "".
export function BirthDatePicker({
  value,
  onChange,
  min,
  max,
  locale,
  placeholder,
  labels,
}: {
  value: string;
  onChange: (iso: string) => void;
  min: string;
  max: string;
  locale: string;
  placeholder: string;
  labels: { openCalendar: string; month: string; year: string };
}) {
  const current = safeParse(value);
  const minDate = safeParse(min);
  const maxDate = safeParse(max);
  // With no date yet, open on a typical participant's birth year rather than this month.
  const typical = maxDate?.subtract({ years: 15 });
  const start = typical && minDate && typical.compare(minDate) < 0 ? minDate : typical;

  return (
    <DatePicker.Root
      value={current ? [current] : []}
      onValueChange={(e) => onChange(e.value[0] ? e.value[0].toString().slice(0, 10) : "")}
      min={minDate}
      max={maxDate}
      defaultFocusedValue={start}
      locale={locale}
      format={toText}
      parse={fromText}
      placeholder={placeholder}
      minView="day"
      maxView="day"
      fixedWeeks
      openOnClick
      positioning={{ placement: "bottom-start" }}
    >
      <DatePicker.Control>
        <DatePicker.Input inputMode="numeric" autoComplete="bday" />
        <DatePicker.IndicatorGroup>
          <DatePicker.Trigger aria-label={labels.openCalendar}>
            <CalendarDays />
          </DatePicker.Trigger>
        </DatePicker.IndicatorGroup>
      </DatePicker.Control>
      <Portal>
        <DatePicker.Positioner>
          <DatePicker.Content minW="18rem">
            <DatePicker.View view="day">
              <MonthYearHeader labels={labels} />
              <DatePicker.DayTable />
            </DatePicker.View>
          </DatePicker.Content>
        </DatePicker.Positioner>
      </Portal>
    </DatePicker.Root>
  );
}

// ‹  [March ▾] [2010 ▾]  ›
function MonthYearHeader({ labels }: { labels: { month: string; year: string } }) {
  const picker = useDatePickerContext();
  const focused = picker.focusedValue;
  // Most recent years first: most participants are young.
  const years = [...picker.getYears()].reverse();

  return (
    <DatePicker.ViewControl>
      <DatePicker.PrevTrigger />
      <Flex gap="2" flex="1" justify="center">
        <NativeSelect.Root size="sm" flex="1.4">
          <NativeSelect.Field
            aria-label={labels.month}
            value={focused.month}
            onChange={(e) => picker.focusMonth(Number(e.currentTarget.value))}
          >
            {picker.getMonths({ format: "long" }).map((m) => (
              <option key={m.value} value={m.value} disabled={m.disabled}>
                {m.label}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <NativeSelect.Root size="sm" flex="1">
          <NativeSelect.Field
            aria-label={labels.year}
            value={focused.year}
            onChange={(e) => picker.focusYear(Number(e.currentTarget.value))}
          >
            {years.map((y) => (
              <option key={y.value} value={y.value} disabled={y.disabled}>
                {y.label}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Flex>
      <DatePicker.NextTrigger />
    </DatePicker.ViewControl>
  );
}
