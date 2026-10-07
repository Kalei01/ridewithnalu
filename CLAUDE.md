# Claude Code context

Read @CLOUD_CODE_CONTEXT.md before making substantial changes — it holds Nalu's product intent, reasoning model, and engineering rules.

Also follow @AGENTS.md (Lovable sync: never rewrite pushed history; keep `main` working).

Quality gate before every push: `bun run test` → `bun run typecheck` → `bun run build`.

Nalu has moved off Lovable to Cloudflare. `cloudflare` is the working (and default) branch; push there. `main` holds the retired Lovable version.

## Reviewer subagents (`.claude/agents/`)

Each one reviews and reports findings by severity; none of them fixes anything. Run the ones that match the change:

| Agent | Run it when |
|---|---|
| `transit-accuracy` | Any change under `src/lib`, `src/components/commute`, or the commute screens in `src/routes/index.tsx` |
| `mobile-design` | Any UI change: components, routes, CSS, or text riders see |
| `security-keys` | Before every push |
| `database` | Any new or edited file in `drizzle/migrations` or `drizzle/schema.ts` |

Fix critical and high findings before pushing.

## Specialist agent (builds, then validates)

| Agent | Use it when |
|---|---|
| `nalu-premium-experience` | The owner says "use the Nalu premium agent", or any UI, interaction, motion, onboarding or public-page experience task. It implements changes (audit first when no task is given), protects the commute intelligence, and runs the reviewers above as its quality gate. |
