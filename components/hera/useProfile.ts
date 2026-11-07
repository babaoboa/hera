"use client";

import { useSyncExternalStore } from "react";
import type { Profile } from "@/lib/hera/profile";

/* A tiny client store for the household file. Any component can read it with
 * useProfile(); anything that changes the file calls notifyProfileChanged(). */

let snapshot: Profile | null = null;
const listeners = new Set<() => void>();
let running = false;
let again = false;

async function refresh() {
  if (running) {
    again = true; // a change landed mid-fetch — fetch once more when done
    return;
  }
  running = true;
  try {
    do {
      again = false;
      const res = await fetch("/api/profile", { cache: "no-store" });
      if (res.ok) {
        snapshot = (await res.json()) as Profile;
        listeners.forEach((l) => l());
      }
    } while (again);
  } finally {
    running = false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!snapshot) void refresh();
  return () => {
    listeners.delete(listener);
  };
}

export const notifyProfileChanged = () => void refresh();

export function useProfile() {
  const profile = useSyncExternalStore(subscribe, () => snapshot, () => null);
  return { profile, refresh };
}
