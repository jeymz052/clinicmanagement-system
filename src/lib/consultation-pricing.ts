function parseClockToMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

export function getAppointmentDurationMinutes(start: string, end: string) {
  return Math.max(0, parseClockToMinutes(end) - parseClockToMinutes(start));
}

export function getAppointmentDurationHours(start: string, end: string) {
  return getAppointmentDurationMinutes(start, end) / 60;
}

export function calculateConsultationCharge(hourlyRate: number, start: string, end: string) {
  const hours = getAppointmentDurationHours(start, end);
  return Math.round(hourlyRate * hours * 100) / 100;
}

export function formatDurationLabel(start: string, end: string) {
  const hours = getAppointmentDurationHours(start, end);
  if (Number.isInteger(hours)) {
    return `${hours} hr${hours === 1 ? "" : "s"}`;
  }
  return `${hours.toFixed(2).replace(/\.?0+$/, "")} hrs`;
}
