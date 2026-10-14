// Runs only the Phase 2 side-by-side proof (real timetable database; not part of `bun run test`).
// Run: bunx vitest run --config scripts/phase2/vitest.config.ts
import { mergeConfig, type ConfigEnv, type UserConfig } from "vite";
import base from "../../vite.config";

export default async (env: ConfigEnv) =>
  mergeConfig(await (base as unknown as (env: ConfigEnv) => Promise<UserConfig>)(env), {
    test: { include: ["scripts/phase2/*.proof.ts"], testTimeout: 30 * 60_000, hookTimeout: 60_000 },
  });
