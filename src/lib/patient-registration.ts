export const GENDER_OPTIONS = ["Male", "Female", "Other"] as const;

export type PatientGender = (typeof GENDER_OPTIONS)[number];

export type PatientRegistrationFields = {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
};

export type PatientSignupFields = PatientRegistrationFields & {
  password: string;
};

export function patientRecordToRegistrationFields(fields: PatientRegistrationFields) {
  return normalizePatientRegistrationFields(fields);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FULL_NAME_RE = /^[A-Za-z][A-Za-z\s'.-]{1,79}$/;
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const GENERIC_INTL_PHONE_RE = /^\+\d{8,15}$/;
const PH_MOBILE_RE = /^(?:\+639\d{9}|09\d{9}|9\d{9})$/;

function normalizePhone(raw: string) {
  return raw.replace(/[\s()-]/g, "");
}

function isValidDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isFutureDate(value: string) {
  const today = new Date();
  const currentDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const parsed = new Date(`${value}T00:00:00Z`);
  return parsed.getTime() > currentDay.getTime();
}

export function normalizePatientRegistrationFields(
  fields: PatientRegistrationFields,
): PatientRegistrationFields {
  return {
    fullName: fields.fullName.trim(),
    email: fields.email.trim().toLowerCase(),
    phone: fields.phone.trim(),
    dateOfBirth: fields.dateOfBirth.trim(),
    gender: fields.gender.trim(),
    address: fields.address.trim(),
  };
}

export function validatePatientRegistrationFields(fields: PatientRegistrationFields) {
  const normalized = normalizePatientRegistrationFields(fields);

  if (normalized.fullName.length < 2) {
    return "Full name must be at least 2 characters.";
  }
  if (!FULL_NAME_RE.test(normalized.fullName)) {
    return "Full name may only contain letters, spaces, apostrophes, dots, and hyphens.";
  }
  if (!EMAIL_RE.test(normalized.email)) {
    return "Please enter a valid email address.";
  }
  const normalizedPhone = normalizePhone(normalized.phone);
  if (!PH_MOBILE_RE.test(normalizedPhone) && !GENERIC_INTL_PHONE_RE.test(normalizedPhone)) {
    return "Enter a valid phone number (PH: +639XXXXXXXXX or 09XXXXXXXXX, or other country format with + and country code).";
  }
  if (!isValidDateOnly(normalized.dateOfBirth)) {
    return "Date of birth is required.";
  }
  if (isFutureDate(normalized.dateOfBirth)) {
    return "Date of birth cannot be in the future.";
  }
  if (!GENDER_OPTIONS.includes(normalized.gender as PatientGender)) {
    return "Please select a valid gender.";
  }
  if (normalized.address.length < 8) {
    return "Address must be at least 8 characters.";
  }
  return null;
}

export function validatePatientSignupFields(fields: PatientSignupFields) {
  const registrationError = validatePatientRegistrationFields(fields);
  if (registrationError) return registrationError;

  if (fields.password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (!PASSWORD_RE.test(fields.password)) {
    return "Password must include uppercase, lowercase, number, and special character.";
  }

  return null;
}
