# Sample Heating Cost Statements

This directory contains anonymized sample files used to test **HeizCheck** against German residential compliance rules (**HeizkostenV**, **CO2KostAufG**, and **§ 556 BGB**).

## Available Test Cases

| File | Scenario | Expected Result |
| :--- | :--- | :--- |
| `sample-valid.pdf` *(ou `.json`)* | Standard compliant statement from a metering provider | ✅ **Passed** — All 11 rules satisfied |
| `sample-invalid-split.pdf` | Invalid consumption-to-base cost allocation ratio | ❌ **Failed** — Triggers **§ 7 HeizkostenV** violation |
| `sample-co2-mismatch.pdf` | Incorrect landlord/tenant CO₂ cost tier allocation | ❌ **Failed** — Triggers **CO2KostAufG** violation |
| `sample-billing-period.pdf` | Billing period exceeding the 12-month statutory limit | ❌ **Failed** — Triggers **§ 556 (3) BGB** violation |

## How to Use

* **Online Demo:** Use the **"Load Sample"** selector directly in the web interface to run the extraction and rule engine without uploading a file.
* **Local Testing:** Upload any file from this folder into your local instance of HeizCheck to verify the PDF extraction and deterministic rule findings.

> **Note:** All names, addresses, and meter numbers in these files are purely fictional and contain no real personal data (GDPR/DSGVO compliant).
