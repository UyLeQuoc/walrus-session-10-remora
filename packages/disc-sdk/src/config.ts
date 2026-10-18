/** Where a published `remora` package lives, and which coin its Discs spend. */
export interface DiscConfig {
  /** The original package ID (types keep it across upgrades). */
  packageId: string;
  /** The shared `disc::Registry`. */
  registryId: string;
  /** The coin type `C` of `Allowance<Balance<C>>`, e.g. USDC. */
  coinType: string;
}

export const CLOCK_ID = "0x6";

export const discType = (cfg: DiscConfig, name: string) => `${cfg.packageId}::disc::${name}`;

export const balanceType = (cfg: DiscConfig) => `0x2::balance::Balance<${cfg.coinType}>`;

export const allowanceType = (cfg: DiscConfig) => `0x2::allowance::Allowance<${balanceType(cfg)}>`;

export const allowanceCapType = (cfg: DiscConfig) =>
  `0x2::allowance::AllowanceCap<${balanceType(cfg)}>`;
