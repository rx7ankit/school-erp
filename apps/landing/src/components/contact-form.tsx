"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CheckIcon } from "@/components/icons";
import {
  MESSAGE_MAX,
  validateContact,
  type ContactErrors,
  type ContactField,
  type ContactInput,
} from "@/lib/contact";
import { cn } from "@/lib/cn";
import { CONTACT as t } from "@/lib/content";

type Status = "idle" | "loading" | "success" | "error";

const FIELD_ORDER: readonly ContactField[] = ["name", "school", "city", "phone", "email", "role", "message"];

const control =
  "w-full min-w-0 rounded-[14px] border-0 bg-[#F3F3F6] px-4 text-[16px] text-text placeholder:text-text-tertiary focus-visible:bg-[#ECECF0] aria-[invalid=true]:bg-danger/10";

type FieldProps = {
  name: ContactField;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
};

function Field({ name, label, error, hint, className, children }: FieldProps) {
  const id = `contact-${name}`;
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-[14px] font-semibold text-text">
        {label}
      </label>
      {children({ id, describedBy: ids || undefined, invalid: Boolean(error) })}
      {hint && !error ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-text-secondary">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function readForm(form: HTMLFormElement): ContactInput {
  const data = new FormData(form);
  const get = (key: ContactField) => String(data.get(key) ?? "");
  return {
    name: get("name"),
    school: get("school"),
    city: get("city"),
    phone: get("phone"),
    email: get("email"),
    role: get("role"),
    message: get("message"),
  };
}

export function ContactForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<ContactErrors>({});

  function clearError(field: ContactField) {
    setErrors((current) => {
      if (!current[field]) return current;
      const { [field]: _removed, ...rest } = current;
      void _removed;
      return rest;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = readForm(form);
    const found = validateContact(values);
    setErrors(found);

    const firstBad = FIELD_ORDER.find((field) => found[field]);
    if (firstBad) {
      form.querySelector<HTMLElement>(`#contact-${firstBad}`)?.focus();
      return;
    }

    setStatus("loading");
    try {
      const honeypot = String(new FormData(form).get("website") ?? "");
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, website: honeypot }),
      });
      const result: { ok?: boolean; errors?: ContactErrors } = await response.json();
      if (response.ok && result.ok) {
        setStatus("success");
        return;
      }
      if (result.errors) setErrors(result.errors);
      setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div role="status" className="flex flex-col items-start gap-5 rounded-[32px] bg-bg p-8 sm:p-10">
        <span className="grid size-12 place-items-center rounded-full bg-success text-[#fff]">
          <CheckIcon className="size-6" />
        </span>
        <h3 className="text-[28px] font-bold leading-tight tracking-[-0.02em]">{t.thanksTitle}</h3>
        <p className="max-w-md text-[17px] leading-[1.5] text-text-secondary">{t.thanksLine}</p>
        <Button
          variant="secondary"
          onClick={() => {
            setStatus("idle");
            setErrors({});
          }}
        >
          {t.another}
        </Button>
      </div>
    );
  }

  const loading = status === "loading";

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="rounded-[32px] border border-[#ECECF0] bg-[linear-gradient(180deg,#FFFFFF,#FAFAFB)] p-6 sm:p-10">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="name" label={t.labels.name} error={errors.name ? t.errors.name : undefined}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              name="name"
              type="text"
              autoComplete="name"
              aria-invalid={invalid}
              aria-describedby={describedBy}
              onChange={() => clearError("name")}
              className={cn(control, "h-12")}
            />
          )}
        </Field>
        <Field name="school" label={t.labels.school} error={errors.school ? t.errors.school : undefined}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              name="school"
              type="text"
              autoComplete="organization"
              aria-invalid={invalid}
              aria-describedby={describedBy}
              onChange={() => clearError("school")}
              className={cn(control, "h-12")}
            />
          )}
        </Field>
        <Field name="city" label={t.labels.city} error={errors.city ? t.errors.city : undefined}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              name="city"
              type="text"
              autoComplete="address-level2"
              aria-invalid={invalid}
              aria-describedby={describedBy}
              onChange={() => clearError("city")}
              className={cn(control, "h-12")}
            />
          )}
        </Field>
        <Field name="phone" label={t.labels.phone} error={errors.phone ? t.errors.phone : undefined}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              aria-invalid={invalid}
              aria-describedby={describedBy}
              onChange={() => clearError("phone")}
              className={cn(control, "h-12")}
            />
          )}
        </Field>
        <Field name="email" label={t.labels.email} error={errors.email ? t.errors.email : undefined}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              name="email"
              type="email"
              autoComplete="email"
              aria-invalid={invalid}
              aria-describedby={describedBy}
              onChange={() => clearError("email")}
              className={cn(control, "h-12")}
            />
          )}
        </Field>
        <Field name="role" label={t.labels.role} error={errors.role ? t.errors.role : undefined}>
          {({ id, describedBy, invalid }) => (
            <div className="relative">
              <select
                id={id}
                name="role"
                defaultValue=""
                aria-invalid={invalid}
                aria-describedby={describedBy}
                onChange={() => clearError("role")}
                className={cn(control, "h-12 appearance-none pr-10")}
              >
                <option value="" disabled>
                  {t.choose}
                </option>
                <option value="principal">{t.roles.principal}</option>
                <option value="teacher">{t.roles.teacher}</option>
                <option value="other">{t.roles.other}</option>
              </select>
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          )}
        </Field>
        <Field name="message" label={t.labels.message} error={errors.message ? t.errors.message : undefined} className="sm:col-span-2">
          {({ id, describedBy, invalid }) => (
            <textarea
              id={id}
              name="message"
              rows={4}
              maxLength={MESSAGE_MAX + 200}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              onChange={() => clearError("message")}
              className={cn(control, "resize-y py-3")}
            />
          )}
        </Field>
        {/* Honeypot for bots. Hidden from people and assistive tech. */}
        <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
          <label>
            Website
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
      </div>

      {status === "error" ? (
        <p role="alert" className="mt-5 rounded-[14px] bg-danger/10 px-4 py-3 text-[14px] font-medium text-danger">
          {t.failed}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button type="submit" variant="accent" size="lg" loading={loading} className="w-full sm:w-auto">
          {loading ? t.sending : t.submit}
        </Button>
        <p className="text-[14px] text-text-secondary">{t.goal}</p>
      </div>
    </form>
  );
}
