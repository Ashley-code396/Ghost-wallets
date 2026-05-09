import { readFileSync, writeFileSync } from 'fs';
let content = readFileSync('app/page.tsx', 'utf-8');

// 1. Add pubkey and actionCount to walletsDecoded mapping
content = content.replace(
  /creator: acc\.data\.creator\?\.toString\?\(\) \?\? null,/,
  `creator: acc.data.creator?.toString?.() ?? null,\n          address: acc.address,\n          actionCount: Number(acc.data.actionCount),`
);

// 2. Add actionCount to incremental update
content = content.replace(
  /creator: account\.creator\?\.toString\?\(\) \?\? null,/,
  `creator: account.creator?.toString?.() ?? null,\n            address: pubkey,\n            actionCount: Number(account.actionCount),`
);
content = content.replace(
  /creator: account\.creator\?\.toString\?\(\) \?\? null,/g, // replace again for the second occurrence
  `creator: account.creator?.toString?.() ?? null,\n          address: pubkey,\n          actionCount: Number(account.actionCount),`
);

writeFileSync('app/page.tsx', content);
