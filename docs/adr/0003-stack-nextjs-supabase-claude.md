# Next.js on Vercel, Supabase (Frankfurt), Claude via Bedrock (Ireland) for extraction

HeizCheck uses Next.js on Vercel (EU region), Supabase in Frankfurt for auth, Postgres and PDF storage, and Claude Sonnet 5 to turn PDFs into Extracted Figures in a fixed schema. Claude is called through Amazon Bedrock in-Region in `eu-west-1` (Ireland), on the `bedrock-mantle` endpoint with model `anthropic.claude-sonnet-5`, with Bedrock data retention set to `none`. The rules are plain TypeScript functions with unit tests. We chose this stack because it lets a small team ship fast while keeping Tenant personal data in the EU, as GDPR requires. Keeping the rules as pure functions keeps them deterministic and testable, as ADR 0001 requires.

We call Claude through Bedrock because it is the only route we found that pins processing to a single EU region. The Claude API and Claude Platform on AWS offer only `us` or `global` inference, and Microsoft Foundry offers only a US data zone. Google Cloud's `eu` endpoint could not be confirmed for Sonnet 5. On Bedrock, Anthropic has no access to prompts or completions. See `docs/research/claude-eu-access-route.md` for the evidence (checked 2026-09-29).

## Considered options

- **Claude API with `inference_geo`**: rejected. There is no EU value, and data at rest is stored in the US.
- **Bedrock EU geo profile (`eu.anthropic.claude-sonnet-5`)**: acceptable, but it routes across several EU Regions. We keep it as the fallback if in-Region capacity or quotas are too tight.
- **Google Cloud `eu` multi-region**: not chosen. Sonnet 5 availability there is unconfirmed, and it costs 10% more.

## Consequences

- AWS becomes a sub-processor, so our AV-Vertrag names AWS `eu-west-1` (Ireland) as the processing location for extraction. We need the AWS GDPR Data Processing Addendum in place.
- Before handling real Statement Packages, set account data retention to `none` in `eu-west-1` and confirm that Sonnet 5's `allowed_modes` includes `none`.
- We stay on Sonnet 5 rather than Sonnet 5.5, because Sonnet 5.5 is only offered through Bedrock's Global profile, which does not keep data in the EU. Revisit when an EU option appears.
- The Bedrock model card lists structured outputs as unsupported for Sonnet 5. If they are rejected, get the fixed schema through a strict tool and validate the result with Zod.
- Supabase holds PDFs and Check Reports under the 4-year retention period, so deletion has to be enforced there.
