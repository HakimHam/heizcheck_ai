# Explain chat: naive retrieval over markdown, dev/demo only

The Check Report gets an "Erklären" button on each rule with a Finding (ticket 20). It answers one question: "What does this Finding mean, and what do I do now?" HeizCheck finds the matching sections in a German markdown knowledge base (`knowledge/`) by keyword overlap, with the clicked rule's section pinned first. It sends them and the question to Claude Haiku 5.5 and shows the answer with its sources.

We chose naive keyword retrieval over vector search because the knowledge base has 19 short sections and the button already knows the rule ID. That exact lookup cannot miss. Keyword scoring only fills the remaining two places, plus free-text questions. Vector search would add an embedding provider and a vector store as two more sub-processors, plus a seeding step. Its similarity scores also can't be tested at a boundary the way a word count can. `feature/own-rag` built that vector pipeline (OpenAI embeddings + Pinecone) as a CLI. It is the comparison point in `docs/chatbot.md`.

Like the help chat (ADR 0004), the explain chat is **dev/demo only**. The question goes to the Claude API, which is not an EU sub-processor in the AV-Vertrag (ADR 0003), and a free-text box may contain Tenant data. The button and `POST /api/erklaerung` exist only when `EXPLAIN_CHAT_ENABLED=true`, and never when `VERCEL_ENV=production`. Only the rule ID and the question are sent. No Finding message, amounts, Units or other package data are sent.

## Considered options

- **Vector search (embeddings + Pinecone or pgvector)**: rejected for now. It pays off with hundreds of sections or many paraphrased questions, not with 19 sections and a known rule ID.
- **Send the whole knowledge base every time**: rejected. It's simpler, but it isn't retrieval, it costs tokens on every question, and it stops scaling once the knowledge base grows.
- **Send the Finding's message along with the question**: rejected. It would make answers more specific ("your Dispatch Date is 3 days late"), but the message names Units and amounts, which is package data going to a non-EU processor.
- **Answer inside the n8n help chat**: rejected. That workflow routes support tickets, and the retrieval, prompt and guardrails can't be tested with Vitest there.

## Consequences

- The explain chat can't tell whether a rule's Finding is an Error or a Warning, so its answers cover both cases.
- Synonyms the knowledge base doesn't use have to be added to the synonym map in `retrieve.ts` by hand.
- Production use needs Claude through Bedrock `eu-west-1`, as for extraction (ADR 0003), and a decision about sending the Finding message.
