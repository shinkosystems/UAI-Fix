# Plano de Implementação: Otimizações de Desempenho, Segurança e Graph Engineering no UAI-Fix

Este documento detalha o plano de implementação técnica para solucionar os gargalos de performance, riscos de segurança e a estruturação de Engenharia de Grafos (Graph Engineering) no sistema **UAI-Fix**.

## User Review Required

> [!IMPORTANT]
> A remoção da carga inicial completa da tabela de `cidades` em `Settings.tsx` altera a forma como o filtro de usuários por cidade funciona. O filtro passará a verificar o campo `cidade_data` (já incluso no join do Supabase) em vez de realizar buscas locais em uma lista em memória de 5.500+ registros.

> [!WARNING]
> Os scripts temporários com credenciais expostas na raiz (ex: `test-wa.js`, `test-db.js`, `check_cols.js`) serão removidos do repositório. Certifique-se de configurar as variáveis no arquivo `.env.local` antes de rodar os testes locais.

## Estrutura de Graph Engineering Cadastrada

Criamos o arquivo de especificação macro em [.agents/workflows/uaifix_macro_graph.json](file:///Users/pedroborba/Documents/GitHub/UAI-Fix/.agents/workflows/uaifix_macro_graph.json) contendo:
1. **Knowledge Graph**: Mapeia as relações das entidades (`chaves`, `planejamento`, `orcamentos`, `agenda`, `ordemservico`, `avaliacoes`).
2. **Task Graphs**:
   - `grafo_A_solicitacao_e_planejamento`: Orquestração de solicitações de clientes rurais/urbanos, orçamentos, visitas prévias e aprovação manual.
   - `grafo_B_agendamento_e_execucao`: Integração automática de Google Calendar, notificações Z-API WhatsApp e controle de início/fim da OS.
   - `grafo_C_pos_venda_e_auditoria`: Trilha de auditoria pós-execução, coleta de reviews e desvio de controle de qualidade para baixas notas.

---

## Proposed Changes

### Componente: Graph Engineering & Workflows

#### [NEW] [uaifix_macro_graph.json](file:///Users/pedroborba/Documents/GitHub/UAI-Fix/.agents/workflows/uaifix_macro_graph.json)
- Especificação formal dos grafos de conhecimento e de tarefas para o sistema UAI-Fix, espelhando a arquitetura robusta do SOS (nf-system).

### Componente: Frontend Views & Database Connections

#### [MODIFY] [ClientOrders.tsx](file:///Users/pedroborba/Documents/GitHub/UAI-Fix/pages/ClientOrders.tsx)
- Modificar o método `loadData` para realizar um join relacional nativo no Supabase, buscando apenas as atividades (`geral`) e profissionais (`users`) relacionados às chaves do cliente.
- Remover as queries genéricas `supabase.from('geral').select('*')` e `supabase.from('users').select('*')`.

#### [MODIFY] [Settings.tsx](file:///Users/pedroborba/Documents/GitHub/UAI-Fix/pages/Settings.tsx)
- Remover o carregamento inicial da tabela completa de `cidades` do método `fetchData`.
- Atualizar as funções `getCityNameForDisplay`, `getFormCityDisplay` e a filtragem de `filteredUsers` para utilizarem exclusivamente o campo `cidade_data` já retornado no join da consulta de usuários.

#### [MODIFY] [Search.tsx](file:///Users/pedroborba/Documents/GitHub/UAI-Fix/pages/Search.tsx)
- Reduzir o número de chamadas de contagem de profissionais por categoria principal em `fetchCounts`. Substituir o loop de queries por uma agregação simplificada ou agrupar os IDs de atividades em uma única consulta.

#### [MODIFY] [Home.tsx](file:///Users/pedroborba/Documents/GitHub/UAI-Fix/pages/Home.tsx)
- Mudar a forma de obter o ranking de profissionais "Elite". Em vez de baixar todas as avaliações e serviços concluídos na memória do cliente, limitar as consultas usando `.limit(10)` e ordenação apropriada, reduzindo o volume de transferência de dados em produção.

#### [DELETE] [test-wa.js](file:///Users/pedroborba/Documents/GitHub/UAI-Fix/test-wa.js)
- Excluir o script que contém credenciais expostas rígidas no código do repositório.

#### [DELETE] [test-db.js](file:///Users/pedroborba/Documents/GitHub/UAI-Fix/test-db.js)
- Excluir o script temporário de teste de conexões com credenciais confidenciais expostas.

#### [DELETE] [check_cols.js](file:///Users/pedroborba/Documents/GitHub/UAI-Fix/check_cols.js)
- Excluir o script de checagem temporária da raiz.

---

## Verification Plan

### Automated Tests
- Executar o linter e build do TypeScript para garantir que a remoção das chaves em memória e a reestruturação das queries não introduziram erros de compilação:
  ```bash
  npm run lint
  npm run build
  ```

### Manual Verification
- Validar se o arquivo `.agents/workflows/uaifix_macro_graph.json` está bem formatado e reflete as chaves dos modelos do Supabase.
- Acessar a tela de **Meus Pedidos** (`ClientOrders.tsx`) e verificar a correta renderização dos dados do profissional e serviço.
- Acessar as **Configurações** (`Settings.tsx`), testar a filtragem de usuários por cidade e o formulário de edição de usuários para garantir o funcionamento correto da seleção dinâmica de cidades.
- Validar a tela **Home** (`Home.tsx`) monitorando a redução no tamanho do payload baixado.
