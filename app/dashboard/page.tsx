"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { GridBackground } from "../components/grid-background";
import { ThemeToggle } from "../components/theme-toggle";
import { ClusterSelect } from "../components/cluster-select";
import { WalletButton } from "../components/wallet-button";
import { CreateGhostWallet } from "../components/create-ghost-wallet";
import { GhostActionsFeed } from "../components/ghost-actions-feed";
import { GhostWalletCard } from "../components/ghost-wallet-card";
import { useSolanaClient } from "../lib/solana-client-context";
import { useCluster } from "../components/cluster-context";
import { useProgramWatcher } from "../lib/hooks/use-program-watcher";
import { GHOST_WALLET_PROGRAM_ADDRESS } from "../generated/ghost_wallet/programs/ghostWallet";
import { fetchAllMaybeGhostWallet, getGhostWalletDiscriminatorBytes } from "../generated/ghost_wallet/accounts/ghostWallet";
import { useWallet } from "../lib/wallet/context";
import { toast } from "sonner";
import { getFundGhostWalletInstruction } from "../generated/ghost_wallet/instructions";
import { createTransactionMessage, setTransactionMessageFeePayer, setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstruction, signAndSendTransactionMessageWithSigners, pipe, getProgramDerivedAddress, getAddressEncoder } from "@solana/kit";

export default function Dashboard() {
  const client = useSolanaClient();
  const { cluster } = useCluster();
  const { wallet, signer } = useWallet();

  const [wallets, setWallets] = useState<any[]>([]);
  const [walletsLoading, setWalletsLoading] = useState<boolean>(true);
  const [actions, setActions] = useState<any[]>([]);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [programAccountCount, setProgramAccountCount] = useState<number>(0);
  const [consecutiveEmptyFetches, setConsecutiveEmptyFetches] = useState<number>(0);
  const WALLET_CACHE_KEY = `ghost_wallets_cache_v1_${cluster}`;
  const MAX_EMPTY_FETCHES = 3; // require a few empties before clearing UI
  const hasFetchedRef = useRef(false);
  // pending updates from subscriptions are accumulated and flushed in a debounce
  const pendingWalletUpdatesRef = useRef<Map<number, any>>(new Map());
  const pendingFlushTimerRef = useRef<number | null>(null);
  // keep a ref to the latest wallets so async callbacks can read/merge reliably
  const walletsRef = useRef<any[]>([]);

  const handleFund = async (ghostWallet: any, amountStr: string) => {
    if (!wallet || !signer) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!amountStr) return;
    const amountSol = parseFloat(amountStr);
    if (isNaN(amountSol) || amountSol <= 0) {
      toast.error("Invalid amount");
      return;
    }

    try {
      const lamports = BigInt(Math.floor(amountSol * 1_000_000_000));
      
      const actionCountBuffer = new ArrayBuffer(8);
      new DataView(actionCountBuffer).setBigUint64(0, BigInt(ghostWallet.actionCount), true); // little endian

      const [actionPda] = await getProgramDerivedAddress({
        programAddress: GHOST_WALLET_PROGRAM_ADDRESS as any,
        seeds: [
          new TextEncoder().encode("action"),
          getAddressEncoder().encode(ghostWallet.pubkey),
          new Uint8Array(actionCountBuffer),
        ],
      });

      const ix = getFundGhostWalletInstruction({
        funder: signer as any,
        wallet: ghostWallet.pubkey as any,
        action: actionPda,
        amount: lamports,
      });

      const latestBlockhash = await client!.rpc.getLatestBlockhash().send();

      const txMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayer(signer.address as any, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash.value, m),
        (m) => appendTransactionMessageInstruction(ix, m)
      );

      toast.info("Please approve the funding transaction...");
      await signAndSendTransactionMessageWithSigners(txMessage);
      toast.success(`Funded ${amountSol} SOL successfully!`);
      // Reload isn't strictly necessary if watcher is fast, but good for safety
      void reloadAccounts(true);
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to fund: ${err.message || 'Unknown error'}`);
    }
  };

  const reloadAccounts = useCallback(async (isManual = false) => {
    if (!client) return;
    console.debug('[reloadAccounts] start (hasFetchedRef=', hasFetchedRef.current, ', walletsRef=', walletsRef.current.length, ')');
    if (!hasFetchedRef.current || isManual) setWalletsLoading(true);
  try {
  const resp: any = await client.rpc.getProgramAccounts(GHOST_WALLET_PROGRAM_ADDRESS, { encoding: "base64" }).send();
  const list = Array.isArray(resp) ? resp : (resp?.value ?? []);
  console.debug('[reloadAccounts] program accounts fetched', list.length);
  setProgramAccountCount(list.length ?? 0);

      const base64ToUint8 = (b64: string) => {
        if (typeof atob === "function") {
          const bin = atob(b64);
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          return arr;
        }
        return Uint8Array.from(Buffer.from(b64, "base64"));
      };

      const walletDisc = Uint8Array.from(getGhostWalletDiscriminatorBytes() as any);

      const walletAddrs: string[] = [];
      for (const it of list) {
        const pubkey = it.pubkey?.toString?.() ?? it.pubkey ?? it?.account?.pubkey ?? null;
        const dataField = it.account?.data ?? it.data ?? null;
        const encoded = Array.isArray(dataField) ? dataField[0] : dataField?.[0] ?? null;
        if (!pubkey || !encoded) continue;
        try {
          const bytes = base64ToUint8(encoded);
          const prefix = bytes.slice(0, 8);
          const equal = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);
          if (equal(prefix, walletDisc)) walletAddrs.push(pubkey);
        } catch (e) {
          // ignore malformed
        }
      }

      if (walletAddrs.length === 0) {
        if (isManual) {
          console.debug('[reloadAccounts] manual refresh with 0 PDAs, clearing wallets immediately');
          setWallets([]);
          setConsecutiveEmptyFetches(0);
          try {
            if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(WALLET_CACHE_KEY);
          } catch (e) {}
          return;
        }

        // don't immediately clear the UI on a single empty RPC response.
        // increment a grace counter and only clear after repeated empties.
        setConsecutiveEmptyFetches((prev) => {
          const next = prev + 1;
          console.debug('[reloadAccounts] empty walletAddrs, consecutiveEmptyFetches ->', next);
          if (next >= MAX_EMPTY_FETCHES) {
            console.debug('[reloadAccounts] reached empty threshold, clearing wallets');
            setWallets([]);
            try {
              if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(WALLET_CACHE_KEY);
              console.debug('[reloadAccounts] removed WALLET_CACHE_KEY from localStorage (no PDAs)');
            } catch (e) {
              // ignore storage errors
            }
          }
          return next;
        });
        return;
      }

      const fetchConfig = { encoding: "base64" } as any;
      const maybeWallets = await fetchAllMaybeGhostWallet(client.rpc, walletAddrs as any, fetchConfig);
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

      // only treat this as a valid replacement if we decoded at least one wallet
      if (walletsDecoded.length > 0) {
        setConsecutiveEmptyFetches(0);
        // merge decoded wallets into previous state instead of blind replace to avoid flicker
        try {
          const prev = Array.isArray(walletsRef.current) ? walletsRef.current : [];
          const byTask = new Map<number, any>();
          const decodedKeys = new Set(walletsDecoded.map(w => Number(w.taskId)));
          const now = Date.now();
          for (const p of prev) {
            if (p?.taskId != null) {
              const key = Number(p.taskId);
              // Only keep if it still exists on-chain OR was optimistically updated recently
              if (decodedKeys.has(key) || (p._optimistic && now - p._optimistic < 15000)) {
                byTask.set(key, p);
              }
            }
          }
          for (const w of walletsDecoded) {
            const key = Number(w.taskId);
            const existing = byTask.get(key);
            if (existing) byTask.set(key, { ...existing, ...w });
            else byTask.set(key, w);
          }
          const merged = Array.from(byTask.values()).sort((a, b) => (b.expiresAt || 0) - (a.expiresAt || 0));
          const finalList = merged.slice(0, 200);
          setWallets(finalList);
          setLastSync(Date.now());
          console.debug('[reloadAccounts] decoded wallets', walletsDecoded.length);
          try {
            if (typeof window !== 'undefined' && window.localStorage) {
              // persist the merged view (not just the newly-decoded subset)
                window.localStorage.setItem(WALLET_CACHE_KEY, JSON.stringify({ ts: Date.now(), wallets: finalList }));
                console.debug('[reloadAccounts] persisted WALLET_CACHE_KEY with', finalList.length, 'items');
            }
          } catch (e) {
            // ignore storage errors
          }
        } catch (e) {
          // fallback to previous behavior if something unexpected happens
          setWallets(walletsDecoded.slice(0, 200));
        }
      } else {
        // decoded zero wallets despite matching PDAs — don't overwrite UI, just increment grace counter
        setConsecutiveEmptyFetches((prev) => {
          const next = prev + 1;
          console.debug('[reloadAccounts] decoded zero wallets, consecutiveEmptyFetches ->', next);
          if (next >= MAX_EMPTY_FETCHES) {
            console.debug('[reloadAccounts] reached empty threshold, clearing wallets');
            setWallets([]);
            try {
              if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(WALLET_CACHE_KEY);
              console.debug('[reloadAccounts] removed WALLET_CACHE_KEY from localStorage (decoded zero)');
            } catch (e) {}
          }
          return next;
        });
      }
    } catch (err) {
      console.warn("Failed to reload on-chain accounts", err);
    }
    finally {
      if (!hasFetchedRef.current) {
        hasFetchedRef.current = true;
        setWalletsLoading(false);
      }
    }
  }, [client]);

  // program watcher for incremental updates
  useProgramWatcher(client, GHOST_WALLET_PROGRAM_ADDRESS, {
    onAction(account: any, pubkey: string) {
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
    onWallet(account: any, pubkey: string) {
      // debounce and merge live updates instead of replacing state
      try {
        const taskId = Number(account.taskId);
        const entry = {
          pubkey,
          purpose: account.purpose,
          taskId,
          balance: account.balance,
          expiresAt: Number(account.expiresAt),
          status: Number(account.status),
          actionCount: Number(account.actionCount),
          creator: account.creator?.toString?.() ?? null,
          _optimistic: Date.now(),
        };
        const map = pendingWalletUpdatesRef.current;
        map.set(taskId, { ...(map.get(taskId) || {}), ...entry });

        // schedule flush
        if (pendingFlushTimerRef.current) {
          window.clearTimeout(pendingFlushTimerRef.current);
        }
        pendingFlushTimerRef.current = window.setTimeout(() => {
          const updates = Array.from(pendingWalletUpdatesRef.current.values());
          pendingWalletUpdatesRef.current.clear();
          pendingFlushTimerRef.current = null;
          try {
            const prev = Array.isArray(walletsRef.current) ? walletsRef.current : [];
            const byTask = new Map<number, any>();
            for (const p of prev) if (p?.taskId != null) byTask.set(Number(p.taskId), p);
            for (const u of updates) {
              const key = Number(u.taskId);
              const existing = byTask.get(key);
              if (existing) byTask.set(key, { ...existing, ...u });
              else byTask.set(key, u);
            }
            const merged = Array.from(byTask.values()).sort((a, b) => (b.expiresAt || 0) - (a.expiresAt || 0));
            const finalList = merged.slice(0, 200);
            // persist optimistic cache
            try {
              if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(WALLET_CACHE_KEY, JSON.stringify({ ts: Date.now(), wallets: finalList }));
              }
            } catch (e) {}
            setWallets(finalList);
          } catch (e) {
            // fallback: clear pending but don't crash
            setWallets((prev) => prev.slice(0, 200));
          }
        }, 300);
      } catch (e) {
        // swallow
      }
    }
  });

  useEffect(() => {
    if (!client) return;
    let mounted = true;
    const abortController = new AbortController();

    // hydrate wallets from cache so transient RPC gaps don't blank the UI on first render
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(WALLET_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.wallets && Array.isArray(parsed.wallets) && parsed.wallets.length > 0) {
            // set both state and the ref immediately so async discovery won't treat
            // the UI as empty while the hydration completes (fixes non-persistent cards)
            walletsRef.current = parsed.wallets;
            setWallets(parsed.wallets);
            setLastSync(parsed.ts || Date.now());
            setConsecutiveEmptyFetches(0);
            console.debug('[dashboard] hydrated wallets from cache', parsed.wallets.length, 'items');
          }
        }
      }
    } catch (e) {
      // ignore
    }

    const run = async () => {
      try {
        // initial load only; live updates are handled by useProgramWatcher
        await reloadAccounts();
      } catch (err) {
        console.warn("Failed to initialize account discovery", err);
      }
    };

    void run();

    return () => {
      mounted = false;
      abortController.abort();
      if (pendingFlushTimerRef.current) {
        window.clearTimeout(pendingFlushTimerRef.current);
        pendingFlushTimerRef.current = null;
      }
    };
  }, [client, reloadAccounts]);

  // keep walletsRef in sync so async callbacks can read the current state
  useEffect(() => {
    walletsRef.current = wallets;
  }, [wallets]);

  return (
    <div className="relative min-h-screen bg-void text-silver">
      <GridBackground />
      <div className="relative z-10">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 border-b border-mist/10">
          <div>
            <div className="text-xl font-bold tracking-tight text-mist">👻 Ghost Wallets — Dashboard</div>
            <div className="text-xs text-ghost mt-1">Program accounts: {programAccountCount} {lastSync ? `• last sync ${new Date(lastSync).toLocaleTimeString()}` : ''}</div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { void reloadAccounts(true); }} className="rounded px-3 py-1 bg-void border border-border-low text-ghost hover:text-mist transition-colors">Refresh</button>
            <ThemeToggle />
            <ClusterSelect />
            <WalletButton />
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-8">
              <CreateGhostWallet onCreated={reloadAccounts} />
              <GhostActionsFeed actions={actions} />
            </div>

            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-silver">Active Wallets</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {wallets.length === 0 && walletsLoading ? (
                  // render lightweight skeleton placeholders while loading (avoid flash)
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-36 rounded-xl border border-faint-blue/10 bg-void/30 animate-pulse" />
                  ))
                ) : (
                  wallets.map((w, i) => (
                    <GhostWalletCard key={w?.taskId ?? i} wallet={w} onFund={(amountStr: string) => handleFund(w, amountStr)} onExecute={() => {}} />
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
