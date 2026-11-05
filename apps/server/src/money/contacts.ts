/**
 * U18 B1 (ADR-0125): an Errand pays people, not only services. A contact is a name and an address in
 * the remora's config, listed onchain as one of its Disc's payees (one owner signature). It looks like
 * a Reef entry, `reef:contact-<slug>`, so the ADR-0109 guard, Sonar and the Disc treat a person the way
 * they treat a service: paid only at the listed address.
 *
 * The payment runs the ordinary x402 path against a merchant that lives in this process: its 402 asks
 * for the amount at the contact's address, the facilitator sponsors gas, verifies and settles, and the
 * Wake (with the memo as its reason) is anchored as `Paid.intent`. Nothing new holds or signs money.
 */
import { normalizeSuiAddress } from "@mysten/sui/utils";
import type { SuiNetworkName } from "@remora/disc-sdk";
import { x402 } from "@remora/merchant";
import { Hono } from "hono";
import type { ResolvedReef } from "./reef.ts";

export const CONTACT_REF_PREFIX = "reef:contact-";
const CONTACT_HOST = "contact://";

export interface Contact {
  name: string;
  address: string;
  ref: string;
  /** C1 (ADR-0144): the `.sui` name it was added by, resolved again before each payment. */
  suins?: string;
  resolvedAt?: string;
}

export const isContactRef = (ref: string) => ref.startsWith(CONTACT_REF_PREFIX);

/** "Linh Tran" → `linh-tran`: fits `ReefRef` (lowercase letters, digits and dashes). */
export const contactSlug = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

export function toContact(
  name: string,
  address: string,
  by?: { suins?: string; resolvedAt?: string },
): Contact {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 40);
  const slug = contactSlug(clean);
  if (!slug) throw new Error("A contact needs a name with a letter or a digit.");
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(address.trim()))
    throw new Error(`${address} isn't a Sui address.`);
  return {
    name: clean,
    address: normalizeSuiAddress(address.trim()),
    ref: `${CONTACT_REF_PREFIX}${slug}`,
    ...(by?.suins
      ? { suins: by.suins, resolvedAt: by.resolvedAt ?? new Date().toISOString() }
      : {}),
  };
}

export const contactsOf = (r: { config: unknown }): Contact[] =>
  ((r.config as { contacts?: Contact[] }).contacts ?? []).filter(
    (c) => c && typeof c.ref === "string" && isContactRef(c.ref),
  );

/** A contact by name or ref, ignoring case and accents. */
export function findContact(r: { config: unknown }, who: string): Contact | null {
  const want = who.startsWith(CONTACT_REF_PREFIX)
    ? who
    : `${CONTACT_REF_PREFIX}${contactSlug(who)}`;
  return contactsOf(r).find((c) => c.ref === want) ?? null;
}

const urlOf = (c: Contact) => `${CONTACT_HOST}${c.ref.slice(CONTACT_REF_PREFIX.length)}/pay`;

/** The remora's contacts as Reef entries, so the payee guard and Sonar see them as listed. */
export const contactEntries = (r: { config: unknown }): ResolvedReef[] =>
  contactsOf(r).map((c) => ({
    ref: c.ref as `reef:${string}`,
    slug: c.ref.slice("reef:".length),
    name: c.name,
    description: "A contact this remora may pay.",
    path: "/pay",
    price: "0",
    url: urlOf(c),
    payTo: c.address,
  }));

/** The Reef plus this remora's contacts: what it may pay, and where. */
export const listedFor = (
  deps: { reef: (network: SuiNetworkName) => ResolvedReef[] },
  r: { network: SuiNetworkName; config: unknown },
) => [...deps.reef(r.network), ...contactEntries(r)];

export const isContactUrl = (url: string) => url.startsWith(CONTACT_HOST);

/** A memo travels in the URL's query, so it lands in the Wake's reason and the receipt's response. */
export const contactPayUrl = (c: Contact, memo: string) =>
  `${urlOf(c)}?memo=${encodeURIComponent(memo.slice(0, 140))}`;

/**
 * A `fetch` that answers `contact://…` URLs from an in-process x402 merchant charging `amount` at the
 * contact's address, and passes everything else (the facilitator) to the real fetch.
 */
export function contactFetch(o: {
  contact: Contact;
  amount: bigint;
  network: SuiNetworkName;
  asset: string;
  facilitatorUrl: string;
  fetch?: typeof fetch;
}): typeof fetch {
  const http = o.fetch ?? fetch;
  const app = new Hono();
  app.get(
    "/:slug/pay",
    x402({
      amount: o.amount.toString(),
      description: `Pay ${o.contact.name}`,
      disc: true,
      networks: {
        [o.network]: {
          payTo: o.contact.address,
          asset: o.asset,
          facilitatorUrl: o.facilitatorUrl,
        },
      },
      fetch: http,
    }),
    (c) => c.json({ paid: o.contact.name, memo: c.req.query("memo") ?? "" }),
  );
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!isContactUrl(url)) return http(input, init);
    return app.fetch(new Request(url.replace(CONTACT_HOST, "http://contact.local/"), init));
  }) as typeof fetch;
}
