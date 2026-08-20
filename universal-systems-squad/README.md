# Universal Multiplatform & AI Systems Squad

Este é um **Squad Portátil de IA** especializado na concepção, desenvolvimento, refatoração e manutenção de aplicações **AI-Powered (com IA Nativa, Agentes, Skills e RAG)** em qualquer plataforma (Web, PWA, iOS, Android, Windows, Mac) utilizando a **Metodologia BMAD**.

## Invocação de Agentes Isolados (On-Demand)

Você pode chamar qualquer um dos 8 agentes **individualmente** a qualquer momento, sem precisar rodar toda a pipeline:

- `@pedro-pm` — *"Pedro, crie a especificação PRD para esta nova funcionalidade."*
- `@sofia-design` — *"Sofia, projete os componentes de UI Dark Mode para esta tela."*
- `@marcos-ai` — *"Marcos, crie uma nova Custom Skill / servidor MCP para nossa IA."*
- `@bruno-supabase` — *"Bruno, crie a migration PostgreSQL e as políticas RLS para esta tabela."*
- `@lucas-automation` — *"Lucas, crie o handler de webhook para integração de pagamentos."*
- `@mateus-dev` — *"Mateus, construa o componente em Next.js/Expo seguindo o TDD."*
- `@carla-qa` — *"Carla, rode uma auditoria de segurança e suíte de testes neste arquivo."*
- `@diego-devops` — *"Diego, faça o deploy de homologação na Vercel e gere a release."*

### Sintaxe de Invocação no Terminal / Chat
```bash
# Execução por comando de agente único:
/opensquad run universal-systems-squad --agent <nome-do-agente>

# Exemplo:
/opensquad run universal-systems-squad --agent bruno-supabase
```

---

## Modos de Pipeline Completa

1. **Novos Projetos (Greenfield):**
   ```bash
   /opensquad run universal-systems-squad --mode greenfield
   ```
2. **Novas Features / Evolução (Evolution):**
   ```bash
   /opensquad run universal-systems-squad --mode evolution
   ```
3. **Manutenção & Refatoração (Maintenance):**
   ```bash
   /opensquad run universal-systems-squad --mode maintenance
   ```
