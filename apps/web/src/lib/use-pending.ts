import * as React from "react";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run an async action and know which one is in flight.
 * `run("key", fn)` sets `pending === "key"` until fn finishes. Demo latency stands in for the API.
 */
export function usePending(latency = 700) {
  const [pending, setPending] = React.useState<string | null>(null);
  const run = React.useCallback(async (key: string, fn: () => void | Promise<void>) => {
    setPending(key);
    try { await sleep(latency); await fn(); } finally { setPending(null); }
  }, [latency]);
  return { pending, run, is: (key: string) => pending === key };
}
