"use client";

import { useEffect, useState, useCallback } from "react";
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
import { useProgramWatcher } from "./lib/hooks/use-program-watcher";

// Generated account helpers
import { getFundGhostWalletInstruction, getExecuteActionInstruction } from "./generated/ghost_wallet/instructions";
import { getProgramDerivedAddress, getBytesEncoder, getAddressEncoder, getU64Encoder, createTransactionMessage, setTransactionMessageFeePayer, setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstruction, signAndSendTransactionMessageWithSigners, pipe } from "@solana/kit";
import type { Address } from "@solana/kit";

// Generated account helpers
import { GHOST_WALLET_PROGRAM_ADDRESS } from "./generated/ghost_wallet/programs/ghostWallet";
import { fetchAllMaybeGhostAction, getGhostActionDiscriminatorBytes } from "./generated/ghost_wallet/accounts/ghostAction";
import { fetchAllMaybeGhostWallet, getGhostWalletDiscriminatorBytes } from "./generated/ghost_wallet/accounts/ghostWallet";

export default function Home() {
  const { wallet, status } = useWallet();
  const { cluster, getExplorerUrl } = useCluster();
  const client = useSolanaClient();
  const address = wallet?.account.address;

  // Replace mock data with fetched on-chain accounts (client-side only)
  const [wallets, setWallets] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const { signer } = useWallet();

  const [fundingWallet, setFundingWallet] = useState<any>(null);
  const [fundAmount, setFundAmount] = useState("0.1");

  const [executingWallet, setExecutingWallet] = useState<any>(null);
  const [executeAmount, setExecuteAmount] = useState("0.05");
  const [executeMetadata, setExecuteMetadata] = useState("Payment");
  const reloadAccounts = useCallback(async () => {
    if (!client) return;
    try {
      const resp: any = await client.rpc.getProgramAccounts(GHOST_WALLET_PROGRAM_ADDRESS, { encoding: "base64" }).send();
  const list = Array.isArray(resp) ? resp : (resp?.value ?? []);
  console.debug("[reloadAccounts] discovered program accounts", list.length);

      // helper: convert base64 string to Uint8Array
      const base64ToUint8 = (b64: string) => {
        if (typeof atob === "function") {
          const bin = atob(b64);
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          return arr;
        }
        // Node fallback
        return Uint8Array.from(Buffer.from(b64, "base64"));
      };

  const actionDisc = Uint8Array.from(getGhostActionDiscriminatorBytes() as any);
  const walletDisc = Uint8Array.from(getGhostWalletDiscriminatorBytes() as any);

      const actionAddrs: string[] = [];
      const walletAddrs: string[] = [];

      for (const it of list) {
        const pubkey = it.pubkey?.toString?.() ?? it.pubkey ?? it?.account?.pubkey ?? null;
        const dataField = it.account?.data ?? it.data ?? null;
        const encoded = Array.isArray(dataField) ? dataField[0] : dataField?.[0] ?? null;
        if (!pubkey) continue;
        if (!encoded) continue;
        try {
          const bytes = base64ToUint8(encoded);
          const prefix = bytes.slice(0, 8);
          const equal = (a: Uint8Array | Uint8Array, b: Uint8Array | Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);
          if (equal(prefix, actionDisc)) actionAddrs.push(pubkey);
          else if (equal(prefix, walletDisc)) walletAddrs.push(pubkey);
        } catch (e) {
          // skip malformed
        }
      }

      console.debug("[reloadAccounts] actionAddrs", actionAddrs.length, "walletAddrs", walletAddrs.length);

      if (actionAddrs.length === 0 && walletAddrs.length === 0) {
        setActions([]);
        setWallets([]);
        return;
      }

      const fetchConfig = { encoding: "base64" } as any;
      const maybeActions = actionAddrs.length > 0 ? await fetchAllMaybeGhostAction(client.rpc, actionAddrs as any, fetchConfig) : [];
      const maybeWallets = walletAddrs.length > 0 ? await fetchAllMaybeGhostWallet(client.rpc, walletAddrs as any, fetchConfig) : [];

      const actionsDecoded = (maybeActions || [])
        .filter((acc: any) => acc?.exists)
        .map((acc: any) => ({
          actionType: Number(acc.data.actionType),
          amount: acc.data.amount,
          timestamp: Number(acc.data.timestamp),
          metadata: acc.data.metadata,
          wallet: acc.data.wallet,
        }));

      const walletsDecoded = (maybeWallets || [])
        .filter((acc: any) => acc?.exists)
        .map((acc: any) => ({
          pubkey: acc.address || acc.pubkey,
          purpose: acc.data.purpose,
          taskId: Number(acc.data.taskId),
          balance: acc.data.balance,
          expiresAt: Number(acc.data.expiresAt),
          status: Number(acc.data.status),
          actionCount: Number(acc.data.actionCount),
          creator: acc.data.creator?.toString?.() ?? null,
        }));

      setActions(actionsDecoded);
      setWallets(walletsDecoded);
    } catch (err) {
      console.warn("Failed to reload on-chain accounts", err);
    }
  }, [client]);

  // incremental updates via program watcher
  useProgramWatcher(client, GHOST_WALLET_PROGRAM_ADDRESS, {
    onAction(account, pubkey) {
      setActions((prev) => {
        const exists = prev.find((p) => p.pubkey === pubkey && Number(p.timestamp) === Number(account.timestamp));
        if (exists) return prev;
        const next = [{
          pubkey,
          actionType: Number(account.actionType),
          amount: account.amount,
          timestamp: Number(account.timestamp),
          metadata: account.metadata,
          wallet: account.wallet,
        }, ...prev];
        return next.slice(0, 200);
      });
    },
    onWallet(account, pubkey) {
      setWallets((prev) => {
        const exists = prev.find((p) => p.taskId === Number(account.taskId));
        if (exists) {
          // patch existing
          return prev.map((p) => p.taskId === Number(account.taskId) ? {
            ...p,
            purpose: account.purpose,
            balance: account.balance,
            expiresAt: Number(account.expiresAt),
            status: Number(account.status),
            actionCount: Number(account.actionCount),
            creator: account.creator?.toString?.() ?? null,
          } : p);
        }
        const next = [{
          pubkey,
          purpose: account.purpose,
          taskId: Number(account.taskId),
          balance: account.balance,
          expiresAt: Number(account.expiresAt),
          status: Number(account.status),
          actionCount: Number(account.actionCount),
          creator: account.creator?.toString?.() ?? null,
        }, ...prev];
        return next.slice(0, 200);
      });
    }
  });

  useEffect(() => {
    if (!client) return;

    let mounted = true;
    const abortController = new AbortController();

    const run = async () => {
      try {
        // initial load
        await reloadAccounts();

        // set up account subscriptions for live updates
        const resp: any = await client.rpc.getProgramAccounts(GHOST_WALLET_PROGRAM_ADDRESS, { encoding: "base64" }).send();
        const list = Array.isArray(resp) ? resp : (resp?.value ?? []);
        const addresses = list
          .map((it: any) => (it.pubkey?.toString ? it.pubkey.toString() : it.pubkey))
          .filter(Boolean);

        if (addresses.length === 0) return;

        for (const addr of addresses) {
          try {
            const notifications = await client.rpcSubscriptions
              .accountNotifications(addr, { commitment: "confirmed" })
              .subscribe({ abortSignal: abortController.signal });

            (async () => {
              try {
                for await (const _n of notifications) {
                  if (!mounted) return;
                  // On any account notification, refresh lists
                  await reloadAccounts();
                }
              } catch (e) {
                // swallow, subscriptions will be cleaned up on abort
              }
            })();
          } catch (e) {
            // ignore subscription errors per-address
          }
        }
      } catch (err) {
        console.warn("Failed to initialize account subscriptions", err);
      }
    };

    void run();

    return () => {
      mounted = false;
      abortController.abort();
    };
  }, [client, reloadAccounts]);

  

  
  const handleFundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundingWallet || !signer) return;
    try {
      const amount = BigInt(parseFloat(fundAmount) * 1e9);
      const [actionPda] = await getProgramDerivedAddress({
        programAddress: GHOST_WALLET_PROGRAM_ADDRESS as Address,
        seeds: [
          getBytesEncoder().encode(new Uint8Array([97, 99, 116, 105, 111, 110])),
          getAddressEncoder().encode(fundingWallet.pubkey),
          getU64Encoder().encode(fundingWallet.actionCount),
        ],
      });
      const ix = getFundGhostWalletInstruction({
        funder: signer as any,
        wallet: fundingWallet.pubkey as any,
        action: actionPda,
        amount,
      });

      const latestBlockhash = await client.rpc.getLatestBlockhash().send();
      const txMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayer(signer.address as Address, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash.value, m),
        (m) => appendTransactionMessageInstruction(ix, m)
      );

      toast.info("Please approve funding transaction...");
      await signAndSendTransactionMessageWithSigners(txMessage);
      toast.success("Ghost Wallet funded successfully!");
      setFundingWallet(null);
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to fund: ${err.message}`);
    }
  };

  const handleExecuteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!executingWallet || !signer) return;
    try {
      const amount = BigInt(parseFloat(executeAmount) * 1e9);
      // For demo, just send it back to the creator, or some random address. Let's send to creator.
      const recipient = executingWallet.creator as Address;
      const [actionPda] = await getProgramDerivedAddress({
        programAddress: GHOST_WALLET_PROGRAM_ADDRESS as Address,
        seeds: [
          getBytesEncoder().encode(new Uint8Array([97, 99, 116, 105, 111, 110])),
          getAddressEncoder().encode(executingWallet.pubkey),
          getU64Encoder().encode(executingWallet.actionCount),
        ],
      });
      const ix = getExecuteActionInstruction({
        creator: signer as any,
        wallet: executingWallet.pubkey as any,
        recipient,
        action: actionPda,
        amount,
        metadata: executeMetadata,
      });

      const latestBlockhash = await client.rpc.getLatestBlockhash().send();
      const txMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayer(signer.address as Address, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash.value, m),
        (m) => appendTransactionMessageInstruction(ix, m)
      );

      toast.info("Please approve execute transaction...");
      await signAndSendTransactionMessageWithSigners(txMessage);
      toast.success("Ghost Wallet action executed!");
      setExecutingWallet(null);
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to execute: ${err.message}`);
    }
  };


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
              <CreateGhostWallet onCreated={reloadAccounts} />
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
                    onFund={() => setFundingWallet(w)}
                    onExecute={() => setExecutingWallet(w)}
                  />
                ))}
              </div>
            </div>
          </div>
        
              {fundingWallet && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 backdrop-blur-sm p-4">
                  <div className="w-full max-w-md rounded-xl border border-mist/30 bg-void p-6 shadow-2xl">
                    <h3 className="text-xl font-bold text-silver mb-4">Fund Wallet</h3>
                    <p className="text-sm text-ghost mb-4">Funding ID: {fundingWallet.taskId}</p>
                    <form onSubmit={handleFundSubmit} className="space-y-4">
                      <div>
                        <label className="block text-sm text-mist mb-1">Amount (SOL)</label>
                        <input type="number" step="0.01" value={fundAmount} onChange={e => setFundAmount(e.target.value)} className="w-full rounded bg-void border border-mist/30 px-3 py-2 text-silver" />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setFundingWallet(null)} className="flex-1 rounded border border-faint-blue/20 py-2 text-ghost hover:text-silver">Cancel</button>
                        <button type="submit" className="flex-1 rounded bg-mist/20 py-2 text-mist font-bold hover:bg-mist/30">Confirm Fund</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {executingWallet && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 backdrop-blur-sm p-4">
                  <div className="w-full max-w-md rounded-xl border border-mist/30 bg-void p-6 shadow-2xl">
                    <h3 className="text-xl font-bold text-silver mb-4">Execute Action</h3>
                    <form onSubmit={handleExecuteSubmit} className="space-y-4">
                      <div>
                        <label className="block text-sm text-mist mb-1">Amount (SOL)</label>
                        <input type="number" step="0.01" value={executeAmount} onChange={e => setExecuteAmount(e.target.value)} className="w-full rounded bg-void border border-mist/30 px-3 py-2 text-silver" />
                      </div>
                      <div>
                        <label className="block text-sm text-mist mb-1">Metadata (Reason)</label>
                        <input type="text" value={executeMetadata} onChange={e => setExecuteMetadata(e.target.value)} className="w-full rounded bg-void border border-mist/30 px-3 py-2 text-silver" />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setExecutingWallet(null)} className="flex-1 rounded border border-faint-blue/20 py-2 text-ghost hover:text-silver">Cancel</button>
                        <button type="submit" className="flex-1 rounded bg-silver text-void py-2 font-bold hover:bg-white">Confirm Execute</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

        </main>
      </div>
    </div>
  );
}
