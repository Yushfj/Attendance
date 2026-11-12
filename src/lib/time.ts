/** Default site timezone — Philippines local time (UTC+8). */
export const DEFAULT_TIMEZONE = "Asia/Manila";

export function resolveTimezone(timezone?: string | null) {
  return timezone?.trim() || DEFAULT_TIMEZONE;
}

export function formatInTimezone(
  isoOrDate: string | Date,
  timeZone: string = DEFAULT_TIMEZONE,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: resolveTimezone(timeZone),
    ...options,
  }).format(date);
}

export function formatDateTimeLocal(
  isoOrDate: string | Date,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  return formatInTimezone(isoOrDate, timeZone, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function formatTimeLocal(
  isoOrDate: string | Date,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  return formatInTimezone(isoOrDate, timeZone, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function formatDateLocal(
  isoOrDate: string | Date,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  return formatInTimezone(isoOrDate, timeZone, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Wall-clock time in the site timezone (for CSV / exports). */
export function formatExportLocal(
  isoOrDate: string | Date,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  return formatInTimezone(isoOrDate, timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
