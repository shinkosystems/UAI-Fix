# 📘 Manual de Uso e Operação por Perfis — Plataforma UAI Fix Multi-Tenant

> **Versão:** 2.0 (Multi-Tenant & Equipes)  
> **Arquitetura:** React 19 + TypeScript + Supabase PostgreSQL (Row Level Security)  
> **Data:** 01/10/2026  
> **Governança:** Shinkō Systems & UAI Fix Matriz  

---

## 🧭 Sumário Executivo dos Perfis de Usuários

A plataforma **UAI Fix** opera com segregação estrita de papéis e responsabilidades através de 4 perfis operacionais:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MATRIZ DE PERFIS & ACESSOS                            │
├───────────────────┬──────────────────────┬─────────────┬────────────────────┤
│ Perfil            │ Rota de Entrada      │ Escopo      │ Nível de Acesso    │
├───────────────────┼──────────────────────┼─────────────┼────────────────────┤
│ 👑 Super Admin    │ /admin/dashboard     │ Global 360º │ Todas as Empresas  │
│ 🏢 Gestor Tenant  │ /chamados / /admin   │ Organização │ Própria Empresa    │
│ 🛠️ Especialista   │ /chamados            │ Operacional │ OSs Atribuídas     │
│ 👤 Consumidor     │ /home / /orders      │ Consumo     │ Próprios Pedidos   │
└───────────────────┴──────────────────────┴─────────────┴────────────────────┘
```

---

## 👑 1. Manual do Super Administrador (UAI Fix Matriz)

O Super Administrador é o usuário executivo responsável pela governança geral da plataforma, credenciamento de empresas clientes, monitoramento macro de ordens de serviço e saúde operacional do ecossistema.

### 1.1. Acesso ao Portal `/admin` & Regra de Restrição por E-mail
- Acesse via menu lateral ou navegando para `/#/admin/dashboard`.
- **Restrição de Governança Estrita:** O papel de Super Administrador global é restrito canonicamente ao e-mail executivo: **`peboorba@gmail.com`**.
- Caso o usuário autenticado não seja `peboorba@gmail.com` (ou não possua privilégios explícitos validados por RLS), o componente `AdminGuard` bloqueia instantaneamente o acesso e redireciona para a Home.

### 1.2. Gestão de Organizações (Empresas Clientes)
- **Caminho:** `/admin/organizations`
- **Funcionalidades:**
  1. **Visualizar Empresas:** Cards com indicadores de colaboradores ativos, cotas do plano e status.
  2. **Cadastrar Nova Empresa:** Botão `+ Nova Organização`.
     - *Nome da Empresa* e *Slug único* (ex: `solucoes-express`).
     - *CNPJ, Razão Social, E-mail e WhatsApp corporativo*.
     - *Plano Contratual:* `Starter` (até 5 colaboradores, 50 chamados/mês), `Pro` (até 25 colaboradores, 300 chamados/mês) ou `Enterprise` (ilimitado).
     - *Limite de Colaboradores e Chamados/Mês*.
  3. **Edição e Auditoria:** Alterar dados contratuais, desativar empresa inadimplente ou expandir cotas.
  4. **Filtro Rápido de Contexto:** Ao clicar em **"Focar Empresa"**, a plataforma grava a seleção em `active_tenant_filter`, permitindo filtrar automaticamente todas as telas de chamados e equipes.

### 1.3. Gestão Global de Equipes, Cargos & Competências
- **Caminho:** `/admin/users`
- **Funcionalidades:**
  1. **Filtro Multi-Empresa:** Seletor no topo para visualizar técnicos de uma empresa específica ou de todas.
  2. **Atribuição de Organização:** Vincular um colaborador existente a uma empresa cliente.
  3. **Definição de Cargo Corporativo:** Especificar a função corporativa (ex: `Encanador Chefe`, `Eletricista Sênior`, `Supervisor de Obras`).
  4. **Mapeamento de Competências Técnicas (`Atividades`):** Seleção de especialidades cadastradas no catálogo `geral` (ex: `Reparos Hidráulicos`, `Instalação de Ar-Condicionado`), garantindo que o colaborador só receba chamados compatíveis com sua qualificação.
  5. **Concessão de Super Admin:** Habilitação do toggle `Super Administrador` apenas para diretores da UAI Fix.

### 1.4. Gestão Central de Chamados & Roteamento
- **Caminho:** `/admin/chamados`
- **Funcionalidades:**
  1. **Auditoria de Todas as Ordens de Serviço:** Acompanhamento de chamados originados via Web, App, WhatsApp ou balcão.
  2. **Identificação Visual de Prioridades:**
     - 🔥 **Urgente:** Chamados emergenciais com SLA crítico (destaque pulsante vermelho).
     - ⚡ **Alta:** Atendimentos prioritários (badge âmbar).
     - 🔹 **Média:** Atendimentos padrão de rotina (badge azul).
     - ⚪ **Baixa:** Demandas preventivas ou sem urgência de tempo (badge slate).
  3. **Roteamento:** Delegar ou transferir chamados entre equipes e técnicos parceiros.

---

## 🏢 2. Manual do Gestor de Empresa Parceira (Tenant)

O Gestor de Empresa é o responsável operacional pela equipe da sua organização parceira credenciada na plataforma UAI Fix.

### 2.1. Escopo de Visualização Isolado
- O Gestor visualiza **estritamente os dados, técnicos e chamados pertencentes à sua `organization_id`**.
- As políticas de segurança (RLS) garantem que nenhum dado de concorrentes ou outras empresas seja exposto.

### 2.2. Gestão de Colaboradores da sua Empresa
- Visualizar os técnicos credenciados no seu squad.
- Acompanhar a taxa de ocupação, avaliações dos clientes e especialidades ativas de cada técnico.
- Solicitar inclusão de novos técnicos ou atualização de especialidades.

### 2.3. Gestão de Ordens de Serviço & Agendamento
- **Caminho:** `/chamados`
- **Fluxo Operacional:**
  1. **Novos Chamados:** Recebimento de solicitações de clientes da região.
  2. **Elaboração de Orçamento:** Definição de custos fixos, mão de obra (HH), deslocamento e preço final.
  3. **Alocação de Técnico:** Atribuir a OS para o técnico com a especialidade adequada.
  4. **Supervisão de Execução:** Acompanhar status em tempo real (`Em Execução`, `Aguardando Aprovação`, `Concluído`).
  5. **Fechamento & Faturamento:** Validação das fotos antes/depois e assinatura coletada pelo técnico.

---

## 🛠️ 3. Manual do Especialista / Técnico de Campo

O Especialista é o profissional que executa os serviços em campo, atendendo diretamente o cliente solicitante.

### 3.1. Painel de Execução & Agenda
- **Caminho:** `/chamados` (Visão do Profissional) e `/calendar`.
- Visualização das OSs atribuídas a ele organizadas por abas:
  - **Pendentes:** Serviços novos atribuídos que aguardam aceite ou início.
  - **Em Execução:** Serviços em andamento no momento.
  - **Concluídos:** Histórico de atendimentos finalizados.

### 3.2. Passo a Passo do Atendimento em Campo
1. **Chegada ao Local:**
   - Acessar os detalhes da OS no aplicativo.
   - Conferir endereço, contato do cliente e descrição detalhada/áudio do problema.
2. **Registro de Início (Foto Antes):**
   - Na aba **Fotos**, registrar a foto do local antes de iniciar o reparo.
3. **Execução do Serviço:**
   - Realizar o trabalho técnico conforme o orçamento e planejamento acordados.
4. **Registro de Término (Foto Depois):**
   - Fotografar o resultado final do serviço concluído com acabamento limpo.
5. **Coleta da Assinatura Digital do Cliente:**
   - Clicar no botão **"Assinatura do Cliente"** para abrir o modal de assinatura touch na tela do celular.
   - O cliente assina com o dedo e insere o CPF para validação jurídica.
6. **Finalização da OS:**
   - Alterar o status para `Concluído`. O sistema dispara a notificação para o cliente avaliar o atendimento.

---

## 👤 4. Manual do Consumidor / Cliente Final

O Consumidor é o usuário final que solicita serviços para sua residência ou empresa. O cliente não precisa saber de regras multi-tenant, usufruindo de uma experiência simples e transparente.

### 4.1. Solicitando um Serviço
1. **Home / Busca:**
   - Na tela inicial (`/home`), selecione a categoria desejada (ex: `Elétrica`, `Hidráulica`, `Ar-Condicionado`).
   - Ou utilize a busca (`/search`) para digitar o que precisa (ex: `troca de disjuntor`, `vazamento pia`).
2. **Escolha do Especialista ou Solicitação Direta:**
   - Escolha um profissional com base em avaliações reais e selo de verificado, ou clique em **"Solicitar Serviço"**.
3. **Agendamento & Detalhamento (`/planning`):**
   - Escolha a data e horário desejados.
   - Descreva o problema por texto ou **grave um áudio de voz**.
   - Envie uma foto ou vídeo do local para o técnico entender o cenário.
   - Selecione a forma de pagamento pretendida (PIX, Cartão, Dinheiro).
   - Clique em **"Confirmar Solicitação"**.

### 4.2. Acompanhamento do Pedido (`/orders` — Meus Pedidos)
- **Filtros por Estado:**
  - `Em Análise`: A UAI Fix está analisando a demanda e alocando o profissional ideal.
  - `Proposta Recebida`: Notificação com orçamento detalhado para aprovação do cliente.
  - `Agendados`: Atendimento aprovado com data e profissional confirmados.
  - `Em Execução`: Técnico em trânsito ou executando o serviço.
  - `Concluídos`: Atendimento finalizado com sucesso.

### 4.3. Aprovação de Proposta & Pagamento
- Ao receber o orçamento, o cliente clica em **"Decidir Agora"** no card do pedido.
- Revisa os valores, materiais inclusos e condições de parcelamento.
- Clica em **"Aprovar Orçamento"** para confirmar a execução.

### 4.4. Avaliação & Feedback
- Ao concluir o serviço, o card ganha destaque dourado **"Avaliação Pendente"**.
- O cliente atribui de 1 a 5 estrelas ao técnico e à experiência geral da UAI Fix, deixando comentários e elogios.

---

## 📞 5. Matriz de Suporte & Escalação de Incidentes

| Tipo de Dúvida / Incidente | Canal de Atendimento | SLA de Resposta |
|---|---|---|
| **Problemas de Acesso / Login** | Suporte Técnico UAI Fix | Até 15 min |
| **Dúvidas sobre Faturamento e Planos** | Gestor de Contas UAI Fix | Até 2 horas |
| **Cancelamento / Reagendamento de OS** | Central de Atendimento no App | Até 10 min |
| **Auditoria / Relatórios Especiais** | Super Admin Shinkō | Sob demanda |
