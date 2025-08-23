
import OpenAI from "openai";
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";
export const EMBEDDINGS_MODEL = process.env.EMBEDDINGS_MODEL || "text-embedding-3-small";

export const MODEL_CANDIDATES = [
  process.env.OPENAI_MODEL, // respeita o .env primeiro
  "gpt-5-mini",
  "gpt-4o-mini",
  "gpt-4.1-mini",
].filter(Boolean) as string[];
