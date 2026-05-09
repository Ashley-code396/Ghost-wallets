import { signAndSendTransactionMessageWithSigners, generateKeyPairSigner, createTransactionMessage, setTransactionMessageFeePayer, pipe } from "@solana/kit";
async function main() {
    const signer = await generateKeyPairSigner();
    const txMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayer(signer.address, m)
    );
    try {
        await signAndSendTransactionMessageWithSigners(txMessage);
    } catch (e) {
        console.log(e.message);
    }
}
main();
