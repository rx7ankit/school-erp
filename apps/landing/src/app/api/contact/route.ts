import { NextResponse } from "next/server";
import { validateContact, type ContactInput } from "@/lib/contact";

const KEYS = ["name", "school", "city", "phone", "email", "role", "message"] as const;

function parse(body: unknown): (ContactInput & { website: string }) | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  const out: ContactInput & { website: string } = {
    name: "",
    school: "",
    city: "",
    phone: "",
    email: "",
    role: "",
    message: "",
    website: typeof record.website === "string" ? record.website : "",
  };
  for (const key of KEYS) {
    const value = record[key];
    if (typeof value === "string") out[key] = value;
    else if (value !== undefined) return null;
  }
  return out;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: {} }, { status: 400 });
  }

  const input = parse(body);
  if (!input) return NextResponse.json({ ok: false, errors: {} }, { status: 400 });

  // Honeypot filled in: pretend success so bots learn nothing, and drop it.
  if (input.website.trim() !== "") return NextResponse.json({ ok: true });

  const errors = validateContact(input);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 400 });
  }

  // TODO: forward this enquiry to the Slov backend / email inbox. Until that is wired up
  // it is only logged on the server, so enquiries are NOT stored or emailed anywhere yet.
  console.log("[contact] new demo request", {
    receivedAt: new Date().toISOString(),
    name: input.name.trim(),
    school: input.school.trim(),
    city: input.city.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    role: input.role,
    message: input.message.trim(),
  });

  return NextResponse.json({ ok: true });
}
