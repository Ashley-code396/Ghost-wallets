"use client";
import React from "react";

export function TimelineStep({ index, title, sub }: { index: number; title: string; sub?: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-full flex items-center justify-center font-mono text-sm text-void bg-cyan-300/90 shadow-[0_6px_20px_rgba(0,200,255,0.12)]">{index}</div>
      <div>
        <h4 className="text-md font-bold text-silver">{title}</h4>
        <p className="text-xs text-ghost mt-1">{sub}</p>
      </div>
    </div>
  );
}
