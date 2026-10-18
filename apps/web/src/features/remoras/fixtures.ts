/**
 * W1 page skeletons run on the `packages/schema` fixtures (H0). Parsing them here means a contract
 * change that breaks a page fails the build, not the demo. Real data replaces these in W2.
 */
import { ApprovalRequest, MemoryRow, RemoraConfig, RemoraEvent, WakeView } from "@remora/schema";
import approval from "@remora/schema/fixtures/approval.over-limit.json";
import events from "@remora/schema/fixtures/events.feed.json";
import memoryRows from "@remora/schema/fixtures/memory.rows.json";
import scout from "@remora/schema/fixtures/remora-config.scout.json";
import sentinel from "@remora/schema/fixtures/remora-config.sentinel.json";
import wakeView from "@remora/schema/fixtures/wake-view.payment.json";
import { z } from "zod";

export const FIXTURE_REMORAS = [RemoraConfig.parse(scout), RemoraConfig.parse(sentinel)];
export const FIXTURE_EVENTS = z.array(RemoraEvent).parse(events);
export const FIXTURE_APPROVALS = [ApprovalRequest.parse(approval)];
export const FIXTURE_MEMORY = z.array(MemoryRow).parse(memoryRows);
export const FIXTURE_WAKE = WakeView.parse(wakeView);

/** Events use the template slug ("scout"); configs carry an id and a display name. */
export const remoraSlug = (r: RemoraConfig) => r.template;
