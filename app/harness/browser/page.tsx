"use client";

import { useState } from "react";
import Link from "next/link";
import AgentDesktop, { type DesktopPage } from "@/components/hera/AgentDesktop";

const fields = [
  { label: "Property address", value: "412 Riverbend Rd, Ottawa, ON" },
  { label: "Year built", value: "2011" },
  { label: "Living area", value: "1,850 sq ft" },
  { label: "Roof replaced", value: "2021" },
  { label: "Claims (5 yrs)", value: "0" },
  { label: "Protections", value: "Monitored alarm, leak sensors" },
];
const quotes: DesktopPage[] = [
  { url: "northline-mutual.example/home-quote", site: { name: "Northline Mutual", color: "#285887", style: "explorer" }, title: "Tell us about your home", fields, result: { label: "Your quote", value: "$1,920/yr" } },
  { url: "cedarcrest-home.example/home-quote", site: { name: "Cedarcrest Home", color: "#367435", style: "bank" }, title: "Tell us about your home", fields, result: { label: "Your quote", value: "$1,780/yr" } },
  { url: "tamarack-general.example/home-quote", site: { name: "Tamarack General", color: "#c73727", style: "classic" }, title: "A home worth protecting.", fields, result: { label: "Your quote", value: "$2,040/yr" } },
  { url: "fernwood-direct.example/home-quote", site: { name: "Fernwood Direct", color: "#ed3184", style: "direct" }, title: "Let’s make home feel covered.", fields, result: { label: "Your quote", value: "$1,850/yr" } },
];
const portal: DesktopPage = { url: "portal.birchwoodmutual.example/policies/BW-DEMO", site: { name: "Birchwood Mutual", color: "#2f5d50" }, mode: "portal", title: "Policy summary", note: "Signed in as Maya", fields: [{ label: "Policy number", value: "BW-DEMO" }, { label: "Renewal date", value: "Nov 30, 2026" }, { label: "Deductible", value: "$2,500" }, { label: "Claims in last 5 years", value: "0" }], result: { label: "Annual premium", value: "$1,925" } };
const claim: DesktopPage = { ...portal, url: "portal.birchwoodmutual.example/report-a-claim", mode: "claim", title: "Report a claim", note: "Prepared from your Hera file. Awaiting your approval.", fields: [{ label: "Policy number", value: "BW-DEMO" }, { label: "Policyholder", value: "Maya Chen" }, { label: "Property address", value: "412 Riverbend Rd, Ottawa, ON" }, { label: "Date of loss", value: "Nov 7, 2026" }, { label: "Cause of loss", value: "Overland flood" }], result: undefined };
const variants = [...quotes, portal, claim];

export default function BrowserPreview() {
  const [selected, setSelected] = useState(1);
  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sequence, setSequence] = useState(false);
  const [complete, setComplete] = useState(false);
  return <main className="min-h-screen bg-page px-4 py-10 text-ink">
    <div className="mx-auto max-w-[720px]">
      <Link href="/" className="text-xs text-ink-3">← Back to Hera</Link>
      <h1 className="mt-6 text-2xl tracking-tight">Hera’s browser</h1>
      <p className="mt-2 text-sm text-ink-3">Browser animation rehearsal</p>
      <div className="my-6 flex flex-wrap gap-2">{variants.map((p, i) => <button key={p.url} type="button" className={`rounded-control px-3 py-2 text-xs ${selected === i && !sequence ? "bg-accent text-white" : "bg-field text-ink-2"}`} onClick={() => { setSelected(i); setPlaying(false); setSequence(false); setComplete(false); setRun((r) => r + 1); }}>{i === 4 ? "Policy portal" : i === 5 ? "Claim form" : p.site.name}</button>)}</div>
      <AgentDesktop key={run} pages={sequence ? quotes : [variants[selected]]} instant={!playing} pauseLabel={selected === 5 && !sequence ? "Waiting for your approval" : undefined} onDone={() => setComplete(true)} />
      <div className="mt-5 flex flex-wrap items-center gap-4 text-xs">
        <button type="button" className="rounded-control bg-ink px-4 py-2 text-surface" onClick={() => { setSequence(false); setPlaying(true); setComplete(false); setRun((r) => r + 1); }}>Replay this website</button>
        <button type="button" className="text-ink-2 underline underline-offset-4" onClick={() => { setSequence(true); setPlaying(true); setComplete(false); setRun((r) => r + 1); }}>Play all four insurers</button>
        <span role="status" className="text-ink-3">{complete ? "Animation complete" : playing ? "Rehearsal playing" : "Finished-state preview"}</span>
      </div>
    </div>
  </main>;
}
