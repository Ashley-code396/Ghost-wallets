"use client";

import { useEffect } from "react";
import type { SolanaClient } from "../solana-client";
import { fetchMaybeGhostAction } from "../../generated/ghost_wallet/accounts/ghostAction";
import { fetchMaybeGhostWallet } from "../../generated/ghost_wallet/accounts/ghostWallet";

type Handlers = {
  onAction?: (account: any, pubkey: string) => void;
  onWallet?: (account: any, pubkey: string) => void;
};

export function useProgramWatcher(client: SolanaClient | null, programAddress: string, handlers: Handlers) {
  useEffect(() => {
    if (!client) return;

    const cl = client;
    let mounted = true;
    const abortController = new AbortController();

    const subscribed = new Set<string>();

    async function subscribeAddress(addr: string) {
      if (!mounted || subscribed.has(addr)) return;
      subscribed.add(addr);

      console.debug("[useProgramWatcher] subscribing to", addr);

      // initial fetch/emit for this address
      try {
        const ma = await fetchMaybeGhostAction(cl.rpc, addr as any);
        const maAccount = (ma as any)?.data;
        if (maAccount && mounted) {
          console.debug("[useProgramWatcher] initial action emit", addr, maAccount);
          handlers.onAction?.(maAccount, addr);
        }
      } catch {}
      try {
        const mw = await fetchMaybeGhostWallet(cl.rpc, addr as any);
        const mwAccount = (mw as any)?.data;
        if (mwAccount && mounted) {
          console.debug("[useProgramWatcher] initial wallet emit", addr, mwAccount);
          handlers.onWallet?.(mwAccount, addr);
        }
      } catch {}

      // subscribe to account notifications for live updates
      try {
        const notifications = await (cl.rpcSubscriptions as any)
          .accountNotifications(addr as any, { commitment: "confirmed" })
          .subscribe({ abortSignal: abortController.signal });

        (async () => {
          try {
            for await (const n of notifications) {
              if (!mounted) return;
              console.debug("[useProgramWatcher] notification for", addr, n);
              try {
                const ma2 = await fetchMaybeGhostAction(cl.rpc, addr as any);
                const ma2Account = (ma2 as any)?.data;
                if (ma2Account && mounted) handlers.onAction?.(ma2Account, addr);
              } catch {}
              try {
                const mw2 = await fetchMaybeGhostWallet(cl.rpc, addr as any);
                const mw2Account = (mw2 as any)?.data;
                if (mw2Account && mounted) handlers.onWallet?.(mw2Account, addr);
              } catch {}
            }
          } catch (e) {
            // subscription ended or aborted
          }
        })();
      } catch (e) {
        // per-address subscription failed; ignore and rely on polling
      }
    }

    async function discoverAndSubscribe() {
      try {
        const resp: any = await cl.rpc.getProgramAccounts(programAddress as any, { encoding: "base64" }).send();
        const list = Array.isArray(resp) ? resp : (resp?.value ?? []);
        const addresses = list
          .map((it: any) => (it.pubkey?.toString ? it.pubkey.toString() : it.pubkey))
          .filter(Boolean);

        for (const addr of addresses) {
          void subscribeAddress(addr);
        }
      } catch (err) {
        // discovery failed; we'll try again via poll
      }
    }

    // initial discovery
    void discoverAndSubscribe();

    // poll for new accounts every 6s to catch newly created PDAs that subscriptions don't cover
    const poll = setInterval(() => {
      void discoverAndSubscribe();
    }, 6_000);

    return () => {
      mounted = false;
      abortController.abort();
      clearInterval(poll);
    };
  }, [client, programAddress, handlers]);
}
