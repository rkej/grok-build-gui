const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: "auto", style: "narrow" });

export function formatRelativeTime(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Recently";

  const seconds = Math.round((timestamp - Date.now()) / 1_000);
  const absoluteSeconds = Math.abs(seconds);
  if (absoluteSeconds < 60) return relativeTime.format(seconds, "second");

  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, "minute");

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeTime.format(hours, "hour");

  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return relativeTime.format(days, "day");

  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(timestamp);
}

export function formatMessageTimestamp(at: number, now = Date.now()): string {
  if (!Number.isFinite(at) || at <= 0) return "";
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "";

  const current = new Date(now);
  const sameDay = date.toDateString() === current.toDateString();
  const sameYear = date.getFullYear() === current.getFullYear();
  if (sameDay) {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
