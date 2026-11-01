"use client";

import { useState } from "react";
import { enqueue, isQueued, useQueue, type Change } from "@/lib/queue";
import { cx } from "@/lib/cx";
import st from "./hub.module.css";

/** Puts one change in the pending queue. Shows "Queued" once it is there; a second click updates the entry. */
export default function QueueButton({ label, change, source }: { label: string; change: Omit<Change, "id" | "queuedAt" | "source">; source: string }) {
  const q = useQueue();
  const [full, setFull] = useState(false);
  const done = isQueued(q, change.action, change.campaign, change.adGroup, change.entity);
  return (
    <button
      type="button"
      className={cx(st.q, done && st.done)}
      title={full ? "The queue holds 50 changes; send or clear some first" : done ? "In Pending changes; click to update it" : `Queue: ${label}`}
      onClick={() => setFull(enqueue({ ...change, source }) === "full")}
    >
      {done ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m5 12 5 5 9-10" />
        </svg>
      ) : null}
      {full ? "Queue full" : done ? "Queued" : label}
    </button>
  );
}
