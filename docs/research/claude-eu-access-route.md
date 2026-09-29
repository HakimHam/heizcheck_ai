# Which way of calling Claude keeps data in the EU with no training

Research for the precondition in ADR 0003: Claude must be called through a route that processes data in an EU region with no training on customer data. Checked against official docs on 2026-09-29.

## Answer

**Amazon Bedrock, with Claude Sonnet 5, called in-Region in `eu-west-1` (Ireland) through the `bedrock-mantle` endpoint, with data retention set to `none`.**

The first-party Claude API does not meet the requirement today. Google Cloud's `eu` endpoint probably does, but its model list for that endpoint could not be confirmed.

## The options

| Route | EU processing? | Training on our data? | Verdict |
|---|---|---|---|
| Claude API (api.anthropic.com) | **No.** `inference_geo` accepts only `"global"` and `"us"`. Workspace geo (storage at rest) is `"us"` only. | No, not without express permission | Fails the EU requirement |
| Claude Platform on AWS | **No.** Same `inference_geo` values; workspace geo is effectively `"us"` | No | Fails |
| Microsoft Foundry | **No.** The only residency option is the US Data Zone | No | Fails |
| Google Cloud (Vertex / Agent Platform), `region: "eu"` | Yes, when the `eu` multi-region endpoint serves the model | No. Google is the processor under Google's terms | Plausible. It is unconfirmed whether Sonnet 5 is served on `eu`, and single-region endpoints only go up to Sonnet 4.6. Costs 10% more |
| **Amazon Bedrock, `eu.anthropic.claude-sonnet-5` geo profile** (bedrock-runtime) | Yes: "Keeps data within EU regions" | No. Model providers have no access to prompts or completions | Meets the requirement. Requests are spread across EU Regions |
| **Amazon Bedrock, `anthropic.claude-sonnet-5` in-Region on bedrock-mantle, `eu-west-1` or `eu-north-1`** | Yes, in a single Region | No, same as above | **Recommended**: strongest residency guarantee |

## Evidence

**Claude API.** "Currently, `"us"` is the only available workspace geo." Under "Current limitations": "Inference geo: Only `"us"` and `"global"` are available." On Bedrock and Google Cloud, "the inference region is determined by the endpoint URL or inference profile." Source: <https://platform.claude.com/docs/en/manage-claude/data-residency>

**Bedrock, Sonnet 5 model card.**
- Geo inference IDs: `us.`, `eu.` and `au.anthropic.claude-sonnet-5`.
- "EU geo (`eu.anthropic.claude-sonnet-5`): Keeps data within EU regions."
- The `bedrock-mantle` in-Region table lists `eu-north-1` and `eu-west-1`.
- "For single-Region inference, use the `bedrock-mantle` endpoint with the bare model ID."

Source: <https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-5.html>

**Bedrock, Sonnet 5.5.** This model launched on 2026-09-28 and is currently offered only through the **Global** profile (`global.anthropic.claude-sonnet-5-5`), which "routes worldwide with no residency constraints." It must not be used until an EU profile appears. Source: <https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-5-5.html>

**Bedrock and model providers.** "Because the model providers don't have access to those accounts, they don't have access to Amazon Bedrock logs or to customer prompts and completions." Source: <https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html>

**Bedrock data retention modes.**
- `none`: "No request or response data is written to durable storage by AWS or shared with the model provider."
- `default`: AWS "may retain the data for safety and abuse-prevention purposes. The model provider does not receive it."
- Retained data for cross-Region inference "is stored in destination Regions."
- Only the Fable models require `aws_review`.

Source: <https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html>

**Google Cloud.** "Multi-region endpoints: Dynamically route requests across regions within a geographic area (currently `us` and `eu`)." There is a "10% pricing premium over global endpoints." Code comment in the docs: "Specific regional endpoints support Claude Sonnet 4.6 and earlier; newer models use the global or multi-region endpoints." Source: <https://platform.claude.com/docs/en/build-with-claude/claude-on-vertex-ai>

## Why Bedrock in-Region over the EU geo profile

Both keep data in the EU. In-Region pins every request to one Region, so the processing location in the AV-Vertrag and the privacy notice is a single fact ("AWS eu-west-1, Ireland"), not a list of Regions that may change. Supabase stays in Frankfurt, and both are inside the EU. The geo profile is the fallback if in-Region capacity or quotas are too tight.

## What changes in the code

- TypeScript client: `AnthropicBedrockMantle` from `@anthropic-ai/bedrock-sdk`, with `awsRegion: "eu-west-1"` and model `anthropic.claude-sonnet-5`. The request shape is the normal Messages API.
- PDF input is supported on every platform.
- **To check before building extraction:** the Bedrock Sonnet 5 model card lists "Structured outputs" as *not supported* on both endpoints. Anthropic's feature table says structured outputs and strict tool use are supported on Bedrock. If `output_config.format` is rejected, get the fixed schema through a single tool with `strict: true` (`tool_choice: auto`, with the prompt telling the model to call it) and validate the result with Zod. ADR 0001 needs deterministic, validated Extracted Figures either way.

## Setup steps (not done yet)

1. Create an AWS account and accept the AWS GDPR Data Processing Addendum (it is part of the AWS Service Terms). This is the sub-processor entry behind our own AV-Vertrag.
2. In `eu-west-1`, set account data retention to `none` (`PUT /v1/data_retention` on bedrock-mantle). Confirm with `GET /v1/models/anthropic.claude-sonnet-5` that `allowed_modes` includes `none`. If it does not, `default` still keeps data within AWS and away from Anthropic, but the retention period must be written into the privacy notice.
3. Optional hardening: add an SCP that denies any data retention mode other than `none`.
4. Send one request with a synthetic Minol PDF and record the Region and model ID from the response or CloudTrail.

## Open points

- Whether `allowed_modes` for Sonnet 5 includes `none` (step 2).
- Whether structured outputs work on Bedrock Sonnet 5 (see above).
- Re-check when Sonnet 5.5 gets an `eu.` profile or an EU in-Region listing. It is the stronger model at the same price.
- ~~Record the route in ADR 0003.~~ Done on 2026-09-29.
