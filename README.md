# HeizCheck

HeizCheck is a quality gate for German property managers: it checks heating cost statements from a metering provider before they are sent to tenants.

The project keeps the legal domain language in [CONTEXT.md](CONTEXT.md) and records architecture decisions in [docs/adr](docs/adr/). The app is designed for the German residential rental workflow, not for condominium administration or general billing software.

## What the product does

HeizCheck helps a property manager review a full statement package for one building and billing period:

- upload the building statement and unit statements
- read the PDFs with AI extraction
- let the property manager confirm the extracted figures
- run deterministic rules against the confirmed values and the building profile
- raise findings for legal issues, amounts at stake, and affected units
- produce a check report that is immutable once created

The core domain language is intentionally specific: Statement Package, Building Statement, Unit Statement, Cost Item, Eligible Cost Type, Check Report, Finding, and Severity. That terminology is defined in [CONTEXT.md](CONTEXT.md).

## Technology stack

- Next.js 16 for the web app and server-side logic
- Vercel deployment in Frankfurt (`fra1`)
- Supabase for authentication, Postgres, and storage
- TypeScript with Zod validation and Vitest tests
- AI extraction for PDFs through Claude, using Bedrock in production where required by the data residency constraints
- rule logic implemented as plain TypeScript functions for easy, testable validation

The stack decision is documented in [docs/adr/0003-stack-nextjs-supabase-claude.md](docs/adr/0003-stack-nextjs-supabase-claude.md).

## Repository layout

```text
.
├── src/                     # Next.js application code
│   ├── app/                 # routes, pages, API endpoints
│   ├── components/          # UI components
│   └── lib/                 # domain logic, utilities, rules
├── supabase/                # migrations and database setup
├── eval/                    # extraction accuracy evaluation fixtures and scripts
├── scripts/                 # helper scripts, RAG tooling, PDF checks
├── docs/                    # product docs, ADRs, deployment notes
├── knowledge/               # domain knowledge and rule explanations
├── assets/                  # static assets
├── n8n/                     # help-chat workflow artifacts
├── .env.example             # environment template
├── CONTEXT.md               # domain language and terminology
├── AGENTS.md                # repository agent guidance
├── package.json             # scripts and dependencies
├── vitest.config.ts         # test configuration
├── tsconfig.json            # TypeScript config
├── vercel.json              # deployment configuration
├── README.md                # project overview
└── ...
```

## Prerequisites

- Node.js 22 or newer
- npm
- A Supabase project in Frankfurt (`eu-central-1`)
- Optional: Anthropic API key for development-only extraction or RAG flows
- Optional: OpenAI and Pinecone keys for the RAG scripts

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Then open the local app in your browser at the usual Next.js dev URL, typically http://localhost:3000.

## Environment configuration

The project expects the environment variables described in [.env.example](.env.example). The most important settings are:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
CRON_SECRET=
EXTRACTOR=fake
ANTHROPIC_API_KEY=
N8N_HELP_WEBHOOK_URL=
N8N_HELP_WEBHOOK_SECRET=
OPENAI_API_KEY=
PINECONE_API_KEY=
```

Important notes:

- `EXTRACTOR` chooses how PDFs are processed: `fake`, `anthropic`, or `bedrock`.
- `anthropic` is development-only and must never be used with real tenant data in production.
- `ANTHROPIC_API_KEY` must not be set in the Vercel production environment.
- The help-chat and explain-chat settings are demo/dev only and should stay disabled in production unless intentionally enabled.

## Development scripts

```bash
npm run dev
npm run build
npm run start
npm run typecheck
npm test
npm run test:watch
```

Additional project-specific scripts:

```bash
npm run eval
npm run make-fixture
npm run rag:seed
npm run rag:ask
npm run rag:eval
```

### Extraction behavior

`EXTRACTOR` controls the PDF reading pipeline:

- `fake`: fixed demo document, no network dependency. This is the default and is used in tests.
- `anthropic`: Claude Sonnet 5 via the Anthropic API. Intended for development or eval usage only, with synthetic or anonymised PDFs.
- `bedrock`: production route for EU-resident processing, not yet fully implemented in this repo.

The project explicitly avoids using the Anthropic API in production because of data residency constraints. See [README.md](README.md) and the ADR for the reasoning.

## Testing

The repo uses Vitest for automated checks.

```bash
npm test
npm run typecheck
```

The project also includes evaluation scripts that compare AI extraction output against expected fixture data in [eval](eval/).

## Supabase setup

1. Apply the migration files in [supabase](supabase/) in order.
2. In the Supabase dashboard, set the Site URL for the deployed app.
3. Add the callback route to the allowed redirect URLs, typically `<app-url>/auth/callback`.
4. Keep the secret service role key out of the browser and only use it in server-side jobs.

## Deployment

The project is designed for Vercel deployment, with Git-based deploys from `main` to production and previews for other branches. The deployment guidance and operational steps are documented in [docs/deployment.md](docs/deployment.md).

## Legal and privacy notes

This project handles sensitive billing data for tenant cost allocations. The rules and operational design are shaped by the legal requirements around heating cost statements, billing deadlines, and data handling in the EU.

The repo deliberately keeps the legal basis in the code and documentation:

- [CONTEXT.md](CONTEXT.md) defines terminology
- [docs/adr](docs/adr/) captures key engineering and compliance decisions
- [knowledge](knowledge/) holds domain explanations and rule references

## Contributing

Before changing behavior, add or update a test that captures the expected outcome. The repo quality gate expects tests alongside behavior changes and a full verification run before calling work complete.

## License

This project does not currently declare a license in the root of the repository. If you plan to distribute or reuse it, confirm the licensing before publication.
