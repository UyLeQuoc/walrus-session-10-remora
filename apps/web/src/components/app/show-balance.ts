/** Phase 6 §6: "Show balance" in the account menu, on by default (`remora.show-balance`). */
import { readStored, writeStored } from "@/lib/storage";

const KEY = "remora.show-balance";

export function readShowBalance(): boolean {
  return readStored("local", KEY) !== "0";
}

export function writeShowBalance(on: boolean): void {
  writeStored("local", KEY, on ? "1" : "0");
}
