import { createSolanaRpc } from "@solana/kit";
const rpc = createSolanaRpc("https://api.devnet.solana.com");
async function main() {
  const resp = await rpc.getProgramAccounts("wsMSPiq1C2w89HcjVauzqfqgNEvPVkHu1zKiTfma2F5" as any, { encoding: "base64" }).send();
  console.log(JSON.stringify(resp, null, 2));
}
main().catch(console.error);
