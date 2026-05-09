"use client";

import { useEffect, useState } from "react";
import { lamportsToSolString } from "../lib/lamports";
import { ellipsify } from "../lib/explorer";
import { useCluster } from "./cluster-context";

export function GhostActionsFeed({ actions }: any) {
  const { getExplorerUrl } = useCluster();
  
  return (
    <div className="rounded-xl border border-faint-blue/20 bg-void p-6 mt-8">
      <h2 className="text-xl font-bold text-silver mb-4 flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mist opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-mist"></span>
        </span>
        Live Actions Feed
      </h2>
      
      {actions.length === 0 ? (
        <p className="text-sm text-ghost italic py-4 text-center">No actions recorded yet.</p>
      ) : (
        <div className="space-y-3">
          {actions.map((action: any, i: number) => (
            <ActionRow key={i} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActionRow({ action }: { action: any }) {
  const date = new Date(Number(action.timestamp) * 1000);
  const [timeString, setTimeString] = useState<string | null>(null);

  useEffect(() => {
    // run only on client to avoid SSR/CSR locale mismatches
    setTimeString(date.toLocaleTimeString());
  }, [action.timestamp]);

  let actionName = "UNKNOWN";
  let colorClass = "text-ghost";
  if (action.actionType === 0) { actionName = "FUND"; colorClass = "text-emerald-400"; }
  else if (action.actionType === 1) { actionName = "EXECUTE"; colorClass = "text-mist"; }
  else if (action.actionType === 2) { actionName = "EXPIRED"; colorClass = "text-faint-blue"; }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-void border border-border-low/5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`text-xs font-bold font-mono px-2 py-1 rounded bg-white/5 ${colorClass}`}>
          {actionName}
        </div>
        <div>
          <p className="text-sm text-silver">{action.metadata}</p>
          <p className="text-xs text-ghost font-mono">
            Wallet: {ellipsify(action.wallet.toString(), 4)}
          </p>
        </div>
      </div>

      <div className="mt-2 sm:mt-0 text-right">
        {action.amount > 0 && (
          <p className="text-sm font-mono text-silver">
            {action.actionType === 1 ? "-" : "+"}{lamportsToSolString(action.amount)} SOL
          </p>
        )}
        <p className="text-xs text-ghost">{timeString ?? "—"}</p>
      </div>
    </div>   
  );
}
