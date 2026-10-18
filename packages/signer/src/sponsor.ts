/**
 * D8: the gas sponsor's policy and co-signing. The sponsor pays gas for remora transactions and must
 * never pay anything else (ADR-0020):
 * - it's the gas owner, and never the sender;
 * - no input withdraws from the sponsor's address balance, and no allowance it funds is spent;
 * - the gas coin is never used as an argument (it can't be split off or transferred);
 * - Move calls only go to allowed packages; the gas budget stays under a cap.
 */
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress } from "@mysten/sui/utils";

export type SponsorRefusalCode =
  | "sponsor.not_gas_owner"
  | "sponsor.is_sender"
  | "sponsor.is_funder"
  | "sponsor.gas_coin_used"
  | "sponsor.package_not_allowed"
  | "sponsor.command_not_allowed"
  | "sponsor.gas_budget_too_high";

export class SponsorRefusal extends Error {
  constructor(
    readonly code: SponsorRefusalCode,
    message: string,
  ) {
    super(message);
  }
}

export interface SponsorPolicy {
  /** Packages whose Move calls the sponsor pays for (Remora's package, `0x1`, `0x2`). */
  allowedPackages: string[];
  maxGasBudget: bigint;
}

export interface Inspected {
  sender: string;
  gasBudget: bigint | null;
}

type TxData = ReturnType<Transaction["getData"]>;

/** Checks transaction data against the policy; throws `SponsorRefusal` with a typed code. */
export function inspect(data: TxData, sponsor: string, policy: SponsorPolicy): Inspected {
  const me = normalizeSuiAddress(sponsor);
  const owner = data.gasData.owner ? normalizeSuiAddress(data.gasData.owner) : null;
  if (owner !== me)
    throw new SponsorRefusal("sponsor.not_gas_owner", "The sponsor must be the gas owner.");
  const sender = data.sender ? normalizeSuiAddress(data.sender) : "";
  if (!sender || sender === me)
    throw new SponsorRefusal("sponsor.is_sender", "The sponsor can't be the sender.");

  for (const input of data.inputs) {
    const from = input.FundsWithdrawal?.withdrawFrom;
    if (!from) continue;
    if (from.$kind === "Sponsor") {
      throw new SponsorRefusal("sponsor.is_funder", "The transaction withdraws from the sponsor.");
    }
    if (
      from.$kind === "SenderAllowance" &&
      normalizeSuiAddress(from.SenderAllowance.funder) === me
    ) {
      throw new SponsorRefusal("sponsor.is_funder", "The sponsor funds this allowance.");
    }
  }

  const allowed = new Set(policy.allowedPackages.map((p) => normalizeSuiAddress(p)));
  const usesGas = (arg: unknown): boolean =>
    !!arg &&
    typeof arg === "object" &&
    ("GasCoin" in arg || (arg as { $kind?: string }).$kind === "GasCoin");
  for (const cmd of data.commands) {
    switch (cmd.$kind) {
      case "MoveCall": {
        if (!allowed.has(normalizeSuiAddress(cmd.MoveCall.package))) {
          throw new SponsorRefusal(
            "sponsor.package_not_allowed",
            `The sponsor doesn't pay for calls into ${cmd.MoveCall.package}.`,
          );
        }
        if (cmd.MoveCall.arguments.some(usesGas)) {
          throw new SponsorRefusal("sponsor.gas_coin_used", "The gas coin can't be an argument.");
        }
        break;
      }
      case "SplitCoins":
      case "MergeCoins":
      case "TransferObjects":
      case "MakeMoveVec": {
        if (JSON.stringify(cmd).includes('"GasCoin"')) {
          throw new SponsorRefusal("sponsor.gas_coin_used", "The gas coin can't be an argument.");
        }
        break;
      }
      case "$Intent":
        break;
      default:
        throw new SponsorRefusal("sponsor.command_not_allowed", `${cmd.$kind} isn't sponsored.`);
    }
  }

  const budget = data.gasData.budget != null ? BigInt(data.gasData.budget) : null;
  if (budget !== null && budget > policy.maxGasBudget) {
    throw new SponsorRefusal(
      "sponsor.gas_budget_too_high",
      `Gas budget ${budget} is over the cap.`,
    );
  }
  return { sender, gasBudget: budget };
}

/** One network's sponsor: inspect, then co-sign. The keypair never leaves this object. */
export class Sponsor {
  readonly address: string;
  readonly #kp: Ed25519Keypair;

  constructor(
    secretKey: string,
    readonly policy: SponsorPolicy,
  ) {
    this.#kp = Ed25519Keypair.fromSecretKey(secretKey);
    this.address = this.#kp.toSuiAddress();
  }

  inspectBytes(bytes: Uint8Array): Inspected {
    return inspect(Transaction.from(bytes).getData(), this.address, this.policy);
  }

  /** Inspects the exact bytes, then signs them as the gas owner. */
  async cosign(bytes: Uint8Array): Promise<{ signature: string; inspected: Inspected }> {
    const inspected = this.inspectBytes(bytes);
    const { signature } = await this.#kp.signTransaction(bytes);
    return { signature, inspected };
  }

  toJSON() {
    return { sponsor: this.address };
  }
}
