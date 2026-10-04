# 17: Bedrock transport for production extraction

**What to build:** Production extraction runs through Amazon Bedrock as set out in ADR 0003. The `ClaudeExtractor` from ticket 11 gets a Bedrock transport:

- in-Region in `eu-west-1`
- on the `bedrock-mantle` endpoint (`AnthropicBedrockMantle` from `@anthropic-ai/bedrock-sdk`), with model `anthropic.claude-sonnet-5`
- with account data retention set to `none`

The prompt, the tool schema and the Zod validation are ticket 11's and stay shared. This ticket adds wiring and verification only.

**Blocked by:** 11 (Claude extraction + eval). Also needs AWS account access with Bedrock in `eu-west-1`.

**Status:** ready-for-human

**Account setup (human)**

- [ ] AWS account with Bedrock model access for Sonnet 5 in `eu-west-1`.
- [ ] Account data retention set to `none` in `eu-west-1`, and Sonnet 5's `allowed_modes` confirmed to include `none`.
- [ ] AWS GDPR Data Processing Addendum in place. The AV-Vertrag (ticket 15) names AWS `eu-west-1` (Ireland).

**Transport**

- [ ] `EXTRACTOR=bedrock` uses the Bedrock transport. Credentials come from environment variables. Neither Sonnet 5.5 nor the Global or EU geo profile is used. The EU geo profile stays the fallback named in ADR 0003 if in-Region quotas are too tight.
- [ ] One real call with a synthetic package confirms the facts the AWS model card leaves open:
  - mantle accepts `strict: true` on the tool. If it doesn't, drop `strict` on this transport only, since Zod still guards the output.
  - mantle accepts PDF `document` blocks, and within what size and page limits.
  - the Region and model ID, recorded from the response or CloudTrail.
- [ ] Production (`VERCEL_ENV=production`) uses `EXTRACTOR=bedrock`.

**Eval**

- [ ] `npm run eval` can run against the Bedrock transport.
- [ ] It's re-run on Bedrock with 5–10 real, properly redacted Minol packages. The result (target ≥ 95%) is noted under Comments. This feeds ticket 16.
