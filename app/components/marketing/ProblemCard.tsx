"use client";
import React from "react";

export function ProblemCard({ title, desc, accent }: { title: string; desc: string; accent?: string }) {
  return (
    <div className="holo-card animated-border rounded-lg p-6 shadow-lg" style={{ minHeight: 140 }}>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full" style={{ background: accent ?? 'linear-gradient(135deg,#0fd,#60f)', boxShadow: '0 8px 30px rgba(80,40,160,0.2)' }} />
        <div>
          <h3 className="text-lg font-bold text-silver">{title}</h3>
          <p className="text-sm text-ghost mt-2">{desc}</p>
        </div>
      </div>
    </div>
  );
}
