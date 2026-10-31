/** Joins class names, skipping falsy ones: cx(s.it, on && s.on). */
export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
