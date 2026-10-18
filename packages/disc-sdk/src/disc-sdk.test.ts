import { bcs } from "@mysten/sui/bcs";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { describe, expect, it } from "vitest";
import { AllowanceBcs, AllowanceCapBcs, DiscBcs, PaidBcs, RegistryBcs } from "./bcs.ts";
import {
  buildIssue,
  buildPause,
  buildPay,
  buildRevokeAndReissue,
  buildRotate,
  buildSetPayees,
  type IssueArgs,
} from "./builders.ts";
import type { DiscConfig } from "./config.ts";
import { toDiscError } from "./errors.ts";
import { getFundsSplit } from "./funds.ts";
import { findDiscId, listOwnerDiscs, type ObjectReader, paidEvents } from "./readers.ts";

const PKG = normalizeSuiAddress("0xa1");
const cfg: DiscConfig = {
  packageId: PKG,
  registryId: normalizeSuiAddress("0xb1"),
  coinType: "0xa1ec::usdc::USDC",
};
const OWNER = normalizeSuiAddress("0x0f");
const SPENDER = normalizeSuiAddress("0x05");
const PAYEE = normalizeSuiAddress("0x0a");
const DISC = normalizeSuiAddress("0xd1");
const ALLOWANCE = normalizeSuiAddress("0xa11");
const CAP = normalizeSuiAddress("0xca");
const TABLE = normalizeSuiAddress("0x7a");
const INTENT = new Uint8Array(32).fill(7);

const issueArgs: IssueArgs = {
  name: "scout-usdc",
  spender: SPENDER,
  lifetimeCap: 5_000_000n,
  expiryMs: 1_800_000_000_000,
  payees: [PAYEE],
  perPaymentCap: 20_000n,
};

type Cmd = {
  $kind: string;
  MoveCall?: { package: string; module: string; function: string; typeArguments: string[] };
};
const calls = (data: { commands: Cmd[] }) =>
  data.commands
    .filter((c) => c.$kind === "MoveCall")
    .map((c) => `${c.MoveCall?.module}::${c.MoveCall?.function}`);

describe("builders", () => {
  it("issue proposes for the DISC app and issues through the registry", () => {
    const data = buildIssue(cfg, issueArgs).getData();
    expect(calls(data)).toEqual(["option::none", "allowance::propose_for_app", "disc::issue"]);
    const propose = data.commands[1]?.MoveCall;
    expect(propose?.typeArguments).toEqual([
      `0x2::balance::Balance<${cfg.coinType}>`,
      `${PKG}::disc::DISC`,
    ]);
  });

  it("issue builds a periodic rate limit when asked", () => {
    const data = buildIssue(cfg, {
      ...issueArgs,
      rateLimit: { periodMs: 86_400_000, limit: 100_000n },
    }).getData();
    expect(calls(data)).toEqual([
      "allowance::periodic_rate_limit",
      "option::some",
      "allowance::propose_for_app",
      "disc::issue",
    ]);
  });

  it("issue refuses what the framework would abort on", () => {
    expect(() => buildIssue(cfg, { ...issueArgs, lifetimeCap: undefined })).toThrow("lifetime cap");
    expect(() => buildIssue(cfg, { ...issueArgs, expiryMs: undefined })).toThrow("expiry");
    expect(() => buildIssue(cfg, { ...issueArgs, perPaymentCap: 0n })).toThrow("perPaymentCap");
    expect(() => buildIssue(cfg, { ...issueArgs, payees: [PAYEE, PAYEE] })).toThrow("unique");
    expect(() => buildIssue(cfg, { ...issueArgs, name: "x".repeat(129) })).toThrow("128");
  });

  it("pay is sponsor-ready and withdraws through the allowance", () => {
    const tx = buildPay(
      cfg,
      {
        discId: DISC,
        allowanceId: ALLOWANCE,
        funder: OWNER,
        payee: PAYEE,
        amount: 10_000n,
        intent: INTENT,
      },
      { sender: SPENDER, gasOwner: OWNER },
    );
    const data = tx.getData();
    expect(data.sender).toBe(SPENDER);
    expect(data.gasData.owner).toBe(OWNER);
    expect(calls(data)).toEqual(["disc::pay"]);
    const withdrawal = data.inputs.find((i) => i.$kind === "FundsWithdrawal");
    expect(withdrawal?.FundsWithdrawal?.withdrawFrom).toEqual({
      $kind: "SenderAllowance",
      SenderAllowance: { funder: OWNER, allowance: ALLOWANCE },
    });
  });

  it("pay refuses an intent that isn't a sha256 digest", () => {
    const bad = {
      discId: DISC,
      allowanceId: ALLOWANCE,
      funder: OWNER,
      payee: PAYEE,
      amount: 1n,
      intent: new Uint8Array(31),
    };
    expect(() => buildPay(cfg, bad, { sender: SPENDER })).toThrow("32-byte");
  });

  it("rotate, pause-all, payees and revoke + reissue target the right functions", () => {
    expect(
      calls(
        buildRotate(cfg, { discId: DISC, allowanceId: ALLOWANCE, newSpender: PAYEE }).getData(),
      ),
    ).toEqual(["disc::rotate"]);
    expect(calls(buildPause(cfg, [DISC, normalizeSuiAddress("0xd2")], true).getData())).toEqual([
      "disc::pause",
      "disc::pause",
    ]);
    expect(calls(buildSetPayees(cfg, DISC, [PAYEE]).getData())).toEqual(["disc::set_payees"]);
    const swap = buildRevokeAndReissue(
      cfg,
      { discId: DISC, capId: CAP, allowanceId: ALLOWANCE },
      issueArgs,
    );
    expect(calls(swap.getData())).toEqual([
      "disc::revoke",
      "option::none",
      "allowance::propose_for_app",
      "disc::issue",
    ]);
  });
});

describe("readers", () => {
  const discBytes = DiscBcs.serialize({
    id: DISC,
    owner: OWNER,
    name: "scout-usdc",
    payees: { contents: [PAYEE] },
    per_payment_cap: 20_000n,
    paused: false,
    version: 1n,
  }).toBytes();
  const allowanceBytes = AllowanceBcs.serialize({
    id: ALLOWANCE,
    settings: {
      funder: OWNER,
      spender: SPENDER,
      app: { name: `${PKG.slice(2)}::disc::DISC` },
      lifetime_cap: 5_000_000n,
      start_timestamp_ms: null,
      expiration_timestamp_ms: 1_800_000_000_000n,
      rate_limit: {
        Windowed: {
          limit: 100n,
          spent: 10n,
          anchor_ms: 5n,
          index: 0n,
          window: { PeriodicMs: 60_000n },
        },
      },
      name: "scout-usdc",
    },
    current_spend: 10_000n,
  }).toBytes();

  const fake: ObjectReader = {
    async getObject({ objectId }) {
      const content =
        objectId === cfg.registryId
          ? RegistryBcs.serialize({
              id: cfg.registryId,
              discs: { id: TABLE, size: 1n },
              version: 1n,
            }).toBytes()
          : objectId === ALLOWANCE
            ? allowanceBytes
            : discBytes;
      return { object: { objectId, type: "", content } };
    },
    async getDynamicField({ parentId }) {
      if (parentId !== TABLE) throw Object.assign(new Error("not found"), { code: "NOT_FOUND" });
      return { dynamicField: { value: { bcs: bcs.Address.serialize(DISC).toBytes() } } };
    },
    async listOwnedObjects() {
      return {
        objects: [
          {
            objectId: CAP,
            content: AllowanceCapBcs.serialize({ id: CAP, allowance: ALLOWANCE }).toBytes(),
          },
        ],
        hasNextPage: false,
        cursor: null,
      };
    },
  };

  it("lists an owner's Discs with their allowances", async () => {
    const [owned, ...rest] = await listOwnerDiscs(fake, cfg, OWNER);
    expect(rest).toHaveLength(0);
    expect(owned?.capId).toBe(CAP);
    expect(owned?.disc).toMatchObject({
      id: DISC,
      owner: OWNER,
      payees: [PAYEE],
      perPaymentCap: 20_000n,
      paused: false,
    });
    expect(owned?.allowance).toMatchObject({
      funder: OWNER,
      spender: SPENDER,
      expiryMs: 1_800_000_000_000,
      rateLimit: { limit: 100n, spent: 10n, periodMs: 60_000 },
      currentSpend: 10_000n,
    });
  });

  it("finds a Disc by key and returns null when the key is free", async () => {
    expect(await findDiscId(fake, cfg, OWNER, "scout-usdc")).toBe(DISC);
    const empty: ObjectReader = {
      ...fake,
      getDynamicField: () => Promise.reject(Object.assign(new Error("x"), { code: "NOT_FOUND" })),
    };
    expect(await findDiscId(empty, cfg, OWNER, "nope")).toBeNull();
  });

  it("reads Paid events of this package only", () => {
    const paid = PaidBcs.serialize({
      disc: DISC,
      payee: PAYEE,
      amount: 10_000n,
      intent: Array.from(INTENT),
      ts_ms: 42n,
    }).toBytes();
    const events = [
      { eventType: `${PKG}::disc::Paid`, bcs: paid },
      { eventType: "0x9::other::Paid", bcs: paid },
    ];
    expect(paidEvents(cfg, events)).toEqual([
      { disc: DISC, payee: PAYEE, amount: 10_000n, intent: INTENT, tsMs: 42 },
    ]);
  });

  it("splits funds from one GetBalance", async () => {
    const split = await getFundsSplit(
      {
        getBalance: async () => ({
          balance: {
            coinType: cfg.coinType,
            balance: "30",
            addressBalance: "20",
            coinBalance: "10",
          },
        }),
      },
      OWNER,
      cfg.coinType,
    );
    expect(split).toEqual({
      coinType: cfg.coinType,
      total: 30n,
      addressBalance: 20n,
      coinBalance: 10n,
    });
  });
});

describe("toDiscError", () => {
  it("maps clever errors from effects", () => {
    expect(
      toDiscError({ message: "x", MoveAbort: { cleverError: { constantName: "EPaused" } } }).code,
    ).toBe("disc.paused");
  });

  it("maps errors thrown at build time (strings seen on testnet in U1)", () => {
    const cases: [string, string][] = [
      [
        "Transaction resolution failed: MoveAbort in 1st command, 'EOverPaymentCap': Payment exceeds",
        "disc.over_per_payment_cap",
      ],
      [
        "MoveAbort in 1st command, 'EExceedsRateLimit': Spend would exceed",
        "allowance.over_window_limit",
      ],
      [
        "MoveAbort in 1st command, 'EExceedsLifetimeCap': Spend would exceed the lifetime cap",
        "allowance.over_lifetime_cap",
      ],
      [
        "Invalid withdraw reservation: Transaction sender is not the spender of allowance 0xde05",
        "disc.not_spender",
      ],
      [
        "Invalid withdraw reservation: Insufficient address balance of coin type 0x2::sui::SUI",
        "funds.insufficient_address_balance",
      ],
      [
        "Object 0xde05b193106e5405fcb7bc6beece3dcb4f3c1f07c996edbb927571f3116ffa23 not found",
        "allowance.revoked",
      ],
      ["Received HTTP status code 429", "rate_limited"],
      ["something else", "unknown"],
    ];
    for (const [message, code] of cases)
      expect(toDiscError(new Error(message)).code, message).toBe(code);
  });

  it("keeps the Move constant for unknown aborts", () => {
    expect(toDiscError(new Error("MoveAbort 'EMystery': ?"))).toMatchObject({
      code: "unknown",
      constant: "EMystery",
    });
  });
});
