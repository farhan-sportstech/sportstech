import type { CSSProperties } from "react";
import st from "./Bars.module.css";
import { cx } from "@/lib/cx";

/** Period trend as columns from a zero baseline, oldest left, current (index 0) right and accented.
 *  Columns grow in on mount; key the component on the dataset to replay it when the data swaps. */
export default function Bars({ values, labels, format, size = "sm", className }: { values: number[]; labels: string[]; format: (v: number) => string; size?: "sm" | "lg"; className?: string }) {
  const max = Math.max(...values) || 1;
  const order = values.map((v, i) => ({ v, label: labels[i], cur: i === 0 })).reverse();
  return (
    <div className={cx(st.bars, st[size], className)} role="img" aria-label={order.map((o) => `${o.label}: ${format(o.v)}`).join(", ")}>
      {order.map((o, i) => (
        <div key={o.label} className={cx(st.bar, o.cur && st.now)} title={`${o.label}: ${format(o.v)}`}>
          <span className={st.col}>
            <span className={st.fill} style={{ "--h": o.v / max, "--i": i } as CSSProperties} />
          </span>
          {size === "lg" ? <span className={st.bl}>{o.label}</span> : null}
        </div>
      ))}
    </div>
  );
}
