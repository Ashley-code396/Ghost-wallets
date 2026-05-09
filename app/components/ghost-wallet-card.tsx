"use client";

import { useEffect, useState } from "react";
import { lamportsToSolString } from "../lib/lamports";

export function GhostWalletCard({ wallet, onFund, onExecute }: any) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = Number(wallet.expiresAt) - now;
      setTimeLeft(Math.max(0, remaining));
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [wallet.expiresAt]);

  const isExpired = wallet.status === 1 || timeLeft === 0;
  const isNearExpiry = !isExpired && timeLeft < 3600;

  const statusColor = isExpired ? "text-faint-blue" : isNearExpiry ? "text-mist animate-pulse" : "text-mist";
  const glowClass = isExpired ? "grayscale blur-[1px] opacity-60" : isNearExpiry ? "shadow-[0_0_15px_rgba(207,214,221,0.2)] border-mist/50" : "shadow-[0_0_10px_rgba(125,143,163,0.3)] border-faint-blue/30";

  return (
    <div className={`relative rounded-xl border bg-void p-6 transition-all duration-1000 ${glowClass}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-silver">{wallet.purpose}</h3>
          <p className="text-xs text-ghost font-mono mt-1">ID: {wallet.taskId.toString()}</p>
        </div>
        <div className={`px-2 py-1 rounded text-xs font-mono font-medium ${isExpired ? "bg-faint-blue/10 text-faint-blue" : "bg-mist/10 text-mist"}`}>
          {isExpired ? "EXPIRED" : "ACTIVE"}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-xs text-ghost uppercase tracking-wider">Balance</p>
            <p className="text-2xl font-mono text-silver">{lamportsToSolString(wallet.balance)} SOL</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-ghost uppercase tracking-wider">Time Remaining</p>
            <p className={`font-mono ${statusColor}`}>
              {Math.floor(timeLeft / 3600)}h {Math.floor((timeLeft % 3600) / 60)}m {timeLeft % 60}s
            </p>
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t border-faint-blue/10">
          <button 
            onClick={onFund}
            disabled={isExpired}
            className="flex-1 rounded border border-mist/30 bg-mist/5 py-1.5 text-sm font-medium text-mist transition hover:bg-mist/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Fund
          </button>
          <button 
            onClick={onExecute}
            disabled={isExpired || wallet.balance === 0n}
            className="flex-1 rounded bg-silver text-void py-1.5 text-sm font-bold transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Execute
          </button>
        </div>
      </div>
    </div>
  );
}
