# Desenho da Engenharia de Grafos (Graph Engineering) - UAI-Fix

Este documento apresenta a visualização gráfica e arquitetura de dados baseada em Grafos de Tarefas e Conhecimento para o sistema **UAI-Fix**.

---

## 📊 1. Knowledge Graph (Grafo de Conhecimento das Entidades)

O diagrama abaixo ilustra as relações e integridade referencial entre as tabelas do banco de dados (Supabase) mapeadas para a tomada de decisão da IA.

```mermaid
erDiagram
    USERS ||--o{ CHAVES : "solicita / executa / planeja"
    CHAVES ||--|| PLANEJAMENTO : "detalha escopo técnico"
    CHAVES ||--|| ORCAMENTOS : "define custos e preços"
    CHAVES ||--o{ AGENDA : "agenda execução no calendário"
    CHAVES ||--|| ORDEMSERVICO : "emite documento oficial"
    CHAVES ||--o{ AVALIACOES : "coleta satisfação pós-venda"
```

---

## 🔄 2. Task Graphs (Fluxos de Processos e Workflows)

### Grafo A: Solicitação e Planejamento Técnico/Financeiro
Este fluxo paralisa o fluxo principal para planejar e orçar serviços simultaneamente, requerendo a aprovação do consumidor antes de agendar o profissional.

```mermaid
flowchart TD
    ENTRY_A([ENTRY]) --> Planner_Triagem[Planner: Triagem de Chamado]
    Planner_Triagem --> Worker_Planejamento[Worker: Planejamento Técnico]
    Planner_Triagem --> Worker_Orcamento[Worker: Cálculo de Orçamento]
    Worker_Planejamento --> Synthesizer_Compilacao[Synthesizer: Compilação de Proposta]
    Worker_Orcamento --> Synthesizer_Compilacao
    Synthesizer_Compilacao --> Gate_Aprovacao{Interaction: Aprovação do Cliente}
    Gate_Aprovacao -->|Aprovado| EXIT_A([EXIT - Status: aprovado])
    Gate_Aprovacao -->|Rejeitado| EXIT_REJ([EXIT - Status: recusado])
```

---

### Grafo B: Agendamento e Execução Física do Serviço
Este fluxo cuida da alocação de profissionais qualificados na cidade correspondente, sincronização do calendário e acompanhamento da OS por meio de fotos antes/depois da atividade.

```mermaid
flowchart TD
    ENTRY_B([ENTRY]) --> Planner_Alocacao[Planner: Alocação de Profissional]
    Planner_Alocacao --> Worker_Calendar[Worker: Google Calendar API]
    Planner_Alocacao --> Worker_WhatsApp[Worker: Notificação WhatsApp Z-API]
    Worker_Calendar --> Gate_Inicio{Interaction: Início Execução Local}
    Worker_WhatsApp --> Gate_Inicio
    Gate_Inicio --> Worker_ControleOS[Worker: Controle de OS & Foto Antes]
    Worker_ControleOS --> Gate_Fim{Interaction: Conclusão & Foto Depois}
    Gate_Fim --> Worker_Encerramento[Worker: Encerramento de OS & PDF]
    Worker_Encerramento --> EXIT_B([EXIT - Status: concluido])
```

---

### Grafo C: Pós-Venda, Controle de Qualidade e Auditoria
O pós-venda utiliza regras baseadas no score dado pelo cliente. Casos com notas baixas geram alarmes e mudam o status para revisão pelo Gestor.

```mermaid
flowchart TD
    ENTRY_C([ENTRY]) --> Planner_PosVenda[Planner: Pós-Venda]
    Planner_PosVenda --> Worker_DisparaAvaliacao[Worker: Dispara Avaliação]
    Worker_DisparaAvaliacao --> Gate_Review{Interaction: Review do Cliente}
    Gate_Review --> Switch_Score{Switch: Avaliação Score}
    Switch_Score -->|Nota menor que 3| Worker_Auditoria[Worker: Auditoria de Qualidade]
    Switch_Score -->|Nota maior ou igual a 3| Worker_Ranking[Worker: Atualiza Ranking Elite]
    Worker_Auditoria --> EXIT_C([EXIT - Chamado de Erro])
    Worker_Ranking --> EXIT_C([EXIT - Score Atualizado])
```
