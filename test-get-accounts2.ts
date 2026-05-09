import { createSolanaRpc } from "@solana/kit";
const rpc = createSolanaRpc("https://api.devnet.solana.com");
async function main() {
  const resp = await rpc.getProgramAccounts("wsMSPLq1C2eB9BcjVxuzqfggWCvPVkHu1z81tFma7F3" as any, { encoding: "base64" }).send();
  console.log("Found:", Array.isArray(resp) ? resp.length : resp?.value?.length);
}
main().catch(console.error);
