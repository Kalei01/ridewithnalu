import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  area: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(300),
});

/**
 * The app reports a crash for the Problems list. Anyone can call it, so the
 * table groups repeats, caps its size, and limits notifications to 10 a day.
 */
export const reportAppProblem = createServerFn({ method: "POST" })
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data }) => {
    const { recordProblem } = await import("./problems.server");
    await recordProblem("app", data.area, data.message);
    return { ok: true };
  });
