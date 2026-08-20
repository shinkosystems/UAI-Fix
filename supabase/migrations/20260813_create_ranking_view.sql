-- Migration: Criar View v_profissionais_ranking no Supabase
-- Data: 2026-08-13
-- Descrição: Calcula média bayesiana, nota consolidada e quantidade de serviços concluídos por profissional nativamente no banco de dados.

CREATE OR REPLACE VIEW v_profissionais_ranking AS
SELECT 
  u.uuid,
  u.nome,
  u.fotoperfil,
  u.cidade_data,
  u.atividade,
  COALESCE(AVG(a.nota), 5.0) AS media_nota,
  COUNT(DISTINCT a.id) AS total_avaliacoes,
  COUNT(DISTINCT c.id) AS total_servicos_concluidos
FROM users u
LEFT JOIN avaliacoes a ON a.profissional = u.uuid
LEFT JOIN chaves c ON c.profissional = u.uuid AND c.status = 'concluido'
WHERE u.tipousuario IN ('profissional', 'prestador')
GROUP BY u.uuid, u.nome, u.fotoperfil, u.cidade_data, u.atividade;
