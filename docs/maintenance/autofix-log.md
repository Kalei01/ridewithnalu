# Autonomous fix log

Every fix an agent makes without Josh's approval, under the Autonomous Fix Safety Gate in `.claude/agents/nalu-lead.md`. Newest first. Escalated (🔴) issues are not logged here; they go in the weekly report in `docs/reviews/`.

Entry format:

```
### <YYYY-MM-DD HH:MM HST> — <short title>
- Class: 🟢 / 🟡
- Issue: what was detected (and by which agent/check)
- Root cause: file:line and why it failed
- Fix: what changed (files)
- Validation: what ran and the result (typecheck / tests / build / lint / regression / live)
- Confidence: high / medium
- Rollback: git revert <sha>
```

---

_No autonomous fixes yet._
