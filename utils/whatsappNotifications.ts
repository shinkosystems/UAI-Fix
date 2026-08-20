import { sendWhatsappText } from './whatsapp';
import { ChamadoExtended, User } from '../types';

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Normaliza o número de telefone para o padrão brasileiro DDI 55 + DDD + 9 dígitos
 */
export function formatWhatsappPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let clean = phone.replace(/\D/g, '');
  if (!clean) return null;

  // Se já tiver 12 ou 13 dígitos e começar com 55
  if ((clean.length === 12 || clean.length === 13) && clean.startsWith('55')) {
    return clean;
  }

  // Se tiver DDD + número (10 ou 11 dígitos)
  if (clean.length === 10 || clean.length === 11) {
    return `55${clean}`;
  }

  return clean;
}

/**
 * Dispara notificação de Novo Serviço / Atribuição de OS para o Profissional
 */
export async function notifyProfessionalNewService(
  ticket: ChamadoExtended,
  professional: User,
  client?: User
): Promise<NotificationResult> {
  try {
    const phone = formatWhatsappPhone(professional.whatsapp || professional.email); // Fallback se whatsapp for salvo em outro campo
    if (!phone) {
      return { success: false, error: 'Profissional não possui número de WhatsApp cadastrado.' };
    }

    const nomeProf = professional.nome ? professional.nome.split(' ')[0] : 'Profissional';
    const codigoOs = ticket.chaveunica || ticket.id;
    const categoria = ticket.geral?.nome || 'Serviço Geral';
    const bairro = ticket.clienteData?.bairro || client?.bairro || 'Não informado';
    const cidade = ticket.cidade_data?.cidade || 'Sua Região';
    
    // Valor estimado se houver orçamento
    const activeOrc = ticket.orcamentos?.find(o => o.ativo) || ticket.orcamentos?.[0];
    const valorInfo = activeOrc?.preco ? `R$ ${activeOrc.preco.toFixed(2)}` : 'A combinar / Sob avaliação';

    const appUrl = window.location.origin;
    const linkOs = `${appUrl}/#/execution`;

    const message = 
`🔔 *NOVO SERVIÇO ATRIBUÍDO - UAI-FIX* 🛠️

Olá, *${nomeProf}*! Uma nova Ordem de Serviço foi atribuída a você:

📋 *OS:* #${codigoOs}
🏷️ *Categoria:* ${categoria}
📍 *Região:* ${bairro} (${cidade})
💰 *Valor:* ${valorInfo}

Para visualizar os detalhes e aceitar o atendimento, acesse o app:
👉 ${linkOs}

_Dúvidas? Responda a esta mensagem para falar com a equipe de suporte._`;

    const res = await sendWhatsappText(phone, message);
    if (res) {
      return { success: true, messageId: res.messageId || res.id };
    } else {
      return { success: false, error: 'Falha no envio via Z-API. Verifique a configuração.' };
    }
  } catch (err: any) {
    console.error('Erro ao notificar profissional sobre novo serviço:', err);
    return { success: false, error: err.message || 'Erro desconhecido' };
  }
}

/**
 * Dispara notificação de Orçamento Aprovado pelo Cliente
 */
export async function notifyProfessionalBudgetApproved(
  ticket: ChamadoExtended,
  professional: User,
  client?: User,
  dataExecucao?: string
): Promise<NotificationResult> {
  try {
    const phone = formatWhatsappPhone(professional.whatsapp);
    if (!phone) {
      return { success: false, error: 'Profissional sem WhatsApp cadastrado.' };
    }

    const nomeProf = professional.nome ? professional.nome.split(' ')[0] : 'Profissional';
    const codigoOs = ticket.chaveunica || ticket.id;
    const nomeCliente = client?.nome || ticket.clienteData?.nome || 'Cliente';
    const telCliente = client?.whatsapp || ticket.clienteData?.whatsapp || 'No App';
    const activeOrc = ticket.orcamentos?.find(o => o.ativo) || ticket.orcamentos?.[0];
    const valor = activeOrc?.preco ? `R$ ${activeOrc.preco.toFixed(2)}` : '';

    const appUrl = window.location.origin;
    const linkOs = `${appUrl}/#/execution`;

    const message = 
`🎉 *ORÇAMENTO APROVADO!* ✅

Olá, *${nomeProf}*! O orçamento da OS *#${codigoOs}* foi aprovado pelo cliente.

👤 *Cliente:* ${nomeCliente}
📞 *WhatsApp Cliente:* ${telCliente}
💰 *Valor Aprovado:* ${valor}
${dataExecucao ? `📅 *Data Agendada:* ${new Date(dataExecucao).toLocaleString('pt-BR')}` : ''}

👉 Acesse a OS para iniciar a execução e anexar as fotos:
${linkOs}`;

    const res = await sendWhatsappText(phone, message);
    if (res) {
      return { success: true, messageId: res.messageId || res.id };
    } else {
      return { success: false, error: 'Falha no envio via Z-API.' };
    }
  } catch (err: any) {
    console.error('Erro ao notificar aprovação de orçamento:', err);
    return { success: false, error: err.message || 'Erro desconhecido' };
  }
}

/**
 * Dispara notificação genérica de Atualização de Status da OS
 */
export async function notifyProfessionalStatusUpdate(
  ticket: ChamadoExtended,
  professional: User,
  statusLabel: string,
  observacao?: string
): Promise<NotificationResult> {
  try {
    const phone = formatWhatsappPhone(professional.whatsapp);
    if (!phone) return { success: false, error: 'Sem WhatsApp cadastrado.' };

    const nomeProf = professional.nome ? professional.nome.split(' ')[0] : 'Profissional';
    const codigoOs = ticket.chaveunica || ticket.id;
    const appUrl = window.location.origin;

    const message = 
`📢 *ATUALIZAÇÃO DE SERVIÇO - UAI-FIX* 🛠️

Olá, *${nomeProf}*! A Ordem de Serviço *#${codigoOs}* teve uma alteração:

📌 *Novo Status:* ${statusLabel}
${observacao ? `📝 *Observação:* ${observacao}\n` : ''}
Acesse o sistema para mais detalhes:
👉 ${appUrl}/#/execution`;

    const res = await sendWhatsappText(phone, message);
    return res ? { success: true } : { success: false, error: 'Falha Z-API' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
