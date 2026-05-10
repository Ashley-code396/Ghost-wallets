"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { GridBackground } from "../components/grid-background";
import { ThemeToggle } from "../components/theme-toggle";
import { ClusterSelect } from "../components/cluster-select";
import { WalletButton } from "../components/wallet-button";
import { CreateGhostWallet } from "../components/create-ghost-wallet";
import { GhostActionsFeed } from "../components/ghost-actions-feed";
import { AdvancedGhostWalletCard } from "../components/advanced-ghost-wallet-card";
import { useSolanaClient } from "../lib/solana-client-context";
import { useProgramWatcher } from "../lib/hooks/use-program-watcher";
import { GHOST_WALLET_PROGRAM_ADDRESS } from "../generated/ghost_wallet/programs/ghostWallet";
import { fetchAllMaybeGhostWallet, getGhostWalletDiscriminatorBytes } from "../generated/ghost_wallet/accounts/ghostWallet";

export default function Dashboard() {
  const client = useSolanaClient();

  const [wallets, setWallets] = useState<any[]>([]);
  const [walletsLoading, setWalletsLoading] = useState<boolean>(true);
  const [actions, setActions] = useState<any[]>([]);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [programAccountCount, setProgramAccountCount] = useState<number>(0);
  const [consecutiveEmptyFetches, setConsecutiveEmptyFetches] = useState<number>(0);
  const WALLET_CACHE_KEY = "ghost_wallets_cache_v1";
  const MAX_EMPTY_FETCHES = 3; // require a few empties before clearing UI
  const hasFetchedRef = useRef(false);
  // pending updates from subscriptions are accumulated and flushed in a debounce
  const pendingWalletUpdatesRef = useRef<Map<number, any>>(new Map());
  const pendingFlushTimerRef = useRef<number | null>(null);
  // keep a ref to the latest wallets so async callbacks can read/merge reliably
  const walletsRef = useRef<any[]>([]);

  const reloadAccounts = useCallback(async () => {
    if (!client) return;
    if (!hasFetchedRef.current) setWalletsLoading(true);
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
        // If we already have a cached/merged wallet list, treat this as a transient discovery
        // hiccup and skip clearing/persist changes. Only increment the grace counter when
        // we have no client-side wallets to show.
        const haveLocal = Array.isArray(walletsRef.current) && walletsRef.current.length > 0;
        if (haveLocal) {
          console.debug('[reloadAccounts] discovered zero PDAs but local cache present — skipping clear');
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
          for (const p of prev) {
            if (p?.taskId != null) byTask.set(Number(p.taskId), p);
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

    // periodic prune of expired wallets to keep UI tidy
    const expireInterval = setInterval(() => {
      setWallets((prev) => {
        const now = Date.now();
        const kept = prev.filter((w) => !w.expiresAt || Number(w.expiresAt) * 1000 > now);
        if (kept.length !== prev.length) {
          try {
            if (typeof window !== 'undefined' && window.localStorage) {
              window.localStorage.setItem(WALLET_CACHE_KEY, JSON.stringify({ ts: Date.now(), wallets: kept }));
            }
          } catch (e) {}
        }
        return kept;
      });
    }, 10_000);

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
      clearInterval(expireInterval);
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
            <button onClick={() => { void reloadAccounts(); }} className="rounded px-3 py-1 bg-void border border-border-low text-ghost">Refresh</button>
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
                    <AdvancedGhostWalletCard key={w?.taskId ?? i} wallet={w} onFund={() => {}} onExecute={() => {}} />
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
