# Especificação de Micro-Grafos dos 9 Agentes do Squad

Este documento contém o **mapeamento detalhado dos Micro-Grafos Internos** de cada um dos 9 especialistas do **Universal Multiplatform & AI Systems Squad**. 

Utilize estes diagramas para compreender o fluxo interno de decisão de cada agente e identificar pontos exatos de otimização no desenvolvimento.

---

## 1. Micro-Grafo: `pedro-pm` (Product Manager)

```mermaid
graph TD
    P1[Nó 1: Extração da Visão & Intenção do Negócio] --> P2[Nó 2: Delimitação do Escopo MVP & Restrições]
    P2 --> P3[Nó 3: Decomposição em Histórias de Usuário]
    P3 --> P4[Nó 4: Definição dos Critérios de Aceite]
    P4 --> P_COND{Histórias são Atômicas e Testáveis?}
    P_COND -- "NÃO" --> P2
    P_COND -- "SIM" --> P5[Nó 5: Emissão do PRD.md & USER_STORIES.md]
```

---

## 2. Micro-Grafo: `fernando-reports` (Plataformas Externas, Figma, Supabase & Relatórios)

```mermaid
graph TD
    FR1[Nó 1: Conexão via MCP / APIs com Figma & Supabase] --> FR2[Nó 2: Extração de Layouts, Tokens & Schemas SQL]
    FR2 --> FR3[Nó 3: Consolidação de Métricas, Logs & Inspeção de RLS]
    FR3 --> FR_COND{Dados Extraídos com Sucesso?}
    FR_COND -- "NÃO (Falha de Token/Rede)" --> FR_RETRY[Renovar Credenciais & Retentar]
    FR_RETRY --> FR1
    FR_COND -- "SIM" --> FR4[Nó 4: Geração do FIGMA_AUDIT & SUPABASE_DIAGNOSTIC]
    FR4 --> FR5[Distribuição de Dados aos Agentes sofia-design, bruno-supabase e mateus-dev]
```

**Pontos de Otimização no `fernando-reports`:**
- **Nó 1 (Conexão MCP):** Automatizar reconexão silenciosa com o servidor Figma MCP e Supabase REST/GraphQL.
- **Nó 4 (Relatórios):** Estruturar em JSON + Markdown para consumo tanto por humanos quanto por agentes downstream.

---

## 3. Micro-Grafo: `sofia-design` (UX/UI & Design Specialist)

```mermaid
graph TD
    S1[Nó 1: Seleção de Paleta HSL & Tokens Visuais] --> S2[Nó 2: Mapeamento de Layouts Multiplataforma]
    S2 --> S3[Nó 3: Especificação de Componentes & Estados]
    S3 --> S4[Nó 4: Auditoria de Contraste & Acessibilidade WCAG]
    S4 --> S_COND{Aprovado em HIG Apple & Material?}
    S_COND -- "NÃO" --> S2
    S_COND -- "SIM" --> S5[Nó 5: Emissão do DESIGN_SYSTEM.md & UI_SPEC.md]
```

---

## 4. Micro-Grafo: `marcos-ai` (AI & Agentic Systems Architect)

```mermaid
graph TD
    M1[Nó 1: Mapeamento de Casos de Uso de IA & RAG] --> M2[Nó 2: Modelagem do Schema pgvector & Embeddings]
    M2 --> M3[Nó 3: Construção da Estrutura de Prompts & Skills]
    M3 --> M4[Nó 4: Avaliação de Latência & Anti-Alucinação]
    M4 --> M_COND{Fidelidade de Resposta >= 90%?}
    M_COND -- "NÃO (Alucinação/Erro)" --> M_TUNE[Ajustar System Prompt & Chunking]
    M_TUNE --> M3
    M_COND -- "SIM" --> M5[Nó 5: Emissão do AI_ARCHITECTURE.md & MCP_SPEC.md]
```

---

## 5. Micro-Grafo: `bruno-supabase` (Supabase & Cloud Architect)

```mermaid
graph TD
    B1[Nó 1: Modelagem Relacional PostgreSQL] --> B2[Nó 2: Geração de Políticas RLS por Tabela]
    B2 --> B3[Nó 3: Configuração de Auth, Storage & Buckets]
    B3 --> B4[Nó 4: Validação de DDL & Teste de Permissões RLS]
    B4 --> B_COND{100% de Tabelas com RLS Protegido?}
    B_COND -- "NÃO (Vazamento)" --> B2
    B_COND -- "SIM" --> B5[Nó 5: Emissão do schema.sql & rls_policies.sql]
```

---

## 6. Micro-Grafo: `lucas-automation` (Automation & Workflow Specialist)

```mermaid
graph TD
    L1[Nó 1: Mapeamento de Eventos & Disparadores] --> L2[Nó 2: Desenho de Endpoints & Handlers de Webhooks]
    L2 --> L3[Nó 3: Implementação de Verificação de Assinatura]
    L3 --> L4[Nó 4: Teste de Idempotência & Politica de Retentativa]
    L4 --> L_COND{Lida com Falhas de Rede?}
    L_COND -- "NÃO" --> L3
    L_COND -- "SIM" --> L5[Nó 5: Emissão do WORKFLOWS.md & webhooks/]
```

---

## 7. Micro-Grafo: `mateus-dev` (Lead Universal Developer - Ciclo TDD)

```mermaid
graph TD
    D1[Nó 1: Leitura de Contratos & PRD] --> D2[Nó 2: Red Phase - Escrever Testes Falhando]
    D2 --> D3[Nó 3: Green Phase - Código Mínimo Funcional]
    D3 --> D4[Nó 4: Compilação TypeScript & Linters]
    D4 --> D_COND{Testes Passaram & Zero Erros de Tipo?}
    D_COND -- "NÃO" --> D_FIX[Auto-Correção Interna do Código]
    D_FIX --> D3
    D_COND -- "SIM" --> D5[Nó 5: Refactor Phase - Clean Code & Performance]
    D5 --> D6[Emissão do Código-Fonte Aprovado]
```

---

## 8. Micro-Grafo: `carla-qa` (QA, Refactoring & Security Gatekeeper)

```mermaid
graph TD
    Q1[Nó 1: Análise Estática - TypeCheck & Linter] --> Q2[Nó 2: Análise Dinâmica - Unit & E2E Tests]
    Q2 --> Q3[Nó 3: Auditoria de Segurança RLS & Secrets]
    Q3 --> Q4[Nó 4: Avaliação de Respostas de IA]
    Q4 --> Q_COND{Critérios de Aceite Aprovados?}
    Q_COND -- "FALHA DE CÓDIGO" --> Q_FAIL1[Roteamento de Erro -> mateus-dev]
    Q_COND -- "FALHA DE RLS" --> Q_FAIL2[Roteamento de Erro -> bruno-supabase]
    Q_COND -- "SIM (Tudo Aprovado)" --> Q5[Nó 5: Emissão do QUALITY_REPORT.md Approved]
```

---

## 9. Micro-Grafo: `diego-devops` (DevOps & Multi-Deploy Specialist)

```mermaid
graph TD
    V1[Nó 1: Validação de Variáveis de Ambiente & Segredos] --> V2[Nó 2: Execução de Build Vercel / EAS / Desktop]
    V2 --> V3[Nó 3: Teste de fumaça (Smoke Test) pós-deploy]
    V3 --> V_COND{Build & Deploy Aprovados?}
    V_COND -- "NÃO" --> V_FIX[Ajustar Configuração / Flags de Build]
    V_FIX --> V2
    V_COND -- "SIM" --> V4[Nó 4: Publicação de Release & Tagging]
```
