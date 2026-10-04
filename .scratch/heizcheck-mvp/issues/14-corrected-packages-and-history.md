# 14: Corrected packages and history

**What to build:** When the Metering Provider sends a corrected Statement Package, the Property Manager uploads it for the same building and Billing Period. It supersedes the previous package, and both packages and both Check Reports are kept. See the spec: the Supersession section.

**Blocked by:** 03 (Tracer bullet).

**Status:** ready-for-agent

- [ ] When a building and Billing Period already have a package, uploading another one marks the older package as superseded by the new one.
- [ ] Nothing is deleted. The Superseded Package and its Check Report stay viewable.
- [ ] Views show the current package by default and link to its history.
- [ ] The history lists all packages and Check Reports for the building and Billing Period in order.
- [ ] The status in the buildings list reflects the current package only.
- [ ] Snapshot the building's address in each Check Report when it is created, as the Building Profile already is, and use it in the PDF export and the report view. Today the export prints the building's current address, so editing the address changes how old Check Reports read. Needs a migration (`check_reports` column + `confirm_statement_package`) and a backfill of existing reports from their building. Carried over from the #13 review.
