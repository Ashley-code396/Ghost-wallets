"use client";

import { useEffect, useRef, useState } from "react";

export function Hero({ onCreate }: { onCreate?: () => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cursorLightRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const container = containerRef.current;
    const light = cursorLightRef.current;
    if (!container || !light) return;

    function onMove(e: MouseEvent) {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (light) {
        light.style.setProperty('--x', x + 'px');
        light.style.setProperty('--y', y + 'px');
      }
    }

    function onLeave() {
      if (light) {
        light.style.setProperty('--x', '50%');
        light.style.setProperty('--y', '50%');
      }
    }

    container.addEventListener('mousemove', onMove);
    container.addEventListener('mouseleave', onLeave);
    return () => {
      container.removeEventListener('mousemove', onMove);
      container.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <section ref={containerRef} className="relative ghost-ui-root noise-overlay scanlines overflow-hidden rounded-xl mb-12">
      <div className="particle-layer" aria-hidden>
        {/* generate lightweight CSS particles */}
        {Array.from({ length: 28 }).map((_, i) => (
          <div key={i} className="particle" style={{ left: `${Math.random()*100}%`, top: `${Math.random()*100}%`, width: `${4+Math.random()*8}px`, height: `${4+Math.random()*8}px`, opacity: 0.04 + Math.random()*0.2, transform: `translateZ(${Math.random()*100}px)` }} />
        ))}
      </div>

      <div ref={cursorLightRef} className="cursor-light" style={{ position: 'absolute', pointerEvents: 'none', maskImage: 'radial-gradient(circle at var(--x,50%) var(--y,50%), rgba(0,0,0,1) 0px, rgba(0,0,0,0.2) 120px, transparent 250px)' }}>
        <div style={{ position: 'absolute', left: 'var(--x,50%)', top: 'var(--y,50%)', width: 420, height: 420, marginLeft: -210, marginTop: -210, borderRadius: '50%', background: 'radial-gradient(circle, rgba(60,200,255,0.12), rgba(140,60,255,0.06) 40%, transparent 60%)', filter: 'blur(40px)', mixBlendMode: 'screen' }} />
      </div>

      <div className="relative z-10 px-8 py-24 flex flex-col items-center text-center">
        <h1 className="ghost-title text-7xl md:text-[5.5rem] leading-tight mb-4" style={{
          background: 'linear-gradient(90deg, #9ef0ff 0%, #a77bff 35%, #e6f6ff 100%)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'
        }}>
          Ghost Wallets
        </h1>
        <p className="text-lg text-ghost max-w-2xl opacity-90 mb-8" style={{ filter: 'drop-shadow(0 12px 40px rgba(80,20,140,0.45))' }}>
          Ephemeral identities for autonomous finance — mission-first wallets that self-expire on command.
        </p>

        <div className="relative w-[420px] h-[420px] mb-8 flex items-center justify-center">
          {/* central holographic core */}
          <div className="animated-border rounded-full glow-pulse" style={{ width: 260, height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="holo-card rounded-full flex items-center justify-center" style={{ width: 240, height: 240 }}>
              <div className="relative w-full h-full flex items-center justify-center">
                <svg viewBox="0 0 120 120" width="160" height="160" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <radialGradient id="g1"><stop offset="0%" stopColor="#dffcff" stopOpacity="0.95"/><stop offset="60%" stopColor="#7a5cff" stopOpacity="0.08"/><stop offset="100%" stopColor="#000000" stopOpacity="0"/></radialGradient>
                  </defs>
                  <circle cx="60" cy="60" r="30" fill="url(#g1)" />
                  <g stroke="#9be6ff" strokeOpacity="0.45" strokeWidth="0.8" fill="none">
                    <circle cx="60" cy="60" r="38" />
                    <circle cx="60" cy="60" r="52" strokeOpacity="0.08" />
                  </g>
                </svg>
                <div className="absolute text-center text-sm font-mono text-ghost" style={{ top: '66%', transform: 'translateY(-50%)', opacity: 0.9 }}>
                  <div style={{ fontSize: 12, letterSpacing: 2, opacity: 0.9 }}>ENCRYPTED CORE</div>
                </div>
              </div>
            </div>
          </div>

          {/* animated network lines */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 420 420" preserveAspectRatio="none" aria-hidden>
            <g stroke="#6ff2ff" strokeOpacity="0.07" strokeWidth="1">
              <path d="M10 200 C120 10, 300 10, 410 200" strokeDasharray="8 6" />
              <path d="M10 220 C120 410, 300 410, 410 220" strokeDasharray="6 6" />
            </g>
          </svg>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={onCreate} className="px-6 py-3 rounded-lg font-bold text-void bg-gradient-to-r from-[#9ef0ff] via-[#a77bff] to-[#d1f8ff] hover:scale-[1.02] transition-transform shadow-[0_8px_40px_rgba(120,80,200,0.35)]">
            Create Ghost Wallet
          </button>
          <button className="px-5 py-3 rounded-lg border border-faint-blue/20 text-ghost font-mono bg-void hover:bg-white/2 transition">Decrypt Mission</button>
        </div>
      </div>
    </section>
  );
}
