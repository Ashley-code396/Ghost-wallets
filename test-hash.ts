import { createHash } from "crypto";

const hash1 = createHash("sha256").update("account:GhostWallet").digest();
console.log("GhostWallet:", Array.from(hash1.subarray(0, 8)));

const hash2 = createHash("sha256").update("account:GhostAction").digest();
console.log("GhostAction:", Array.from(hash2.subarray(0, 8)));
