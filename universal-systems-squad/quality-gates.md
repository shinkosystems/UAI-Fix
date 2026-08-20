# Quality Gates & Regras de Transição Inter-Agentes (BMAD)

Para garantir que nenhum bug, erro de tipo ou falha de segurança passe entre os agentes, aplicamos as seguintes regras de transição obrigatórias:

## Gate 1: Pedro PM → Sofia Design & Marcos AI
- [ ] `docs/bmad/PRD.md` gerado com escopo delimitado.
- [ ] Critérios de aceite das Histórias de Usuário definidos e sem ambiguidade.
- [ ] Requisitos de plataforma marcados (Web, PWA, iOS, Android, Windows, Mac).

## Gate 2: Sofia Design, Marcos AI & Bruno Supabase → Mateus Dev
- [ ] `DESIGN_SYSTEM.md` e `UI_SPECIFICATION.md` concluídos.
- [ ] `AI_ARCHITECTURE.md` e especificação de vetores `pgvector` finalizados.
- [ ] `schema.sql` e políticas de RLS no Supabase revisadas (100% de tabelas com RLS habilitado).

## Gate 3: Mateus Dev & Lucas Automation → Carla QA
- [ ] Código compilando limpo sem erros TypeScript (`tsc --noEmit`).
- [ ] Zero dependências circulares ou exceções mascaradas sem tratamento.
- [ ] Handlers de webhooks e integrações testados com mocks/ambientes de teste.

## Gate 4: Carla QA → Diego DevOps (Deploy Gate)
- [ ] Suíte de testes unitários e E2E 100% verde (aprovada).
- [ ] Auditoria de segurança sem vulnerabilidades HIGH ou CRITICAL.
- [ ] Validação de anti-alucinação em componentes de IA aprovada.
