import { createId } from "../worker/lib/ids";
import { addDaysIso, nowIso } from "../worker/lib/time";

describe("database helper utilities", () => {
  it("generates prefixed opaque IDs", () => {
    const userId = createId("usr");
    const companyId = createId("cmp");
    const sessionId = createId("ses");

    expect(userId).toMatch(/^usr_[0-9a-f]{32}$/);
    expect(companyId).toMatch(/^cmp_[0-9a-f]{32}$/);
    expect(sessionId).toMatch(/^ses_[0-9a-f]{32}$/);
    expect(new Set([userId, companyId, sessionId]).size).toBe(3);
  });

  it("formats timestamps as ISO strings and adds days deterministically", () => {
    const base = new Date("2026-06-11T00:00:00.000Z");

    expect(nowIso(base)).toBe("2026-06-11T00:00:00.000Z");
    expect(addDaysIso(30, base)).toBe("2026-07-11T00:00:00.000Z");
  });
});
