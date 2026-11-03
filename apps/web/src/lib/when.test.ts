import { describe, expect, it } from "vitest";
import { soon } from "./when";

describe("soon", () => {
  const now = new Date(2026, 10, 4, 9, 0); // Wed Nov 4, 9:00
  it("names today, tomorrow and this week, then the date", () => {
    expect(soon(new Date(2026, 10, 4, 15, 0).toISOString(), now)).toBe("Today 3:00 PM");
    expect(soon(new Date(2026, 10, 5, 15, 0).toISOString(), now)).toBe("Tomorrow 3:00 PM");
    expect(soon(new Date(2026, 10, 6, 8, 5).toISOString(), now)).toBe("Fri 8:05 AM");
    expect(soon(new Date(2026, 10, 20, 15, 0).toISOString(), now)).toBe("Nov 20, 3:00 PM");
  });
});
