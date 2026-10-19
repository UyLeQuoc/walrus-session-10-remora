/**
 * The injected wallet-standard test wallet. The page gets a wallet object whose signing calls go
 * back to Node through `page.exposeFunction`, so the burner key never enters the browser. It
 * supports what the app uses: connect, events, `sui:signPersonalMessage`, `sui:signTransaction`.
 */
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { fromBase64, toBase64 } from "@mysten/sui/utils";
import type { Page } from "@playwright/test";
import { testnet } from "./env";

export const WALLET_NAME = "Remora E2E Burner";

export async function installTestWallet(
  page: Page,
  kp: Ed25519Keypair,
): Promise<{ signed: string[] }> {
  const signed: string[] = [];
  const address = kp.toSuiAddress();
  await page.exposeFunction("__remoraE2eSignMessage", async (b64: string) => {
    const { bytes, signature } = await kp.signPersonalMessage(fromBase64(b64));
    return { bytes, signature };
  });
  await page.exposeFunction("__remoraE2eSignTx", async (json: string, chain: string) => {
    if (chain !== "sui:testnet")
      throw new Error(`the E2E burner only signs on testnet, not ${chain}`);
    const tx = Transaction.from(json);
    tx.setSenderIfNotSet(address);
    const bytes = await tx.build({ client: testnet() });
    const { signature } = await kp.signTransaction(bytes);
    signed.push(signature);
    return { bytes: toBase64(bytes), signature };
  });
  await page.addInitScript(
    ({ name, address, publicKey }) => {
      const pk = new Uint8Array(publicKey);
      const chains = ["sui:testnet"] as const;
      const account = {
        address,
        publicKey: pk,
        chains,
        features: ["sui:signTransaction", "sui:signPersonalMessage"],
        label: name,
      };
      const icon =
        "data:image/svg+xml;base64," +
        btoa(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="#f59e0b"/></svg>',
        );
      const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
      const w = window as unknown as Record<
        string,
        (...a: unknown[]) => Promise<{ bytes: string; signature: string }>
      >;
      const wallet = {
        version: "1.0.0",
        name,
        icon,
        chains,
        get accounts() {
          return [account];
        },
        features: {
          "standard:connect": { version: "1.0.0", connect: async () => ({ accounts: [account] }) },
          "standard:disconnect": { version: "1.0.0", disconnect: async () => {} },
          "standard:events": { version: "1.0.0", on: () => () => {} },
          "sui:signPersonalMessage": {
            version: "1.1.0",
            signPersonalMessage: async ({ message }: { message: Uint8Array }) =>
              w.__remoraE2eSignMessage?.(b64(message)),
          },
          "sui:signTransaction": {
            version: "2.0.0",
            signTransaction: async ({
              transaction,
              chain,
            }: {
              transaction: { toJSON(): Promise<string> };
              chain: string;
            }) => w.__remoraE2eSignTx?.(await transaction.toJSON(), chain),
          },
        },
      };
      const register = ({ register }: { register: (w: unknown) => void }) => register(wallet);
      window.addEventListener("wallet-standard:app-ready", (e) =>
        register((e as CustomEvent).detail),
      );
      window.dispatchEvent(
        new CustomEvent("wallet-standard:register-wallet", { detail: register }),
      );
    },
    { name: WALLET_NAME, address, publicKey: Array.from(kp.getPublicKey().toRawBytes()) },
  );
  return { signed };
}

/**
 * Connects the test wallet and signs in through the app's own wallet picker (A1·ui).
 *
 * Signed out, the page offers "Sign in with your wallet" and the sidebar/account menu offers
 * "Sign in"; the mobile layout hides the sidebar, so either label is accepted.
 */
export async function connectAndSignIn(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: /^(Sign in|Connect wallet)/ })
    .first()
    .click();
  await page.getByRole("button", { name: WALLET_NAME }).click();
  await page.getByRole("dialog").waitFor({ state: "detached", timeout: 30_000 });
}
