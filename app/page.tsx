"use client";

import { useEffect, useState } from "react";
import { lamports as sol } from "@solana/kit";
import { toast } from "sonner";
import { useWallet } from "./lib/wallet/context";
import { useSolanaClient } from "./lib/solana-client-context";
import { GridBackground } from "./components/grid-background";
import { ThemeToggle } from "./components/theme-toggle";
import { ClusterSelect } from "./components/cluster-select";
import { WalletButton } from "./components/wallet-button";
import { useCluster } from "./components/cluster-context";
import { CreateGhostWallet } from "./components/create-ghost-wallet";
import { GhostWalletCard } from "./components/ghost-wallet-card";
import { GhostActionsFeed } from "./components/ghost-actions-feed";

// Generated account helpers
import { GHOST_WALLET_PROGRAM_ADDRESS } from "./generated/ghost_wallet/programs/ghostWallet";
import { fetchAllMaybeGhostAction } from "./generated/ghost_wallet/accounts/ghostAction";
import { fetchAllMaybeGhostWallet } from "./generated/ghost_wallet/accounts/ghostWallet";

export default function Home() {
  const { wallet, status } = useWallet();
  const { cluster, getExplorerUrl } = useCluster();
  const client = useSolanaClient();
  const address = wallet?.account.address;

  // Replace mock data with fetched on-chain accounts (client-side only)
  const [wallets, setWallets] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);

  useEffect(() => {
    if (!client) return;

    let mounted = true;

    async function load() {
      try {
        // Fetch all accounts owned by the program via RPC
        const resp: any = await client.rpc.getProgramAccounts(GHOST_WALLET_PROGRAM_ADDRESS).send();
        const list = Array.isArray(resp) ? resp : (resp?.value ?? []);
        const addresses = list
          .map((it: any) => (it.pubkey?.toString ? it.pubkey.toString() : it.pubkey))
          .filter(Boolean);

        if (addresses.length === 0) {
          // nothing found on-chain yet
          return;
        }

        // Use generated helpers to fetch and decode accounts in bulk
        const maybeActions = await fetchAllMaybeGhostAction(client.rpc, addresses as any);
        const maybeWallets = await fetchAllMaybeGhostWallet(client.rpc, addresses as any);

        if (!mounted) return;

        const actionsDecoded = (maybeActions || [])
          .filter(Boolean)
          .map((acc: any) => ({
            actionType: Number(acc.account.actionType),
            amount: acc.account.amount,
            timestamp: Number(acc.account.timestamp),
            metadata: acc.account.metadata,
            wallet: acc.account.wallet,
          }));

        const walletsDecoded = (maybeWallets || [])
          .filter(Boolean)
          .map((acc: any) => ({
            purpose: acc.account.purpose,
            taskId: Number(acc.account.taskId),
            balance: acc.account.balance,
            expiresAt: Number(acc.account.expiresAt),
            status: Number(acc.account.status),
            creator: acc.account.creator?.toString?.() ?? null,
          }));

        setActions(actionsDecoded);
        setWallets(walletsDecoded);
      } catch (err) {
        // graceful fallback to empty lists
        console.warn("Failed to load on-chain accounts", err);
      }
    }

    void load();

    return () => { mounted = false; };
  }, [client]);

  return (
    <div className="relative min-h-screen bg-void text-silver">
      <GridBackground />

      <div className="relative z-10">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 border-b border-mist/10">
          <span className="text-xl font-bold tracking-tight text-mist">
            👻 Ghost Wallets
          </span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <ClusterSelect />
            <WalletButton />
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-12">
          <section className="mb-12">
            <div className="max-w-2xl">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4" style={{
                background: 'linear-gradient(90deg, #bfffbf 0%, #7aff7a 40%, #2fe114 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent'
              }}>
                Create ephemeral execution agents
              </h1>
              <p className="text-ghost text-lg">
                Task-based Ghost Wallets exist only for a defined purpose, then self-expire. All state lives on-chain.
              </p>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-8">
              <CreateGhostWallet />
              <GhostActionsFeed actions={actions} />
            </div>

            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-silver">Active Wallets</h2>
                <div className="text-sm text-ghost font-mono bg-void px-3 py-1 border border-border-low/10 rounded-full">
                  {wallets.filter(w => w.status === 0).length} active
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {wallets.map((w, i) => (
                  <GhostWalletCard 
                    key={i} 
                    wallet={w} 
                    onFund={() => toast.info("Fund clicked")}
                    onExecute={() => toast.info("Execute clicked")}
                  />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
