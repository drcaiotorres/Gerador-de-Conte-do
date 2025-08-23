
# Social Content Studio (Starter • Updated)

Agora com embeddings **1536** (`text-embedding-3-small`) compatível com índice IVFFLAT.

## Passos
1) Instale deps: `npm install`
2) Crie `.env.local` a partir de `.env.sample` e preencha:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` (ex.: gpt-4.1-mini)
   - `EMBEDDINGS_MODEL=text-embedding-3-small`
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE`
3) No Supabase, rode **database/schema.sql** no SQL Editor.
4) Rode o app: `npm run dev` → http://localhost:3000

- Aba **Temas/Subtemas**: crie semanas e faça upload da planilha (coluna `ideia`).
- Aba **Treinamentos**: defina **Prompt Geral** e **Prompts por formato**.
- Aba **Resultado/Saída**: escolha a semana e clique **Gerar pacote (ordem 1→5)**.

Exporta Markdown; endpoints para histórico/versões, tagging e refação parcial já prontos.
