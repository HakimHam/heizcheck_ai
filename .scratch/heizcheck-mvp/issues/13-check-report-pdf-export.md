# 13: Check Report PDF export

**What to build:** A Property Manager can export any stored Check Report as a PDF in German, to file it or send it to the Metering Provider. See the spec: module 6.

**Blocked by:** 03 (Tracer bullet).

**Status:** ready-for-agent

- [ ] The export renders the stored Check Report and never recomputes it.
- [ ] The PDF lists every Check Result. For each Finding it shows the Severity, legal reference, affected Units and amount at stake, with Errors before Warnings.
- [ ] The PDF shows the building, the Billing Period, the Dispatch Date, the Ruleset version and when the Check Report was created.
- [ ] The PDF includes the disclaimer.
- [ ] All text is in German.
