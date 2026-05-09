import { generateKeyPairSigner, createTransactionMessage, setTransactionMessageFeePayer, setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstruction, signTransactionMessageWithSigners, pipe, getBase64EncodedWireTransaction } from "@solana/kit";
import { getCreateGhostWalletInstructionAsync } from "./app/generated/ghost_wallet/instructions";

async function main() {
    const signer = await generateKeyPairSigner();
    
    const ix = await getCreateGhostWalletInstructionAsync({
        creator: signer as any,
        taskId: 123456n,
        purpose: "test",
        durationSeconds: 3600n,
    });

    const txMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayer(signer.address, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash({ blockhash: "4dXSpB7H4ZtZD2vRybNMkFdriPnFRCzenK55fQJZp7Rr", lastValidBlockHeight: 123n }, m),
        (m) => appendTransactionMessageInstruction(ix, m)
    );

    const signedTx = await signTransactionMessageWithSigners(txMessage);
    const wireTx = getBase64EncodedWireTransaction(signedTx);
    console.log("Success! wireTx length:", wireTx.length);
}
main().catch(console.error);
