import { createSolanaRpc } from "@solana/kit";
const rpc = createSolanaRpc("https://api.devnet.solana.com");
async function main() {
  const resp = await rpc.getProgramAccounts("wsMSPLq1C2eB9BcjVxuzqfggWCvPVkHu1z81tFma7F3" as any, { encoding: "base64" }).send();
  const list = Array.isArray(resp) ? resp : (resp?.value ?? []);
  
  for (const it of list) {
    const pubkey = it.pubkey?.toString?.() ?? it.pubkey ?? it?.account?.pubkey ?? null;
    const dataField = it.account?.data ?? it.data ?? null;
    const encoded = Array.isArray(dataField) ? dataField[0] : dataField?.[0] ?? null;
    if (encoded) {
        const bytes = Uint8Array.from(Buffer.from(encoded, "base64"));
        console.log("Account:", pubkey);
        console.log("Prefix:", Array.from(bytes.slice(0, 8)));
    }
  }
}
main().catch(console.error);
