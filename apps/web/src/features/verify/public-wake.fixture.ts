/** H5: the payment Wake (`wake-view.payment.json` + `verify-result.payment.json`) as the public shape. */
import type { PublicWake, ShareLink } from "./public-wake";

export const PUBLIC_WAKE: PublicWake = {
  v: 1,
  remora: "scout",
  network: "testnet",
  ts: "2026-11-03T02:13:00Z",
  action: {
    kind: "pay",
    payee: "reef:sui-risk",
    payTo: `0x${"6d".repeat(32)}`,
    amount: "50000",
  },
  tx: "8PqTz4m9uWJ3xVhK1nR2cY7bL5dA6sE0fG3hJ9kM2pQ",
  agent: `0x${"5c".repeat(32)}`,
  intentHash: "ecb2782e5e6a94569533182e69db241307d331cb5f07d1f6a91369cd5efb7cfb",
  anchored: true,
  checks: [
    { name: "intent hash", ok: true, detail: "3f".repeat(32) },
    {
      name: "transaction succeeded",
      ok: true,
      detail: "8PqTz4m9uWJ3xVhK1nR2cY7bL5dA6sE0fG3hJ9kM2pQ",
    },
    { name: "Paid.intent matches", ok: true, detail: "saved onchain" },
    { name: "payTo balance change", ok: true, detail: "50000 of 50000" },
    { name: "signed by the remora", ok: true, detail: `0x${"5c".repeat(32)}` },
  ],
};

export const SHARE_LINK: ShareLink = {
  token: "pw_9fK2xQ7LmB4tRz",
  url: "https://remora.vercel.app/p/pw_9fK2xQ7LmB4tRz",
};
