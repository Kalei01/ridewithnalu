import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { rateLimit } from "./rate-limit.server";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MAX,
  FEEDBACK_TRIP_MAX,
  cleanFeedbackText,
  looksLikeSpam,
} from "./feedback-text";

// Per-visitor limit: a handful of notes an hour is plenty for a person.
const feedbackLimit = rateLimit("feedback", 5, 60 * 60_000);

/**
 * "Tell Nalu something". Stores one plain-text note for the weekly review. No
 * account or contact details are collected, and nothing is shown back to anyone.
 * If the table isn't there yet, or the note looks like spam, it is quietly
 * dropped and the rider still sees "thanks".
 */
export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([feedbackLimit])
  .inputValidator((input) =>
    z
      .object({
        category: z.enum(FEEDBACK_CATEGORIES),
        message: z.string().max(FEEDBACK_MAX * 4),
        tripNote: z
          .string()
          .max(FEEDBACK_TRIP_MAX * 4)
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const message = cleanFeedbackText(data.message, FEEDBACK_MAX);
    if (!message || looksLikeSpam(message)) return { ok: true };
    const tripNote = data.tripNote ? cleanFeedbackText(data.tripNote, FEEDBACK_TRIP_MAX) : "";
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: unknown }>;
      await rpc("submit_rider_feedback", {
        p_category: data.category,
        p_message: message,
        p_trip_note: tripNote,
      });
    } catch {
      /* feedback must never break the app */
    }
    return { ok: true };
  });
