# Memória & Aprendizados Acumulados (Universal Systems Squad)

## Padrões Estabelecidos
- **Segurança Supabase:** Políticas RLS ativas em 100% das tabelas. Nunca expor a Service Role Key no frontend.
- **Multiplataforma:** Separação limpa entre lógica de negócios (hooks/services) e renderizadores de UI (Web vs Native vs Desktop).
- **Verificação Empírica:** Build e suíte de testes devem ser executados e aprovados antes de qualquer deploy Vercel ou EAS.
