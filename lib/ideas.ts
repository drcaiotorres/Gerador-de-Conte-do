
import { supabaseServer } from "./supabaseServer";
import OpenAI from "openai";
import { EMBEDDINGS_MODEL } from "./openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function topIdeasForTheme(theme: string, limit = 20) {
  const emb = await client.embeddings.create({
    model: EMBEDDINGS_MODEL,
    input: theme
  });
  const q = emb.data[0].embedding as unknown as number[];
  const supabase = supabaseServer();
  const { data, error } = await supabase.rpc("match_ideas", {
    query_embedding: q,
    match_count: limit
  });
  if (error) throw error;
  return data as { id: string; texto: string; score: number }[];
}
