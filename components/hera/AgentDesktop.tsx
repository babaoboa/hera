"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Glyph, ICONS } from "@/components/hera/ui";
import "./AgentDesktop.css";
import QuoteWebsites from "./QuoteWebsites";

const styles: Record<string, string> = {
  action: "hera-browser-action",
  active: "hera-browser-active",
  address: "hera-browser-address",
  aside: "hera-browser-aside",
  badge: "hera-browser-badge",
  body: "hera-browser-body",
  brand: "hera-browser-brand",
  brandbar: "hera-browser-brandbar",
  check: "hera-browser-check",
  chrome: "hera-browser-chrome",
  classic: "hera-browser-classic",
  content: "hera-browser-content",
  controls: "hera-browser-controls",
  cta: "hera-browser-cta",
  current: "hera-browser-current",
  cursor: "hera-browser-cursor",
  direct: "hera-browser-direct",
  dots: "hera-browser-dots",
  eyebrow: "hera-browser-eyebrow",
  field: "hera-browser-field",
  fields: "hera-browser-fields",
  input: "hera-browser-input",
  label: "hera-browser-label",
  legal: "hera-browser-legal",
  logo: "hera-browser-logo",
  nav: "hera-browser-nav",
  note: "hera-browser-note",
  portal: "hera-browser-portal",
  progress: "hera-browser-progress",
  reading: "hera-browser-reading",
  result: "hera-browser-result",
  selected: "hera-browser-selected",
  sidebar: "hera-browser-sidebar",
  site: "hera-browser-site",
  skeleton: "hera-browser-skeleton",
  status: "hera-browser-status",
  statusText: "hera-browser-statusText",
  step: "hera-browser-step",
  title: "hera-browser-title",
  track: "hera-browser-track",
  utility: "hera-browser-utility",
  visited: "hera-browser-visited",
  wide: "hera-browser-wide",
  window: "hera-browser-window",
};

export type DesktopPage = {
  url: string;
  site: { name: string; color: string; style?: "bank" | "direct" | "classic" | "explorer" };
  mode?: "quote" | "portal" | "claim";
  title: string;
  fields?: { label: string; value: string }[];
  note?: string;
  result?: { label: string; value: string };
};

type Phase = "url" | "load" | "read" | "fill" | "review" | "result" | "done";
// Deliberate demonstration pacing: orient, fill, review, then hold the result.
const TIMING = { urlChar: 30, load: 1100, read: 1600, fieldChar: 28, fieldGap: 650, review: 1700, result: 3000 };

function HouseMark({ size = 24 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 15 16 5l12 10M8 13v14h16V13M13 27V17h6v10M21 9V5h4v7" /></svg>;
}

export default function AgentDesktop({ pages, instant = false, pauseLabel, onDone }: {
  pages: DesktopPage[];
  instant?: boolean;
  pauseLabel?: string;
  onDone?: () => void;
}) {
  const [index, setIndex] = useState(instant ? Math.max(0, pages.length - 1) : 0);
  const [phase, setPhase] = useState<Phase>(instant ? "done" : "url");
  const [chars, setChars] = useState(0);
  const [field, setField] = useState(0);
  const [paused, setPaused] = useState(false);
  const onDoneRef = useRef(onDone);
  const notified = useRef(false);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);
  const page = pages[Math.min(index, pages.length - 1)];
  const fields = useMemo(() => page?.fields ?? [], [page]);
  const finished = phase === "done";
  const reading = page?.mode === "portal";

  useEffect(() => {
    if (!page || finished || paused) return;
    let delay: number;
    let next: () => void;
    switch (phase) {
      case "url":
        delay = chars < page.url.length ? TIMING.urlChar : 350;
        next = () => chars < page.url.length ? setChars((c) => c + 2) : setPhase("load");
        break;
      case "load": delay = TIMING.load; next = () => { setPhase("read"); setField(0); setChars(0); }; break;
      case "read": delay = TIMING.read; next = () => setPhase("fill"); break;
      case "fill": {
        const value = fields[field]?.value ?? "";
        const typing = !reading && chars < value.length;
        delay = field >= fields.length ? 250 : typing ? TIMING.fieldChar : reading ? 1000 : TIMING.fieldGap;
        next = () => {
          if (field >= fields.length) setPhase("review");
          else if (typing) setChars((c) => c + 2);
          else { setField((f) => f + 1); setChars(0); }
        };
        break;
      }
      case "review": delay = TIMING.review; next = () => setPhase("result"); break;
      case "result":
        delay = TIMING.result;
        next = () => {
          if (index < pages.length - 1) { setIndex((i) => i + 1); setPhase("url"); setChars(0); }
          else setPhase("done");
        };
        break;
    }
    const timer = setTimeout(next, delay);
    return () => clearTimeout(timer);
  }, [page, phase, chars, field, fields, index, pages.length, finished, paused, reading]);

  useEffect(() => {
    if (finished && !instant && !notified.current) { notified.current = true; onDoneRef.current?.(); }
  }, [finished, instant]);

  if (!page) return null;
  const mode = page.mode ?? "quote";
  const portal = mode !== "quote";
  const ready = phase === "result" || finished;
  const filled = ready || phase === "review";
  const loading = phase === "url" || phase === "load";
  const brand = page.site.name.split(" · ")[0];
  const section = mode === "claim" ? "Claims" : /billing/i.test(page.url) ? "Billing" : /discounts/i.test(page.url) ? "Discounts" : "My policies";
  const status = finished ? (pauseLabel ?? "Review complete") : paused ? "Paused for your walkthrough" : {
    url: "Opening insurer website", load: "Loading page", read: "Reading the page",
    fill: `${reading ? "Checking" : "Filling"} ${fields[field]?.label.toLowerCase() ?? "details"}`,
    review: reading ? "Cross-checking policy details" : "Reviewing the completed form",
    result: page.result ? "Reading the result" : "Checking the form before approval",
  }[phase as Exclude<Phase, "done">];
  const skin = page.site.style ?? "bank";
  const theme = { "--brand": page.site.color } as CSSProperties;

  return (
    <div className={styles.window}>
      <div className={styles.chrome}>
        <div className={styles.dots} aria-hidden="true"><i /><i /><i /></div>
        <div className={styles.address}>⌕ &nbsp; {phase === "url" ? page.url.slice(0, chars) : page.url}</div>
      </div>
      {!portal ? <QuoteWebsites page={page} loading={loading} ready={ready} fields={fields.map((f, i) => ({ label: f.label, done: filled || i < field, active: phase === "fill" && i === field, value: filled || i < field ? f.value : phase === "fill" && i === field ? f.value.slice(0, chars) : "" }))} /> : <div className={`${styles.site} ${styles[skin] ?? ""} ${portal ? styles.portal : ""}`} style={theme}>
        <div className={styles.utility}><span>{portal ? "Personal insurance · Client centre" : "Home & auto insurance"}</span><span>Canada &nbsp; | &nbsp; EN</span></div>
        <div className={styles.brandbar}>
          <div className={styles.brand}><span className={styles.logo}><HouseMark /></span><span>{brand}<small>{skin === "direct" ? "Insurance, simply." : "Home insurance"}</small></span></div>
          <div className={styles.nav}><span>{portal ? "My account" : "Our coverage"}</span><span>Help & contact</span></div>
        </div>
        {!portal && <div className={styles.progress}>{["Your home", "Your details", "Your quote"].map((s, i) => <div key={s} className={`${styles.step} ${i === (ready ? 2 : 1) ? styles.current : ""}`}><b>{i < (ready ? 2 : 1) ? "✓" : i + 1}</b>{s}</div>)}</div>}
        <div className={styles.body}>
          {portal && <div className={styles.sidebar}><strong>Client centre</strong>{["Overview", "My policies", "Billing", "Discounts", "Documents", "Claims"].map((s) => <span key={s} className={s === section ? styles.selected : ""}>{s}</span>)}</div>}
          <div className={styles.content}>
            <div className={styles.eyebrow}>{portal ? `My account / ${section}` : "Your home. Your coverage."}</div>
            <h3 className={styles.title}>{page.title}</h3>
            <p className={styles.note}>{page.note ?? (portal ? "Review the details of your home insurance policy." : "A few details help us find the right protection for your home.")}</p>
            {loading ? <div className={styles.skeleton} aria-label="Loading page">{[0, 1, 2, 3].map((i) => <span key={i} />)}</div> : <>
              <div className={`${styles.fields} ${reading ? styles.reading : ""}`}>
                {fields.map((f, i) => {
                  const done = filled || i < field;
                  const active = phase === "fill" && i === field;
                  const value = done || reading ? f.value : active ? f.value.slice(0, chars) : "";
                  return <div key={f.label} className={`${styles.field} ${f.value.length > 32 ? styles.wide : ""}`}>
                    <span className={styles.label}>{f.label}</span>
                    <div className={`${styles.input} ${active ? styles.active : ""}`}><span>{value || "\u00a0"}{active && !reading && <i className={styles.cursor} />}</span>{done && <span className={styles.check}>✓</span>}</div>
                  </div>;
                })}
              </div>
              {page.result && ready ? <div className={styles.result}><span>{page.result.label}</span><strong>{page.result.value}</strong></div> : !reading && <div className={styles.action}><span>{filled ? "Details reviewed" : "Filling details from your file"}</span><span className={styles.cta}>{mode === "claim" ? "Review claim →" : "Review quote →"}</span></div>}
            </>}
          </div>
          {!portal && <aside className={styles.aside}><HouseMark size={42} /><strong>{skin === "direct" ? "A little peace of mind." : "Protection that feels like home."}</strong><p>Coverage for your home, your belongings, and the everyday unexpected.</p><hr /><strong>Your quote includes</strong><div>✓ Home & belongings</div><div>✓ Liability protection</div><div>✓ Coverage options</div></aside>}
        </div>
        <div className={styles.legal}><span>Home insurance</span><span>Privacy & security &nbsp; | &nbsp; Accessibility</span></div>
      </div>}
      <div className={styles.status}>
        <div className={styles.statusText}><Glyph d={finished ? ICONS.check : ICONS.search} size={13} /><span role="status">{status}</span></div>
        {!finished && <div className={styles.controls}><button type="button" aria-label={paused ? "Resume browser animation" : "Pause browser animation"} onClick={() => setPaused((p) => !p)}>{paused ? "Resume" : "Pause"}</button><button type="button" onClick={() => { setIndex(pages.length - 1); setPhase("done"); }}>Skip animation</button></div>}
      </div>
      {pages.length > 1 && <div className={styles.track} aria-label={`Website ${index + 1} of ${pages.length}`}>{pages.map((p, i) => <span key={p.url} className={i <= index ? styles.visited : ""} style={{ "--brand": p.site.color } as CSSProperties} />)}</div>}
    </div>
  );
}
