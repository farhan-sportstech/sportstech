"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Icon from "./NavIcon";
import s from "./Sidebar.module.css";
import { cx } from "@/lib/cx";
import { NAV, NAV_TITLE, isGroup, isHeading, type NavGroup, type NavLeaf } from "@/lib/nav";
import { useQueue } from "@/lib/queue";

const pathOf = (href: string) => href.split("#")[0];
const norm = (p: string) => (p.endsWith("/") ? p : p + "/");
const hasHash = (href: string) => href.includes("#");

function Leaf({ item, here, sub }: { item: NavLeaf; here: string; sub?: boolean }) {
  // Hash links (Ads Hub views) need the page itself; they are never marked active in this step.
  const on = !hasHash(item.href) && norm(pathOf(item.href)) === here;
  return (
    <Link
      href={item.href}
      className={cx(s.it, sub && s.sub, on && s.on)}
      aria-current={on ? "page" : undefined}
      title={item.label}
    >
      <Icon name={item.icon} />
      <span className={s.lb}>{item.label}</span>
      {item.href === "/writeback/pending/" ? <QueueCount /> : null}
    </Link>
  );
}

// queued changes waiting to be sent, shown beside Pending changes
function QueueCount() {
  const n = useQueue().length;
  return n ? (
    <span key={n} className={s.badge} aria-label={`${n} queued`}>
      {n}
    </span>
  ) : null;
}

function Group({ group, here }: { group: NavGroup; here: string }) {
  const active = group.children.some((c) => !isHeading(c) && norm(pathOf(c.href)) === here);
  const [open, setOpen] = useState(active);
  return (
    <>
      <button
        type="button"
        className={cx(s.it, s.grp, active && s.act)}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title={group.label}
      >
        <Icon name={group.icon} />
        <span className={s.lb}>{group.label}</span>
        <span className={s.cv}>
          <Icon name="chev" />
        </span>
      </button>
      <div className={cx(s.kids, !open && s.shut)} inert={!open}>
        <div className={s.kin}>
          {group.children.map((c, i) =>
            isHeading(c) ? (
              <div key={`h${i}`} className={s.sh}>
                {c.heading}
              </div>
            ) : (
              <Leaf key={c.href} item={c} here={here} sub />
            ),
          )}
        </div>
      </div>
    </>
  );
}

export default function Sidebar() {
  const here = norm(usePathname());
  const [mini, setMini] = useState(false);
  const [menu, setMenu] = useState(false);

  return (
    <>
      <button type="button" id="wd-hb" className={s.hb} aria-label="Open menu" onClick={() => setMenu((m) => !m)}>
        <Icon name="menu" />
      </button>
      {menu && <div id="wd-ov" className={s.ov} onClick={() => setMenu(false)} />}
      <nav id="wd-sb" className={s.sb} aria-label="Dashboards" data-mini={mini} data-open={menu} onClick={(e) => (e.target as HTMLElement).closest("a") && setMenu(false)}>
        <div className={s.hd}>
          <div className={s.tx}>
            <div className={s.t}>{NAV_TITLE}</div>
            <div className={s.st}>Amazon.de</div>
          </div>
          <button type="button" id="wd-tg" className={s.tg} onClick={() => setMini((m) => !m)} aria-expanded={!mini} aria-label={mini ? "Expand sidebar" : "Collapse sidebar"} title={mini ? "Expand sidebar" : "Collapse sidebar"}>
            <Icon name="col" />
          </button>
        </div>
        <div className={s.bd}>
          {NAV.map((sec) => (
            <div key={sec.name}>
              <div className={s.h}>{sec.name}</div>
              {sec.items.map((i) =>
                isGroup(i) ? <Group key={i.id} group={i} here={here} /> : <Leaf key={i.href} item={i} here={here} />,
              )}
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}
