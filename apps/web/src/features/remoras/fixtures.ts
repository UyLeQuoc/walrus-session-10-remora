/**
 * The `packages/schema` W2 API fixtures (ADR-0033), parsed, for the page tests. Parsing here means a
 * contract change that breaks a page fails the build, not the demo.
 */
import {
  ApprovalRequest,
  BudgetMeter,
  FeedItem,
  InspectorResponse,
  OwnerSettings,
  RemoraView,
  SchedulePreview,
  VerifyResult,
  Wake,
} from "@remora/schema";
import approval from "@remora/schema/fixtures/approval.over-limit.json";
import meter from "@remora/schema/fixtures/budget-meter.json";
import feed from "@remora/schema/fixtures/feed.items.json";
import inspector from "@remora/schema/fixtures/inspector.json";
import settings from "@remora/schema/fixtures/owner-settings.json";
import scout from "@remora/schema/fixtures/remora-view.scout.json";
import preview from "@remora/schema/fixtures/schedule-preview.json";
import verify from "@remora/schema/fixtures/verify-result.payment.json";
import wake from "@remora/schema/fixtures/wake.payment.json";
import { z } from "zod";

export const FIXTURE_SCOUT = RemoraView.parse(scout);
export const FIXTURE_FEED = z.array(FeedItem).parse(feed);
export const FIXTURE_APPROVAL = ApprovalRequest.parse(approval);
export const FIXTURE_METER = BudgetMeter.parse(meter);
export const FIXTURE_SETTINGS = OwnerSettings.parse(settings);
export const FIXTURE_PREVIEW = SchedulePreview.parse(preview);
export const FIXTURE_VERIFY = VerifyResult.parse(verify);
export const FIXTURE_INSPECTOR = InspectorResponse.parse(inspector);
export const FIXTURE_WAKE = Wake.parse(wake);
