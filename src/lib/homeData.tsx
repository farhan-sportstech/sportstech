"use client";

// The Weekly Dash's data, handed down from the server page. Sections read it here instead of importing the sample
// module, so the same components work on live or sample data. Without a provider (category pages) the sample
// values are used, exactly as before.
import { createContext, useContext, type ReactNode } from "react";
import { SAMPLE_HOME, type HomeData } from "./homeSample";

export type { HomeData };

const Ctx = createContext<HomeData>(SAMPLE_HOME);
export const useHomeData = () => useContext(Ctx);

export function HomeDataProvider({ data, children }: { data: HomeData; children: ReactNode }) {
  return <Ctx.Provider value={data}>{children}</Ctx.Provider>;
}

/** Marks a section (or a view of it, with `when`) that still shows sample figures on an otherwise live page. */
export function SampleTag({ when = true, reason, live: pageLive }: { when?: boolean; reason?: string; live?: boolean }) {
  // category pages say themselves whether they are live; the Weekly Dash takes it from its provider
  const home = useHomeData();
  const live = pageLive ?? home.live;
  return live && when ? (
    <span className="sample-tag" title={reason ?? "This section isn't connected to the database yet; its figures are invented."}>
      Sample data{reason ? ` · ${reason}` : ""}
    </span>
  ) : null;
}
