/** Contact form rules, shared by the browser (inline errors) and the route handler. */

export const CONTACT_ROLES = ["principal", "teacher", "other"] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

export type ContactField = "name" | "school" | "city" | "phone" | "email" | "role" | "message";

export type ContactInput = Record<ContactField, string>;
export type ContactErrors = Partial<Record<ContactField, string>>;

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

  if (name.length < 2) errors.name = "Please enter your name.";
  if (school.length < 2) errors.school = "Please enter your school's name.";
  if (city.length < 2) errors.city = "Please enter your city.";
  if (!PHONE.test(phone)) errors.phone = "Enter a 10-digit mobile number, for example 98765 43210.";
  if (!EMAIL.test(email)) errors.email = "Enter a valid email address.";
  if (!isContactRole(input.role)) errors.role = "Please choose one.";
  if (input.message.length > MESSAGE_MAX) errors.message = `Please keep it under ${MESSAGE_MAX} characters.`;
  return errors;
}
