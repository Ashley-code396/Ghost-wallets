"use client";
import React from "react";

export function SolutionCard({ title, bullet }: { title: string; bullet: string[] }) {
  return (
    <div className="holo-card animated-border rounded-lg p-6 shadow-lg">
      <div>
        <h3 className="text-lg font-bold text-silver mb-2">{title}</h3>
        <ul className="text-sm text-ghost space-y-1">
          {bullet.map((b, i) => <li key={i} className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-cyan-300/80" />{b}</li>)}
        </ul>
      </div>
    </div>
  );
}
