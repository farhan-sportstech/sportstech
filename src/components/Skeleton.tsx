import type { CSSProperties } from "react";
import st from "./Skeleton.module.css";
import d from "./dash.module.css";
import { cx } from "@/lib/cx";

/** Placeholder bar with a shimmer; size it like the content it stands in for. */
export function Bone({ w = "100%", h = 14, r, style }: { w?: number | string; h?: number; r?: number; style?: CSSProperties }) {
  return <span className={st.bone} style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden="true" />;
}

/** A table-shaped panel: heading, a header row, then `rows` lines of `cols` cells. */
export function TableSkeleton({ rows = 8, cols = 7, title = 140 }: { rows?: number; cols?: number; title?: number }) {
  return (
    <div className={cx("panel flush", st["sk-panel"])} aria-hidden="true">
      <div className="ph-row between">
        <Bone w={title} h={20} />
        <Bone w={220} h={36} r={10} />
      </div>
      <div className={st["sk-table"]}>
        <div className={cx(st["sk-tr"], st["sk-th"])} style={{ gridTemplateColumns: `1.6fr repeat(${cols - 1}, 1fr)` }}>
          {Array.from({ length: cols }, (_, i) => (
            <Bone key={i} w={i === 0 ? "45%" : "60%"} h={11} style={i ? { justifySelf: "end" } : undefined} />
          ))}
        </div>
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className={st["sk-tr"]} style={{ gridTemplateColumns: `1.6fr repeat(${cols - 1}, 1fr)`, animationDelay: `${r * 60}ms` }}>
            {Array.from({ length: cols }, (_, i) => (
              <Bone key={i} w={i === 0 ? `${55 + ((r * 17) % 35)}%` : `${50 + ((r * 7 + i * 11) % 40)}%`} h={13} style={i ? { justifySelf: "end" } : undefined} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Whole Weekly Dash layout while its data loads. */
export default function DashSkeleton() {
  return (
    <div className="wdp" role="status" aria-label="Loading dashboard">
      <div className={d['pg-head']}>
        <div>
          <Bone w={360} h={40} r={8} />
          <Bone w={480} h={14} style={{ marginTop: 14 }} />
        </div>
        <Bone w={240} h={40} r={11} />
      </div>
      <div className={st["sk-tabs"]}>
        {[74, 80, 96, 86, 92, 104, 96, 90].map((w, i) => (
          <Bone key={i} w={w} h={14} />
        ))}
      </div>
      <div className={d.glance}>
        <div className={d.lead}>
          <Bone w="40%" h={14} />
          <Bone w="70%" h={52} r={8} style={{ marginTop: 10 }} />
          <div className={st["sk-bars"]}>
            {[78, 84, 88, 82, 70].map((h, i) => (
              <Bone key={i} w="100%" h={h} r={4} style={{ alignSelf: "end" }} />
            ))}
          </div>
        </div>
        <div className={d.minis}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={cx(d.kpi, st.skKpi)}>
              <Bone w={70} h={12} />
              <Bone w={130} h={28} r={6} />
              <Bone w={110} h={12} />
            </div>
          ))}
        </div>
      </div>
      <div className={cx("panel", st["sk-panel"])}>
        <Bone w={170} h={20} />
        {[92, 78, 60, 84, 70].map((w, i) => (
          <Bone key={i} w={`${w}%`} h={14} style={{ marginTop: 14 }} />
        ))}
      </div>
      <TableSkeleton rows={10} cols={9} title={110} />
      <TableSkeleton rows={7} cols={6} title={150} />
    </div>
  );
}
