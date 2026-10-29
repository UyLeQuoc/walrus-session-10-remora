/** Local fixtures for the E7 Reef directory. TODO: replace with the schema fixtures (see `reef.ts`). */
import type { ReefService } from "./reef";

const MERCHANT = `0x${"3e".padStart(64, "0")}`;
const OTHER = `0x${"7a1".padStart(64, "0")}`;

export const REEF_SERVICES: ReefService[] = [
  {
    name: "sui-risk",
    category: "Security",
    priceUsdc: "10000",
    payTo: MERCHANT,
    docsUrl: "https://docs.remora.example/reef/sui-risk",
  },
  {
    name: "odds",
    category: "Markets",
    priceUsdc: "20000",
    payTo: MERCHANT,
    docsUrl: "https://docs.remora.example/reef/odds",
  },
  {
    name: "brief",
    category: "Writing",
    priceUsdc: "10000",
    payTo: MERCHANT,
    docsUrl: "https://docs.remora.example/reef/brief",
  },
  {
    name: "whale-watch",
    category: "Markets",
    priceUsdc: "15000",
    payTo: OTHER,
    docsUrl: "https://docs.remora.example/reef/whale-watch",
  },
  {
    name: "contract-lint",
    category: "Security",
    priceUsdc: "50000",
    payTo: OTHER,
    docsUrl: "https://docs.remora.example/reef/contract-lint",
  },
];
