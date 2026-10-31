"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

/** Children of `ref` that start below the fold wait hidden and ease in as they scroll into view.
 *  Anything already on screen is left alone, and without JS nothing is ever hidden. */
export function useReveal(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const below = Array.from(root.children as HTMLCollectionOf<HTMLElement>).filter((el) => el.getBoundingClientRect().top > innerHeight * 0.9);
    below.forEach((el) => (el.dataset.reveal = "wait"));
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          (e.target as HTMLElement).dataset.reveal = "in";
          io.unobserve(e.target);
        }),
      { rootMargin: "0px 0px -8% 0px" },
    );
    below.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      below.forEach((el) => delete el.dataset.reveal);
    };
  }, [ref]);
}

/** FLIP for table rows: when `key` changes (a new sort), every `[data-flip]` row glides from where it was
 *  to where it now sits. Rows are matched by their data-flip id; new rows just appear. */
export function useFlip(ref: RefObject<HTMLElement | null>, key: string) {
  const pos = useRef(new Map<string, number>());
  const last = useRef(key);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const rows = root.querySelectorAll<HTMLElement>("[data-flip]");
    const animate = last.current !== key && !reduced();
    const next = new Map<string, number>();
    rows.forEach((row) => {
      const id = row.dataset.flip!;
      const top = row.offsetTop;
      next.set(id, top);
      const from = pos.current.get(id);
      if (animate && from !== undefined && from !== top) {
        row.animate([{ transform: `translateY(${from - top}px)` }, { transform: "none" }], { duration: 460, easing: EASE });
      }
    });
    pos.current = next;
    last.current = key;
  });
}
