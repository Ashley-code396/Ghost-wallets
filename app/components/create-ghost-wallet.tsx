"use client";

import { useState } from "react";
import { useWallet } from "../lib/wallet/context";
import { toast } from "sonner";
import { useSolanaClient } from "../lib/solana-client-context";
import { getCreateGhostWalletInstructionAsync } from "../generated/ghost_wallet/instructions";
import { GHOST_WALLET_PROGRAM_ADDRESS } from "../generated/ghost_wallet/programs/ghostWallet";
import { getBase64EncodedWireTransaction, createTransactionMessage, setTransactionMessageFeePayer, setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstruction, signAndSendTransactionMessageWithSigners, pipe } from "@solana/kit";
import type { Address } from "@solana/kit";
import { useCluster } from "./cluster-context";

export function CreateGhostWallet({ onCreated }: { onCreated?: () => void }) {
  const { wallet, signer } = useWallet();
  const client = useSolanaClient();
  const { getExplorerUrl } = useCluster();

  const [purpose, setPurpose] = useState("");
  const [duration, setDuration] = useState(60); // minutes
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) {
      toast.error("Please connect your wallet first");
      return;
    }
    if (!purpose) {
      toast.error("Please enter a purpose");
      return;
    }
    if (!signer) {
      toast.error("Wallet does not support signing");
      return;
    }

    try {
      setIsSubmitting(true);

      const durationSeconds = BigInt(duration * 60);
      const taskId = BigInt(Math.floor(Math.random() * 1000000));
      
      const ix = await getCreateGhostWalletInstructionAsync({
        creator: signer as any,
        taskId,
        purpose,
        durationSeconds,
      });

      // Snapshot current number of program accounts so we can wait until a new one appears
      let beforeCount = 0;
      try {
        const snapshot: any = await client.rpc.getProgramAccounts(GHOST_WALLET_PROGRAM_ADDRESS as any, { encoding: "base64" }).send();
        const list = Array.isArray(snapshot) ? snapshot : (snapshot?.value ?? []);
        beforeCount = list.length;
      } catch { }

      const latestBlockhash = await client.rpc.getLatestBlockhash().send();

      const txMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayer(signer.address as Address, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash.value, m),
        (m) => appendTransactionMessageInstruction(ix, m)
      );

      toast.info("Please approve the transaction in your wallet...");
      
      const signatures = await signAndSendTransactionMessageWithSigners(txMessage);
      
      toast.success("Ghost Wallet creation submitted!");

      // Wait for the on-chain account to appear (polling) before notifying the page to reload.
      const start = Date.now();
      const timeout = 15_000; // 15s
      let createdSeen = false;
      while (Date.now() - start < timeout) {
        try {
          const snap: any = await client.rpc.getProgramAccounts(GHOST_WALLET_PROGRAM_ADDRESS as any, { encoding: "base64" }).send();
          const list = Array.isArray(snap) ? snap : (snap?.value ?? []);
          if (list.length > beforeCount) {
            createdSeen = true;
            break;
          }
        } catch (e) {
          // ignore and retry
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (createdSeen) {
        if (onCreated) onCreated();
      } else {
        if (onCreated) onCreated();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to create wallet: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-faint-blue/20 bg-void p-6">
      <h2 className="text-xl font-bold text-silver mb-4">Create Ghost Wallet</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ghost mb-1">Purpose</label>
          <input
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            maxLength={64}
            className="w-full rounded-lg border border-faint-blue/30 bg-void px-4 py-2 text-silver focus:border-mist focus:outline-none"
            placeholder="e.g. Bounty Payment #123"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ghost mb-1">Duration (minutes): {duration}</label>
          <input
            type="range"
            min="1"
            max="1440"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
            className="w-full accent-mist"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !wallet}
          className="w-full rounded-lg bg-mist/10 px-4 py-2 font-medium text-mist transition hover:bg-mist/20 disabled:opacity-50"
        >
          {isSubmitting ? "Creating..." : "Create Ghost Wallet"}
        </button>
      </form>
    </div>
  );
}
