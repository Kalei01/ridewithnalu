import { Check } from "lucide-react";
export function VerdictCard({ headline, metrics, reason, children }: { headline: string; metrics?: Array<{ label: string; value: string; accent?: boolean }>; reason?: string | null; children?: React.ReactNode }) {
  return <section className="verdict-lift -mx-2 mt-5 rounded-lg border border-border px-5 py-7" aria-labelledby="verdict-title">
    <div className="mb-5 flex items-center gap-2 text-recommended"><span className="flex size-6 items-center justify-center rounded-full bg-recommended text-recommended-foreground"><Check className="size-4 stroke-[3]" /></span><span className="text-xs font-bold uppercase">Nalu says</span></div>
    <h1 id="verdict-title" className="max-w-[390px] text-4xl font-bold leading-none text-foreground">{headline}</h1>
    {metrics?.length ? <div className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-5">{metrics.map((metric) => <div key={metric.label}><p className="text-xs text-muted-foreground">{metric.label}</p><p className={`mt-1 text-xl font-bold tabular-nums ${metric.accent ? "text-recommended" : "text-foreground"}`}>{metric.value}</p></div>)}</div> : null}
    {reason && <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-foreground">Why?</summary><p className="mt-2 text-sm text-muted-foreground">{reason}</p></details>}
    {children}
  </section>;
}
