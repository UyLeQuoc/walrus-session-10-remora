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
 * The shape lives in `packages/schema` (ADR-0076).
 */
export { PublicWake, ShareLink } from "@remora/schema";
