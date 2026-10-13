# Help chat via n8n, dev/demo only

Signed-in Property Managers can send a help message. HeizCheck forwards it to an n8n workflow that classifies it with Claude Haiku 5.5 and routes it, either into a table or as an email alert (ticket 19). The workflow runs on a bootcamp n8n Cloud account whose region we don't know, and it calls the Claude API directly. Neither of these is an EU-only processor named in our AV-Vertrag. ADR 0003 requires that for anything that may contain Tenant personal data, and a free-text help box may contain it.

So the help chat is **dev/demo only**. The icon renders only when `N8N_HELP_WEBHOOK_URL` is set, and that variable is not set on Vercel production. The input shows "Bitte keine Mieterdaten eingeben.", and we test only with made-up messages.

The browser never calls n8n directly. `POST /api/hilfe` validates the body, adds the user and Organisation from the session, and forwards the request with a shared secret. This way the webhook URL stays private, and n8n gets an identity it can trust.

## Considered options

- **Browser POSTs straight to the n8n webhook**: rejected. The URL would be public, anyone could send messages to it, and the user's identity would come from the client.
- **Turn it on in production now**: rejected. It would add two sub-processors outside our EU setup without an AV-Vertrag entry.

## Consequences

- Production use needs the following:
  - n8n hosted in the EU (n8n Cloud in the EU region, or self-hosted in the EU)
  - classification through Bedrock `eu-west-1` instead of the Claude API
  - Google (Gmail) and the n8n host named as sub-processors in the AV-Vertrag (ticket 15)
- The bootcamp n8n account is temporary. The workflow is committed as JSON (`n8n/hilfe-klassifizierung.workflow.json`) so it can be re-imported elsewhere.
- n8n uses the same Anthropic API key as the dev extraction route. If that key is revoked or rotated, it has to be changed in both `.env.local` and the n8n credential.
- Help messages are not stored in Supabase. The n8n Data Table is the only record, which avoids a new store of personal data in HeizCheck.
