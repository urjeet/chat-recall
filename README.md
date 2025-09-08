<div align="center">
<svg width="500" height="100" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#7C3AED;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#DB2777;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#2563EB;stop-opacity:1" />
        </linearGradient>
    </defs>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="50"   fill="url(#grad1)">
        chat recall
    </text>
</svg>
</div>

Chat Recall turns your personal conversations into a searchable memory. You start by exporting your iMessages to a CSV file through a Python script and uploading it into the app. Once uploaded, the messages are indexed and stored in a database, making it possible to query them naturally. You can ask questions like “What did I say to John about the trip?” or “What was I talking about on October 14th?” and the app will surface the most relevant snippets and provide a concise summary of the answer.

### How it works
- You upload a CSV of your messages using the plus button in the main box.
- The app processes the file and creates compact “windows” of nearby messages, then creates vector embeddings for each window.
- Those embeddings are stored in a Postgres database (Supabase) with the pgvector extension to enable fast semantic search.
- When a user asks a question, the app runs a vector search to find the most relevant windows, then calls an LLM to produce a helpful answer.
- The answer and your recent questions are shown below the box. You can re-upload a different file at any time by clicking the green check.

### What technologies are used and what they do
- Next.js (App Router): Frontend and API routes.
- Tailwind CSS: Styling and UI components.
- Supabase (Postgres + pgvector): Stores messages, message windows, and embeddings. Enables fast vector similarity search.
- LangChain: Helper utilities to connect embeddings, vector store, and LLMs.
- OpenAI API: Generates embeddings and answers to your questions.

### Database schema
Schema is defined in `supabase_schema.sql` and includes:
- `participants`:
  - `id` (UUID), `handle` (TEXT, unique), `display_name` (TEXT)
- `threads`:
  - `id` (UUID), `apple_chat_id` (TEXT, unique), `display_name` (TEXT)
- `messages`:
  - `id` (UUID), `source_message_id` (BIGINT, unique)
  - `thread_id` (UUID → `threads.id`), `sender_id` (UUID → `participants.id`)
  - `sent_at` (TIMESTAMPTZ), `body` (TEXT), `is_from_me` (BOOLEAN), `contact_name` (TEXT)
  - `day` (DATE, generated from `sent_at`), `body_tsv` (TSVECTOR for text search)
- `windows`:
  - `id` (UUID), `thread_id` (UUID → `threads.id`)
  - `start_ts`, `end_ts` (TIMESTAMPTZ), `message_count` (INT), `text_snippet` (TEXT)
- `window_embeddings`:
  - `id` (UUID), `content` (TEXT), `metadata` (JSONB), `embedding` (VECTOR(1536)), `window_id` (UUID → `windows.id`)

There’s an index on `messages.body_tsv` for full‑text search and an IVF vector index on `window_embeddings.embedding` for fast similarity search. A SQL function `match_window_embeddings` provides the exact interface expected by the SupabaseVectorStore for KNN search.

## Running locally

### Prerequisites
- Node.js 18+ and npm
- A Supabase project (or a Postgres instance with pgvector)
- OpenAI API key

### 1) Configure environment variables
Create a `.env.local` file in the project root with:

```
# OpenAI
OPENAI_API_KEY=your_openai_api_key
# Optional: override the default model (defaults to gpt-5-mini)
OPENAI_MODEL=gpt-4o-mini

# Supabase (Service Role key is required server-side for inserts)
SUPABASE_URL=https://your-project.ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_public_key
```

### 2) Create the database schema
- Open the Supabase SQL editor and run the contents of `supabase/schema.sql`.
- Ensure the `vector` extension is enabled and the tables/functions are created.

### 3) Install and run
```bash
npm install
npm run dev
```
Open `http://localhost:3000`.

### 4) Prepare and upload your data
- Use the built-in instructions page (`/instructions`) to export an `imessages.csv` from your Mac.
- On the homepage, click the plus button in the main box, select your CSV, then click “Upload and Process.”
- When processing completes, the icon becomes a green check and the input unlocks for questions.

## Key files
- Frontend UI: `src/app/page.tsx`
- Instructions page: `src/app/instructions/page.tsx`
- Upload endpoint: `src/app/api/upload-csv/route.ts`
- Query endpoint: `src/app/api/query/route.ts`
- Supabase client/config: `lib/supabase.ts`
- LangChain + vector store config: `lib/langchain_supabase.ts`
- OpenAI client: `lib/openai.ts`

If you get stuck, check the browser console and the terminal running `npm run dev` for errors.