# Claude Code context

Read @CLOUD_CODE_CONTEXT.md before making substantial changes — it holds Nalu's product intent, reasoning model, and engineering rules.

Also follow @AGENTS.md (Lovable sync: never rewrite pushed history; keep `main` working).

Quality gate before every push: `bun run test` → `bun run typecheck` → `bun run build`.

Nalu is moving off Lovable. `main` is frozen for Lovable; do new work on the `cloudflare` branch and push there, not to `main`.

## Reviewer subagents (`.claude/agents/`)

Each one reviews and reports findings by severity; none of them fixes anything. Run the ones that match the change:

| Agent | Run it when |
|---|---|
| `transit-accuracy` | Any change under `src/lib`, `src/components/commute`, or the commute screens in `src/routes/index.tsx` |
| `mobile-design` | Any UI change: components, routes, CSS, or text riders see |
| `security-keys` | Before every push |
| `database` | Any new or edited file in `drizzle/migrations` or `drizzle/schema.ts` |

Fix critical and high findings before pushing.
