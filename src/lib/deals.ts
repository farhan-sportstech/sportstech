"use client";

import { useSyncExternalStore } from "react";

// "Deal running" is entered by hand (Amazon's promotion API does not say which week a deal ran).
// Saved per browser until it moves to Supabase; keys are `${asin}|${periodKey}`.
const KEY = "sportstech:deals";
const EVENT = "sportstech:deals";

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "{}";
  } catch {
    return "{}";
  }
}

function subscribe(cb: () => void) {
  addEventListener("storage", cb);
  addEventListener(EVENT, cb);
  return () => {
    removeEventListener("storage", cb);
    removeEventListener(EVENT, cb);
  };
}

export function useDeals() {
  const raw = useSyncExternalStore(subscribe, read, () => "{}");
  const deals = JSON.parse(raw) as Record<string, true>;
  const toggle = (asin: string, period: string) => {
    const next = { ...(JSON.parse(read()) as Record<string, true>) };
    const k = `${asin}|${period}`;
    if (next[k]) delete next[k];
    else next[k] = true;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // storage blocked (private mode): the tick just won't persist
    }
    dispatchEvent(new Event(EVENT));
  };
  return { has: (asin: string, period: string) => !!deals[`${asin}|${period}`], toggle };
}
