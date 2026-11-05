/**
 * D2 + D3 (ADR-0149, ADR-0150) as typed calls: rate a template (a personal-message signature), its
 * author's numbers, the badge's address, and a hatched remora's template update.
 */
import {
  MyRating,
  RatingMessage,
  RatingSaved,
  TemplateAnalytics,
  TemplateUpdateAccept,
  TemplateUpdates,
} from "@remora/schema";
import { z } from "zod";
import { call } from "@/features/remoras/api";

/** Where the badge is served: the site's own origin forwards `/badge/*` to the API (ADR-0149). */
export const badgeUrl = (origin: string, templateId: string) => `${origin}/badge/${templateId}.svg`;

export const extrasApi = {
  ratingMessage: (id: string, stars: number, text: string) =>
    call("POST", `/api/hatchery/${id}/rating/message`, RatingMessage, { stars, text }),
  rate: (id: string, b: { stars: number; text: string; at: string; signature: string }) =>
    call("POST", `/api/hatchery/${id}/rating`, RatingSaved, b),
  myRating: (id: string) => call("GET", `/api/hatchery/${id}/rating/me`, MyRating),
  analytics: (id: string) => call("GET", `/api/hatchery/${id}/analytics`, TemplateAnalytics),

  templateUpdates: (remoraId: string) =>
    call("GET", `/api/remoras/${remoraId}/template-update`, TemplateUpdates),
  acceptUpdate: (remoraId: string, id: string) =>
    call("POST", `/api/remoras/${remoraId}/template-update/${id}/accept`, TemplateUpdateAccept),
  updateSign: (remoraId: string, id: string) =>
    call(
      "POST",
      `/api/remoras/${remoraId}/template-update/${id}/sign`,
      z.object({ sign: TemplateUpdateAccept.shape.sign }),
    ),
  declineUpdate: (remoraId: string, id: string, reason: string) =>
    call(
      "POST",
      `/api/remoras/${remoraId}/template-update/${id}/decline`,
      z.object({ ok: z.boolean() }),
      { reason },
    ),
};
