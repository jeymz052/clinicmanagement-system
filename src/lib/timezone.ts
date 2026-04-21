const DEFAULT_CLINIC_TIME_ZONE = "Asia/Manila";

export const CLINIC_TIME_ZONE =
  process.env.NEXT_PUBLIC_CLINIC_TIME_ZONE ??
  process.env.CLINIC_TIME_ZONE ??
  DEFAULT_CLINIC_TIME_ZONE;

function getFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

function readParts(date: Date, timeZone: string) {
  const parts = getFormatter(timeZone).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = lookup.year ?? "0000";
  const month = lookup.month ?? "01";
  const day = lookup.day ?? "01";
  const hour = lookup.hour ?? "00";
  const minute = lookup.minute ?? "00";
  const second = lookup.second ?? "00";

  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}:${second}`,
  };
}

export function normalizeClockTime(time: string) {
  return time.length === 5 ? `${time}:00` : time;
}

export function getClinicNow() {
  return readParts(new Date(), CLINIC_TIME_ZONE);
}

export function getClinicToday() {
  return getClinicNow().date;
}

export function isPastInClinicTime(date: string, startTime: string) {
  const now = getClinicNow();
  const normalizedTime = normalizeClockTime(startTime);

  if (date < now.date) return true;
  if (date > now.date) return false;
  return normalizedTime < now.time;
}
