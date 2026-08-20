# BMAD-Graph Engine: Macro e Micro Grafos de Agentes

O **BMAD-Graph Engine** suporta **Engenharia de Grafos em Dois Níveis Simultâneos**: o **Macro-Grafo de Squad** (entre agentes) e os **Micro-Grafos Internos de Sub-Ciclos** (dentro de cada agente).

---

## 1. Macro-Grafo (Orquestração Inter-Agentes)
Orquestra o fluxo de alto nível entre os 8 agentes especialistas com execução paralela na Fase M e feedback loops na Fase D.

---

## 2. Micro-Grafos Internos (Sub-Ciclos Intra-Agentes)

Cada agente especialista executa um **Micro-Grafo Interno de Decisão** durante seu ciclo autônomo de trabalho:

### A. Micro-Grafo do `mateus-dev` (Ciclo TDD Interno)

```mermaid
graph TD
    M1[Nó 1: Análise de Contrato & Tipos] --> M2[Nó 2: Red Phase - Escrever Teste Falhando]
    M2 --> M3[Nó 3: Green Phase - Implementação Mínima]
    M3 --> M_COND{Testes Passaram?}
    M_COND -- "NÃO (Erro)" --> M_RETRY[Ajustar Código / Abordagem]
    M_RETRY --> M3
    M_COND -- "SIM (Green)" --> M4[Nó 4: Refactor Phase - Clean Code & Linter]
    M4 --> M5[Emissão do Código Aprovado]
```

### B. Micro-Grafo do `marcos-ai` (Ciclo de IA & RAG Interno)

```mermaid
graph TD
    AI1[Nó 1: Ingestão de Contexto & Schema] --> AI2[Nó 2: Geração de Embeddings pgvector]
    AI2 --> AI3[Nó 3: Avaliação de Resposta & Latência]
    AI3 --> AI_COND{Score de Fidelidade > 90%?}
    AI_COND -- "NÃO (Alucinação)" --> AI_TUNE[Ajustar System Prompt & Chunking]
    AI_TUNE --> AI3
    AI_COND -- "SIM" --> AI4[Especificação Final de IA]
```

### C. Micro-Grafo da `carla-qa` (Ciclo de Auditoria & Security Interno)

```mermaid
graph TD
    QA1[Nó 1: Static Analysis - TypeCheck & Linter] --> QA2[Nó 2: Dynamic Analysis - Unit & E2E Tests]
    QA2 --> QA3[Nó 3: Security Audit - RLS & Secrets]
    QA3 --> QA_COND{Tudo Aprovado?}
    QA_COND -- "NÃO" --> QA_FAIL[Gerar Diagnóstico & Roteamento de Fix]
    QA_COND -- "SIM" --> QA_PASS[Emitir Quality Gate Approved]
```

---

## Vantagens dos Micro-Grafos Internos
- **Auto-Correção Local (Self-Healing Loop):** O agente tenta corrigir pequenos erros internamente antes de emitir o entregável para a próxima fase.
- **Raciocínio Estruturado:** Cada sub-tarefa passa por nós explícitos de validação interna.
- **Transparência Rastreável:** O log do agente registra a transição exata entre seus nós internos.

