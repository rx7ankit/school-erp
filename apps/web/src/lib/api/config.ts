/**
 * Live mode talks to the real API. Without NEXT_PUBLIC_API_URL the app runs on demo data, as before.
 *   NEXT_PUBLIC_API_URL  where the browser reaches the API, e.g. http://localhost:8000
 *   API_URL              where the web server reaches it (login and refresh run on the server), defaults to the same
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
export const isLive = API_URL !== "";
export const API_BASE = `${API_URL}/api/v1`;
