# Guia Rápido de Troubleshooting (Universal Squad)

## 1. Supabase & RLS (Row Level Security)
- **Problema:** A aplicação retorna `[]` (array vazio) ao buscar dados do Supabase.
- **Causa:** A tabela possui RLS habilitado mas nenhuma política permite leitura para a role `authenticated` ou `anon`.
- **Solução (Bruno Supabase):** Adicionar a política `CREATE POLICY "Permitir leitura" ON tabela FOR SELECT USING (true);` ou vincular a `auth.uid()`.

## 2. Erros de Build Vercel / Next.js
- **Problema:** O deploy falha no passo `next build` com erro de tipos ou variáveis de ambiente ausentes.
- **Solução (Diego DevOps & Mateus Dev):** Executar `npx tsc --noEmit` localmente e garantir que todas as variáveis `NEXT_PUBLIC_*` estejam configuradas no painel da Vercel.

## 3. Busca Vetorial (pgvector) sem Resultados
- **Problema:** A busca por similaridade de embeddings não retorna itens relevantes.
- **Solução (Marcos AI & Bruno Supabase):** Verificar se o índice de cosseno/L2 foi criado (`CREATE INDEX ON items USING ivfflat (embedding vector_cosine_ops)`) e validar o número de dimensões (ex: 1536 para OpenAI text-embedding-3-small).

## 4. Testes Automatizados E2E Falhando no CI
- **Problema:** O Playwright falha por timeout em componentes dinâmicos.
- **Solução (Carla QA):** Substituir `page.waitForTimeout()` por seletores explícitos baseados em papéis de acessibilidade `page.getByRole(...)`.
