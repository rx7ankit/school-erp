import { isLive } from "./api/config";

/**
 * Which parts of the app are connected to the real API. While we connect the modules one by one, live mode only
 * shows what really works, so nothing on screen is made-up data. Demo mode (no API configured) shows everything.
 * Add a route here the day its API module is connected.
 */
const CONNECTED = ["/dashboard", "/staff", "/academic", "/audit", "/owner", "/fees", "/results", "/feedback", "/analytics", "/messages", "/attendance", "/leave", "/timetable", "/students", "/parents", "/classes", "/promotion", "/parent"];

export const isConnected = (href: string) => !isLive || CONNECTED.some((p) => href === p || href.startsWith(`${p}/`));
