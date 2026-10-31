"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import st from "./SectionNav.module.css";

// `group` is optional: with groups the bar shows a group switch, then only that group's tabs
export type Section = { id: string; label: string; group?: string };

/** In-page tabs: jump to a section, and follow the one in view. The underline glides to the active tab.
 *  Long lists are split into groups; whatever still does not fit goes into a "More" menu. Never wrapped, never scrolled. */
export default function SectionNav({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState(sections[0].id);
  const [stuck, setStuck] = useState(false);
  const [fit, setFit] = useState(sections.length);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  // while a click-scroll is in flight the observer would walk the ink through every tab it passes
  const lock = useRef(0);

  const groups = useMemo(() => Array.from(new Set(sections.map((s) => s.group).filter((g): g is string => !!g))), [sections]);
  const group = sections.find((s) => s.id === active)?.group ?? groups[0];
  const list = useMemo(() => (groups.length > 1 ? sections.filter((s) => s.group === group) : sections), [sections, groups, group]);
  const activeIdx = list.findIndex((s) => s.id === active);
  const visible = list.slice(0, fit);
  const overflow = list.slice(fit);
  const activeHidden = activeIdx >= fit;

  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit && performance.now() > lock.current) setActive(hit.target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [sections]);

  // a bar pinned to the top gets a surface and a shadow; at rest it sits flat on the page
  useEffect(() => {
    const onScroll = () => setStuck((ref.current?.getBoundingClientRect().top ?? 1) <= 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // how many of the group's tabs fit beside the group switch: measured from a hidden copy of the labels
  useLayoutEffect(() => {
    const nav = ref.current;
    const m = measure.current;
    if (!nav || !m) return;
    const calc = () => {
      const kids = Array.from(m.children) as HTMLElement[];
      const tabs = kids.slice(0, list.length).map((k) => k.offsetWidth);
      const moreBase = kids[list.length]?.offsetWidth ?? 0;
      const gap = 4;
      const room = nav.clientWidth - 8 - (groupRef.current ? groupRef.current.offsetWidth + 20 : 0);
      if (tabs.reduce((a, w) => a + w + gap, 0) <= room) return setFit(list.length);
      let k = list.length - 1;
      for (; k > 1; k--) {
        // the More button grows by the active label when the active tab is inside it
        const more = moreBase + (activeIdx >= k ? tabs[activeIdx] - 12 : 0);
        if (tabs.slice(0, k).reduce((a, w) => a + w + gap, 0) + more <= room) break;
      }
      setFit(k);
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [list, activeIdx]);

  // the ink sits under the active tab, or under More when the active tab is in the menu
  useLayoutEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    const place = () => {
      const on = nav.querySelector<HTMLElement>("[data-on]");
      if (!on) return;
      const box = nav.getBoundingClientRect();
      const r = on.getBoundingClientRect();
      nav.style.setProperty("--x", `${r.left - box.left}px`);
      nav.style.setProperty("--w", `${r.width}px`);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [active, fit, group]);

  // the menu closes on a click elsewhere or Escape
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !moreRef.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const jump = (id: string, at: number) => {
    const el = document.getElementById(id);
    if (!el) return;
    setOpen(false);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    lock.current = at + (reduce ? 150 : 900); // event time shares performance.now()'s clock
    setActive(id);
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
    // arrival cue: a ring that fades on the section, colour only, so it also plays with reduced motion
    el.removeAttribute("data-arrive");
    void el.offsetWidth;
    el.setAttribute("data-arrive", "");
    setTimeout(() => el.removeAttribute("data-arrive"), reduce ? 1100 : 1700);
  };
  const go = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (!document.getElementById(id)) return;
    e.preventDefault();
    jump(id, e.timeStamp);
  };

  return (
    <nav ref={ref} className={st.tabs} data-stuck={stuck} aria-label="On this page">
      {groups.length > 1 ? (
        <div ref={groupRef} className={st.groups} role="group" aria-label="Section group">
          {groups.map((g) => (
            <button key={g} type="button" aria-pressed={g === group} onClick={(e) => g !== group && jump(sections.find((s) => s.group === g)!.id, e.timeStamp)}>
              {g}
            </button>
          ))}
        </div>
      ) : null}
      {visible.map((s) => (
        <a key={s.id} href={`#${s.id}`} onClick={(e) => go(e, s.id)} className={active === s.id ? st.on : undefined} aria-current={active === s.id ? "true" : undefined} data-on={active === s.id ? "" : undefined}>
          {s.label}
        </a>
      ))}
      {overflow.length ? (
        <div ref={moreRef} className={st.moreWrap}>
          <button type="button" className={st.more} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)} data-on={activeHidden ? "" : undefined}>
            {activeHidden ? (
              <>
                <span className={st.moreL}>More ·</span> <span className={st.moreOn}>{list[activeIdx].label}</span>
              </>
            ) : (
              <>
                More <span className={st.count}>{overflow.length}</span>
              </>
            )}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {open ? (
            <div className={st.menu} role="menu">
              {overflow.map((s) => (
                <a key={s.id} role="menuitem" href={`#${s.id}`} onClick={(e) => go(e, s.id)} className={active === s.id ? st.menuOn : undefined} aria-current={active === s.id ? "true" : undefined}>
                  {s.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <span className={st.ink} aria-hidden="true" />
      {/* hidden copy of the group's labels (and the bare More button) for measuring */}
      <div ref={measure} className={st.measure} aria-hidden="true">
        {list.map((s) => (
          <span key={s.id} className={st.mtab}>
            {s.label}
          </span>
        ))}
        <span className={st.mmore}>
          More <span className={st.count}>{list.length}</span>
          <svg viewBox="0 0 24 24" />
        </span>
      </div>
    </nav>
  );
}
