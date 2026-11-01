/** Contact form rules, shared by the browser (inline errors) and the route handler. */

export const CONTACT_ROLES = ["principal", "teacher", "other"] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

export type ContactField = "name" | "school" | "city" | "phone" | "email" | "role" | "message";

export type ContactInput = Record<ContactField, string>;
/** A field is listed (true) when invalid. The message text comes from the language dictionary. */
export type ContactErrors = Partial<Record<ContactField, true>>;

export const MESSAGE_MAX = 1000;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Indian mobile: optional +91 / 91 / 0, then 10 digits starting 6-9.
const PHONE = /^(?:\+?91|0)?[6-9]\d{9}$/;

export function isContactRole(value: string): value is ContactRole {
  return (CONTACT_ROLES as readonly string[]).includes(value);
}

export function validateContact(input: ContactInput): ContactErrors {
  const errors: ContactErrors = {};
  const name = input.name.trim();
  const school = input.school.trim();
  const city = input.city.trim();
  const phone = input.phone.replace(/[\s-]/g, "");
  const email = input.email.trim();

  if (name.length < 2) errors.name = true;
  if (school.length < 2) errors.school = true;
  if (city.length < 2) errors.city = true;
  if (!PHONE.test(phone)) errors.phone = true;
  if (!EMAIL.test(email)) errors.email = true;
  if (!isContactRole(input.role)) errors.role = true;
  if (input.message.length > MESSAGE_MAX) errors.message = true;
  return errors;
}
