import { readFileSync, writeFileSync } from 'fs';
let content = readFileSync('app/page.tsx', 'utf-8');

// Replace the GhostWalletCard mapping
content = content.replace(
  /onFund=\{\(\) => toast\.info\("Fund clicked"\)\}\n\s+onExecute=\{\(\) => toast\.info\("Execute clicked"\)\}/,
  `onFund={() => setFundingWallet(w)}\n                    onExecute={() => setExecutingWallet(w)}`
);

const handlers = `
  const handleFundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundingWallet || !signer) return;
    try {
      const amount = BigInt(parseFloat(fundAmount) * 1e9);
      const ix = await getFundGhostWalletInstructionAsync({
        funder: signer as any,
        wallet: fundingWallet.pubkey as any,
        amount,
      });

      const latestBlockhash = await client.rpc.getLatestBlockhash().send();
      const txMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayer(signer.address as Address, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash.value, m),
        (m) => appendTransactionMessageInstruction(ix, m)
      );

      toast.info("Please approve funding transaction...");
      await signAndSendTransactionMessageWithSigners(txMessage);
      toast.success("Ghost Wallet funded successfully!");
      setFundingWallet(null);
    } catch (err: any) {
      console.error(err);
      toast.error(\`Failed to fund: \${err.message}\`);
    }
  };

  const handleExecuteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!executingWallet || !signer) return;
    try {
      const amount = BigInt(parseFloat(executeAmount) * 1e9);
      // For demo, just send it back to the creator, or some random address. Let's send to creator.
      const recipient = executingWallet.creator as Address;
      const ix = await getExecuteActionInstructionAsync({
        creator: signer as any,
        wallet: executingWallet.pubkey as any,
        recipient,
        amount,
        metadata: executeMetadata,
      });

      const latestBlockhash = await client.rpc.getLatestBlockhash().send();
      const txMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayer(signer.address as Address, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash.value, m),
        (m) => appendTransactionMessageInstruction(ix, m)
      );

      toast.info("Please approve execute transaction...");
      await signAndSendTransactionMessageWithSigners(txMessage);
      toast.success("Ghost Wallet action executed!");
      setExecutingWallet(null);
    } catch (err: any) {
      console.error(err);
      toast.error(\`Failed to execute: \${err.message}\`);
    }
  };
`;

const renderModals = `
              {fundingWallet && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 backdrop-blur-sm p-4">
                  <div className="w-full max-w-md rounded-xl border border-mist/30 bg-void p-6 shadow-2xl">
                    <h3 className="text-xl font-bold text-silver mb-4">Fund Wallet</h3>
                    <p className="text-sm text-ghost mb-4">Funding ID: {fundingWallet.taskId}</p>
                    <form onSubmit={handleFundSubmit} className="space-y-4">
                      <div>
                        <label className="block text-sm text-mist mb-1">Amount (SOL)</label>
                        <input type="number" step="0.01" value={fundAmount} onChange={e => setFundAmount(e.target.value)} className="w-full rounded bg-void border border-mist/30 px-3 py-2 text-silver" />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setFundingWallet(null)} className="flex-1 rounded border border-faint-blue/20 py-2 text-ghost hover:text-silver">Cancel</button>
                        <button type="submit" className="flex-1 rounded bg-mist/20 py-2 text-mist font-bold hover:bg-mist/30">Confirm Fund</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {executingWallet && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 backdrop-blur-sm p-4">
                  <div className="w-full max-w-md rounded-xl border border-mist/30 bg-void p-6 shadow-2xl">
                    <h3 className="text-xl font-bold text-silver mb-4">Execute Action</h3>
                    <form onSubmit={handleExecuteSubmit} className="space-y-4">
                      <div>
                        <label className="block text-sm text-mist mb-1">Amount (SOL)</label>
                        <input type="number" step="0.01" value={executeAmount} onChange={e => setExecuteAmount(e.target.value)} className="w-full rounded bg-void border border-mist/30 px-3 py-2 text-silver" />
                      </div>
                      <div>
                        <label className="block text-sm text-mist mb-1">Metadata (Reason)</label>
                        <input type="text" value={executeMetadata} onChange={e => setExecuteMetadata(e.target.value)} className="w-full rounded bg-void border border-mist/30 px-3 py-2 text-silver" />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setExecutingWallet(null)} className="flex-1 rounded border border-faint-blue/20 py-2 text-ghost hover:text-silver">Cancel</button>
                        <button type="submit" className="flex-1 rounded bg-silver text-void py-2 font-bold hover:bg-white">Confirm Execute</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
`;

// Insert handlers before return
content = content.replace(
  /return \(\n    <div className="relative min-h-screen bg-void text-silver">/,
  handlers + '\n\n  return (\n    <div className="relative min-h-screen bg-void text-silver">'
);

// Insert modals at the end of the main section
content = content.replace(
  /<\/main>/,
  renderModals + '\n        </main>'
);

writeFileSync('app/page.tsx', content);
