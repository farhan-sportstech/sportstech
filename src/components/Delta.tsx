import { pct1 } from "@/lib/format";

type Tone = "good" | "bad" | "flat";

/** Signed change. Colour never carries it alone: the +/− sign is always there. */
export default function Delta({ value, unit = "%", goodWhen = "up" }: { value: number; unit?: string; goodWhen?: "up" | "down" | "none" }) {
  const rounded = Math.round(value * 10) / 10;
  const tone: Tone = rounded === 0 || goodWhen === "none" ? "flat" : (rounded > 0) === (goodWhen === "up") ? "good" : "bad";
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return (
    <span className={`dl ${tone}`}>
      {sign}
      {pct1.format(Math.abs(rounded))}
      {unit}
    </span>
  );
}
