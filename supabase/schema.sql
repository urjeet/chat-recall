-- Enable the pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Create participants table
CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle TEXT UNIQUE,
  display_name TEXT
);

-- Create threads table
CREATE TABLE IF NOT EXISTS threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apple_chat_id TEXT UNIQUE,
  display_name TEXT
);

-- Create messages table with contact_name
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_message_id BIGINT UNIQUE,
  thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES participants(id),
  sent_at TIMESTAMPTZ NOT NULL,
  body TEXT,
  is_from_me BOOLEAN,
  contact_name TEXT,
  day DATE GENERATED ALWAYS AS ((sent_at AT TIME ZONE 'UTC')::date) STORED,
  body_tsv TSVECTOR
);

-- Create GIN index for full-text search on messages
CREATE INDEX IF NOT EXISTS idx_messages_body_tsv 
  ON messages USING gin(body_tsv);

-- Create windows table
CREATE TABLE IF NOT EXISTS windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,
  start_ts TIMESTAMPTZ NOT NULL,
  end_ts TIMESTAMPTZ NOT NULL,
  message_count INTEGER NOT NULL,
  text_snippet TEXT
);

-- Create window_embeddings table
CREATE TABLE IF NOT EXISTS window_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  metadata JSONB,
  embedding VECTOR(1536),
  window_id UUID REFERENCES windows(id) ON DELETE CASCADE
);

-- Create the IVF index for vector search
CREATE INDEX IF NOT EXISTS idx_window_embeddings_ivfflat
  ON window_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Create the match function with the exact signature SupabaseVectorStore expects
CREATE OR REPLACE FUNCTION match_window_embeddings(
    query_embedding VECTOR(1536),
    match_count INT DEFAULT 10,
    filter JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    window_embeddings.id,
    window_embeddings.content,
    window_embeddings.metadata,
    1 - (window_embeddings.embedding <=> query_embedding) AS similarity
  FROM window_embeddings
  WHERE 1 - (window_embeddings.embedding <=> query_embedding) > 0.1
  ORDER BY window_embeddings.embedding <=> query_embedding
  LIMIT match_count;
$$;
