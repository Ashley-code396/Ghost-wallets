"use client";

import React from "react";
import Link from "next/link";
import { Hero } from "./components/Hero";
import { ProblemCard } from "./components/marketing/ProblemCard";
import { SolutionCard } from "./components/marketing/SolutionCard";
import { TimelineStep } from "./components/marketing/TimelineStep";
import { Reveal } from "./components/Reveal";

export default function Landing() {
  return (
    <div className="min-h-screen text-silver bg-void">
      <Hero onCreate={() => { /* links to dashboard via CTA below */ }} />

      <main className="max-w-6xl mx-auto px-6 pb-20 space-y-20">
        {/* SECTION 2 — PROBLEM */}
        <section>
          <Reveal className="glow"><h2 className="text-3xl font-bold ghost-title mb-6">The Problem</h2></Reveal>
          <p className="text-ghost max-w-2xl mb-6">Modern wallets are persistent, traceable, and leave permanent trails. That creates risk, clutter, and operational exposure.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ProblemCard title="Permanent Exposure" desc="Public addresses remain forever visible, linking behavior across services." />
            <ProblemCard title="Transaction Traceability" desc="Every transfer can be traced and deanonymized over time." />
            <ProblemCard title="Wallet Clutter" desc="Persistent wallets accumulate state, keys, and operational risk." />
          </div>
        </section>

        {/* SECTION 3 — SOLUTION */}
        <section>
          <Reveal className="glow"><h2 className="text-3xl font-bold ghost-title mb-6">The Solution</h2></Reveal>
          <p className="text-ghost max-w-2xl mb-6">Ghost Wallets provide task-based ephemeral identities that self-expire to reduce traceability and operational risk.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SolutionCard title="Task-specific wallets" bullet={["Spawn for a single mission", "No long-term linkage"]} />
            <SolutionCard title="Self-expiring identities" bullet={["Set a lifetime", "Automatic cleanup on expiry"]} />
            <SolutionCard title="Stealth execution" bullet={["Isolated transactions", "Minimal on-chain trace"]} />
          </div>
        </section>

        {/* SECTION 4 — HOW IT WORKS */}
        <section>
          <Reveal className="glow"><h2 className="text-3xl font-bold ghost-title mb-6">How it works</h2></Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="col-span-2">
              <TimelineStep index={1} title="Create ghost wallet" sub="Spawn a task wallet in seconds." />
              <div className="h-6" />
              <TimelineStep index={2} title="Assign mission" sub="Attach a purpose and optional metadata." />
              <div className="h-6" />
              <TimelineStep index={3} title="Auto-expire" sub="Wallet dissolves when the mission ends." />
            </div>
            <div className="flex items-center justify-center">
              <div className="holo-card p-6 rounded-xl w-full max-w-sm text-center">
                <div className="text-sm text-ghost mb-2">Live Timeline</div>
                <div className="h-24 rounded-md border border-border-low/40 bg-void" />
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5 — FEATURES */}
        <section>
          <Reveal className="glow"><h2 className="text-3xl font-bold ghost-title mb-6">Features</h2></Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div className="holo-card p-4 rounded-lg">Self-destruct timers</div>
              <div className="holo-card p-4 rounded-lg">Live transaction feed</div>
            </div>
            <div className="space-y-4">
              <div className="holo-card p-4 rounded-lg">Ephemeral identities</div>
              <div className="holo-card p-4 rounded-lg">Stealth mode</div>
            </div>
            <div className="space-y-4">
              <div className="holo-card p-4 rounded-lg">Auto-expiry</div>
              <div className="holo-card p-4 rounded-lg">Lightweight deployment</div>
            </div>
          </div>
        </section>

        {/* SECTION 6 — LIVE PREVIEW */}
        <section>
          <Reveal className="glow"><h2 className="text-3xl font-bold ghost-title mb-6">Live preview</h2></Reveal>
          <p className="text-ghost mb-4">A small peek into the operational dashboard without exposing sensitive controls.</p>
          <div className="holo-card p-6 rounded-xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-void rounded p-4">Preview: Wallet card + timer</div>
              <div className="bg-void rounded p-4">Preview: Encrypted activity stream</div>
            </div>
            <div className="mt-4 text-right">
              <Link href="/dashboard" className="px-6 py-3 rounded-lg font-bold bg-cyan-400 text-void">Enter Live Preview</Link>
            </div>
          </div>
        </section>

        {/* SECTION 7 — FINAL CTA */}
        <section className="text-center">
          <Reveal className="glow"><h2 className="text-4xl font-black ghost-title mb-6">Ready to launch?</h2></Reveal>
          <div className="flex items-center justify-center gap-4">
            <Link href="/dashboard" className="px-8 py-4 rounded-lg font-bold bg-gradient-to-r from-[#00d7ff] via-[#8a5aff] to-[#cfe8ff] text-void shadow-[0_12px_50px_rgba(0,120,200,0.18)]">Enter the Ghost Network</Link>
            <a className="px-6 py-3 rounded-lg border border-border-low text-ghost">View Protocol</a>
          </div>
        </section>
      </main>
    </div>
  );
}

