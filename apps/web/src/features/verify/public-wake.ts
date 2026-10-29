/**
 * G6/H5: a Wake shared as a public proof link, as `GET /api/public/wakes/:token` answers it.
 *
 * ALLOW-LIST. The public page can show only what is in this schema, and the schema holds only
 * what anyone can already read from Sui or must see to check the receipt:
 *   - `remora`: the display name; `network`; `ts`: when it happened;
 *   - `action`: what was decided, as a kind. For a payment also the Reef `payee` ref, `payTo`
 *     address and `amount` (micro-USDC): all three are visible in the transaction;
 *   - `tx`: the transaction digest; `agent`: the remora's signing address (public onchain, and
 *     the "signed by the remora" check names it); `intentHash`; `anchored`;
 *   - `checks`: the verify checks, exactly as `/verify/:ref` shows them.
 * EXCLUDED, never rendered even if the server sends them (zod drops unknown keys here): the
 * prompt and `promptSha256`, model id, recalled memories (blob ids, namespaces, text), the
 * trigger (a chat or webhook ref), inputs, Sonar's reasons, the decision's free-text `reason`
 * (model prose can quote private context), the owner's address, email or any account id, and the
 * Wake/receipt id (`/api/wakes/:id/share` takes that id; the token is the only public handle).
 * See docs/threat-model.md (memory and prompts stay private; the chain facts are public).
 *
 * TODO: move to `packages/schema` (and the fixtures to its fixtures) at the contract PR with Uy.
 */
import { z } from "zod";

/**
 * Free text is bounded: a check's `name` (64) and `detail` (200), and the `remora` name (64). The
 * server MUST only send fixed-format check details (a hash, a digest, an address, "50000 of
 * 50000", "anchored onchain"), never model prose or anything quoted from private context; this
 * limit is a backstop, not the filter.
 */
const Check = z.object({
  name: z.string().min(1).max(64),
  ok: z.boolean().nullable(),
  detail: z.string().max(200),
});

const Action = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("pay"),
    payee: z
      .string()
      .max(64)
      .regex(/^reef:[a-z0-9-]+$/),
    payTo: z.string().regex(/^0x[0-9a-fA-F]{1,64}$/),
    amount: z.string().regex(/^\d{1,20}$/),
  }),
  z.object({ kind: z.enum(["ping", "digest", "silent", "answer"]) }),
]);

export const PublicWake = z.object({
  v: z.literal(1),
  remora: z.string().min(1).max(64),
  network: z.enum(["testnet", "mainnet"]),
  ts: z.iso.datetime({ offset: true }),
  action: Action,
  tx: z.string().min(1).max(64).nullable(),
  agent: z.string().regex(/^0x[0-9a-fA-F]{1,64}$/),
  intentHash: z.string().regex(/^[0-9a-f]{64}$/),
  anchored: z.boolean(),
  checks: z.array(Check).max(20),
});
export type PublicWake = z.infer<typeof PublicWake>;

/** `POST /api/wakes/:id/share` → `{ token, url }` (owner only). */
export const ShareLink = z.object({ token: z.string().min(1), url: z.string().min(1) });
export type ShareLink = z.infer<typeof ShareLink>;
