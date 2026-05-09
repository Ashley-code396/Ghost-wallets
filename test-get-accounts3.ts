import { createSolanaRpc } from "@solana/kit";
import { getGhostWalletDiscriminatorBytes, getGhostWalletDecoder, fetchAllMaybeGhostWallet } from "./app/generated/ghost_wallet/accounts/ghostWallet";
import { fetchAllMaybeGhostAction, getGhostActionDiscriminatorBytes } from "./app/generated/ghost_wallet/accounts/ghostAction";

const rpc = createSolanaRpc("https://api.devnet.solana.com");
async function main() {
  const resp = await rpc.getProgramAccounts("wsMSPLq1C2eB9BcjVxuzqfggWCvPVkHu1z81tFma7F3" as any, { encoding: "base64" }).send();
  const list = Array.isArray(resp) ? resp : (resp?.value ?? []);
  console.log("Found:", list.length);

  const base64ToUint8 = (b64: string) => Uint8Array.from(Buffer.from(b64, "base64"));
  const actionDisc = Uint8Array.from(getGhostActionDiscriminatorBytes() as any);
  const walletDisc = Uint8Array.from(getGhostWalletDiscriminatorBytes() as any);

  const actionAddrs: string[] = [];
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
      if (equal(prefix, actionDisc)) actionAddrs.push(pubkey);
      else if (equal(prefix, walletDisc)) walletAddrs.push(pubkey);
    } catch (e) { }
  }

  console.log("actionAddrs:", actionAddrs);
  console.log("walletAddrs:", walletAddrs);

  if (walletAddrs.length > 0) {
      const wallets = await fetchAllMaybeGhostWallet(rpc, walletAddrs as any);
      console.log("Wallets from kit:", wallets);
      console.log("Exists:", wallets[0]?.exists);
      if (wallets[0]?.exists) {
          console.log("Purpose:", wallets[0].data.purpose);
          console.log("Creator:", wallets[0].data.creator.toString());
      }
  }
}
main().catch(console.error);
