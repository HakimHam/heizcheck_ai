# 15: Colleague invitations, AV-Vertrag download, 4-year retention

**What to build:** The remaining Organisation and data-protection work:

- A Property Manager can invite colleagues into their Organisation.
- A Property Manager can download the data processing agreement (AV-Vertrag).
- PDFs, packages and Check Reports are deleted automatically 4 years after they are created. That covers the 12-month objection window plus the 3-year limitation period (§195 BGB).

See the spec: modules 8 and 9.

**Blocked by:** 01 (Walking skeleton), 03 (Tracer bullet).

**Status:** ready-for-agent

- [ ] A Property Manager can invite a colleague by email. The invited colleague joins the same Organisation with equal rights.
- [ ] A Property Manager can download the AV-Vertrag. It names AWS `eu-west-1` (Ireland) as the processing location for extraction.
- [ ] A scheduled job deletes PDFs from storage, and packages and Check Reports from the database, 4 years after they were created.
- [ ] A test proves the job deletes only items older than 4 years.
- [ ] The retention job is the only thing that ever deletes a Check Report.
