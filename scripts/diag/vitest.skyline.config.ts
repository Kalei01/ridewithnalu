// Runs only the Skyline slot replay (real timetable database; not part of `bun run test`).
// Run: bunx vitest run --config scripts/diag/vitest.skyline.config.ts
import { mergeConfig, type ConfigEnv, type UserConfig } from "vite";
import base from "../../vite.config";

export default async (env: ConfigEnv) =>
  mergeConfig(await (base as unknown as (env: ConfigEnv) => Promise<UserConfig>)(env), {
    test: {
      include: ["scripts/diag/skyline-slot.proof.ts"],
      testTimeout: 30 * 60_000,
      hookTimeout: 60_000,
    },
  });
