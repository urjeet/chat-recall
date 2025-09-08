import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { sb } from "./supabase";

export const embeddings = new OpenAIEmbeddings({ model: "text-embedding-3-small" });
export const llm = new ChatOpenAI({ model: process.env.OPENAI_MODEL || "gpt-5-mini" });

export const windowVectorStore = SupabaseVectorStore.fromExistingIndex(embeddings, {
  client: sb,
  tableName: "window_embeddings",
  queryName: "match_window_embeddings",
});
