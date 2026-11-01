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

/** Marks a section that still shows sample figures on an otherwise live page. */
export function SampleTag() {
  const { live } = useHomeData();
  return live ? (
    <span className="sample-tag" title="This section isn't connected to the database yet; its figures are invented.">
      Sample data
    </span>
  ) : null;
}
