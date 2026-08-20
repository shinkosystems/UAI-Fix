# Auditoria de Desempenho e Segurança: Sistema UAI-Fix

Esta auditoria analisa a arquitetura técnica, as conexões de banco de dados e a performance do frontend do sistema **UAI-Fix**, aplicando os conceitos e diretrizes estabelecidos pelas skills de segurança e otimização.

---

## ⚡ 1. Desempenho e Otimização de Queries

### A. Consultas Sem Filtros e Vazamento de Memória (Memory Bleeding)
* **Arquivo**: [ClientOrders.tsx](file:///Users/pedroborba/Documents/GitHub/UAI-Fix/pages/ClientOrders.tsx#L99-L107)
* **Problema**: O método `loadData` executa um `Promise.all` que baixa **todas as linhas** da tabela `users` e `geral` sem filtros de paginação ou limites para fazer um mapeamento manual em memória no cliente:
  ```typescript
  const [services, users, budgets, plans, reviews, agenda, os] = await Promise.all([
      supabase.from('geral').select('*'),
      supabase.from('users').select('*'),
      ...
  ]);
  ```
* **Impacto**: O download incondicional de todos os profissionais e serviços do banco de dados degrada gravemente a largura de banda, a performance da CPU e a memória do dispositivo do usuário conforme o sistema escala.
* **Solução Recomendada**: Utilizar recursos de relacionamento (joins) do Supabase para trazer apenas o profissional e atividade vinculados às chaves recuperadas do cliente:
  ```typescript
  let query = supabase.from('chaves')
    .select(`
      *,
      geral:atividade (id, nome, icone),
      profissional:profissional (uuid, nome, fotoperfil)
    `)
    .eq('cliente', uuid)
    .order('id', { ascending: false });
  ```

---

### B. Carregamento Incondicional de Tabelas Volumosas (Cidades)
* **Arquivo**: [Settings.tsx](file:///Users/pedroborba/Documents/GitHub/UAI-Fix/pages/Settings.tsx#L136)
* **Problema**: O sistema carrega a tabela completa de `cidades` de forma síncrona ao abrir a tela ou alternar abas:
  ```typescript
  const { data: citiesData } = await supabase.from('cidades').select('*').order('cidade', { ascending: true });
  ```
* **Impacto**: Em países com milhares de cidades (ex: Brasil possui mais de 5.500 cidades), esse payload de rede é massivo e causará atraso na interatividade da UI (bloqueio do render thread).
* **Solução Recomendada**: Utilizar busca assíncrona (Auto-Complete/Search Input) com debounce à medida que o usuário digita a cidade desejada (assim como implementado em [Profile.tsx](file:///Users/pedroborba/Documents/GitHub/UAI-Fix/pages/Profile.tsx#L259)).

---

### C. Loop de Requisições Paralelas (Problema N+1 no Frontend)
* **Arquivo**: [Search.tsx](file:///Users/pedroborba/Documents/GitHub/UAI-Fix/pages/Search.tsx#L169-L191)
* **Problema**: Ao carregar as categorias na busca, o código mapeia as categorias do estado e faz uma chamada ao Supabase para cada uma para obter as contagens:
  ```typescript
  const promises = items.map(async (item) => {
      let query = supabase.from('users').select('*', { count: 'exact', head: true }).overlaps('atividade', idsToCheck);
      ...
      const { count } = await query;
      return { id: item.id, count };
  });
  const results = await Promise.all(promises);
  ```
* **Impacto**: Dispara um grande volume de conexões simultâneas ao banco de dados, podendo esgotar o pool de conexões e acarretar timeouts de rede.
* **Solução Recomendada**: Criar uma RPC no Postgres para retornar o totalizador em uma única query agrupada (`GROUP BY`).

---

### D. Agregações Complexas Executadas Client-Side
* **Arquivo**: [Home.tsx](file:///Users/pedroborba/Documents/GitHub/UAI-Fix/pages/Home.tsx#L250-L260)
* **Problema**: O cálculo de profissionais "Elite" e médias bayesianas baixa **todas** as chaves concluídas e avaliações do banco para calcular o ranqueamento localmente via Javascript.
* **Impacto**: Consumo excessivo de processamento do cliente à medida que o histórico de transações cresce no sistema.
* **Solução Recomendada**: Migrar essas regras estatísticas de ranking para uma **View no banco de dados**, expondo apenas as informações consolidadas prontas para consumo.

---

## 🔒 2. Segurança e Tratamento de Exceções

### A. Chaves Anon e URLs Rígidas nos Scripts de Teste
* **Arquivos**: [test-wa.js](file:///Users/pedroborba/Documents/GitHub/UAI-Fix/test-wa.js#L7-L9), [check_cols.js](file:///Users/pedroborba/Documents/GitHub/UAI-Fix/check_cols.js) e [test-db.js](file:///Users/pedroborba/Documents/GitHub/UAI-Fix/test-db.js#L6-L9)
* **Risco**: Chaves de acesso persistidas em arquivos de testes commitados no Git. Se alteradas para chaves administrativas (`service_role`), acarretarão controle total e bypass de RLS.
* **Solução**: Remover arquivos temporários da raiz e utilizar variáveis de ambiente do `.env.local` não rastreadas pelo repositório.

### B. Tratamento Defensivo contra Respostas Nulas
* **Vulnerabilidade**: Em diversas páginas do app, queries com `.single()` ou `.maybeSingle()` que falham de alguma forma não possuem checagem de erros adequada antes de tentar desestruturar os dados do estado, podendo levar a quebras da interface (ex: `Cannot read properties of null`).
* **Solução**: Garantir checagens condicionais robustas e estados de carregamento ou fallbacks se os objetos retornados forem nulos.
