import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { describe, expect, it } from "vitest";
import { readTools, units } from "./read.ts";

describe("the free balances read (ADR-0106)", () => {
  it("writes amounts in each coin's decimals, so MIST never reads as SUI", async () => {
    expect(units("638767245", 9)).toBe("0.638767245");
    expect(units("19125000", 6)).toBe("19.125");
    const client = {
      core: {
        listBalances: async () => ({
          balances: [
            { coinType: "0x2::sui::SUI", balance: "638767245" },
            { coinType: "0xdead::x::X", balance: "7" },
          ],
        }),
        getCoinMetadata: async ({ coinType }: { coinType: string }) => {
          if (!coinType.endsWith("SUI")) throw new Error("no metadata");
          return { coinMetadata: { symbol: "SUI", decimals: 9 } };
        },
      },
    } as unknown as SuiGrpcClient;
    const tools = readTools({ client } as unknown as Parameters<typeof readTools>[0]);
    expect(await tools.balances?.("0x5")).toBe(
      "SUI: 0.638767245 (638767245 base units)\nX: 7 base units (decimals unknown)",
    );
  });
});
