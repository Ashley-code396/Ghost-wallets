import { createSolanaRpc } from "@solana/kit";
const rpc = createSolanaRpc("https://api.devnet.solana.com");
async function main() {
  const latestBlockhash = await rpc.getLatestBlockhash().send();
  console.log("Blockhash:", latestBlockhash.value.blockhash);
}
main().catch(console.error);
