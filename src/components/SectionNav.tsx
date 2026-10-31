"use client";

import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import st from "./SectionNav.module.css";

export type Section = { id: string; label: string };

/** In-page tabs: jump to a section, and follow the one in view. The underline glides to the active tab. */
export default function SectionNav({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState(sections[0].id);
  const [stuck, setStuck] = useState(false);
  const ref = useRef<HTMLElement>(null);
  // while a click-scroll is in flight the observer would walk the ink through every tab it passes
  const lock = useRef(0);

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

  useLayoutEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    const place = () => {
      const on = nav.querySelector<HTMLElement>('a[aria-current="true"]');
      if (!on) return;
      nav.style.setProperty("--x", `${on.offsetLeft}px`);
      nav.style.setProperty("--w", `${on.offsetWidth}px`);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [active]);

  const go = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    lock.current = e.timeStamp + (reduce ? 150 : 900); // event time shares performance.now()'s clock
    setActive(id);
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
    // arrival cue: a ring that fades on the section, colour only, so it also plays with reduced motion
    el.removeAttribute("data-arrive");
    void el.offsetWidth;
    el.setAttribute("data-arrive", "");
    setTimeout(() => el.removeAttribute("data-arrive"), reduce ? 1100 : 1700);
  };

  return (
    <nav ref={ref} className={st.tabs} data-stuck={stuck} aria-label="On this page">
      {sections.map((s) => (
        <a key={s.id} href={`#${s.id}`} onClick={(e) => go(e, s.id)} className={active === s.id ? st.on : undefined} aria-current={active === s.id ? "true" : undefined}>
          {s.label}
        </a>
      ))}
      <span className={st.ink} aria-hidden="true" />
    </nav>
  );
}
