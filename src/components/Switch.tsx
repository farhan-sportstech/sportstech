import type { ReactNode } from "react";
import st from "./Switch.module.css";

export default function Switch({ checked, onChange, children }: { checked: boolean; onChange: (on: boolean) => void; children: ReactNode }) {
  return (
    <label className={st.switch}>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={st.track} aria-hidden="true" />
      {children}
    </label>
  );
}
