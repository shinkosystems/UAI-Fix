import jsPDF from 'jspdf';
import { UAI_FIX_LOGO_BASE64 } from './logoData';

export type OsReportLevel = 'cliente' | 'parceira' | 'master';

export interface OsPrintData {
  codigoOs: string;
  dataEmissao?: string;
  status?: string;
  reportLevel?: OsReportLevel;

  // Empresa Parceira Conveniada
  empresaParceira?: {
    nome?: string;
    cnpj?: string;
    contato?: string;
  };
  
  // Cliente
  cliente: {
    nome: string;
    telefone?: string;
    cpf?: string;
    enderecoCompleto?: string;
    bairro?: string;
    cidade?: string;
    cep?: string;
    complemento?: string;
  };

  // Profissional
  profissional?: {
    nome: string;
    telefone?: string;
    especialidade?: string;
    cpf?: string;
  };

  // Servico & Planejamento
  servico: {
    categoria: string;
    descricaoPedido?: string;
    recursosAlocados?: string[];
    dataExecucao?: string;
    turno?: string;
    observacoes?: string;
  };

  // Financeiro
  financeiro: {
    precoTotal: number;
    formaPagamento?: string;
    parcelas?: number;
    maoDeObraHh?: number;
    custoFixo?: number;
    custoVariavel?: number;
    deslocamento?: number;
    taxaPlataforma?: number;
    taxaGateway?: number;
    lucroParceira?: number;
    imposto?: number;
    notaFiscal?: boolean;
    observacoes?: string;
  };

  // Execucao & Conformidade
  execucao?: {
    checkinTime?: string;
    conclusaoTime?: string;
    geolocalizacao?: string;
    fotoAntes?: string[];
    fotoDepois?: string[];
    relatoProblema?: string;
    solucaoProblema?: string;
  };

  // Assinatura Digital
  assinatura?: {
    assinaturaUrl?: string;
    cpfAssinante?: string;
    timestamp?: string;
    latitude?: number | null;
    longitude?: number | null;
  };
}

/** Formata valor numérico para moeda BRL */
export const formatCurrency = (val: number | undefined | null): string => {
  if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00';
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

/** Formata data para formato legível */
export const formatDateBr = (dateStr: string | undefined | null): string => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
};

/**
 * Abre uma janela nativa com layout A4 estilizado para impressão direta ou Salvar como PDF.
 * Suporta 3 níveis de relatório: 'cliente' (comprovante final), 'parceira' (DRE operacional), 'master' (auditoria integral).
 */
export const printOsDocument = (data: OsPrintData, requestedLevel?: OsReportLevel) => {
  const level: OsReportLevel = requestedLevel || data.reportLevel || 'cliente';
  const printWindow = window.open('', '_blank', 'width=900,height=1100');
  if (!printWindow) {
    alert('Por favor, permita popups no navegador para imprimir a Ordem de Serviço.');
    return;
  }

  const preco = data.financeiro.precoTotal || 0;
  const hh = data.financeiro.maoDeObraHh || 0;
  const mat = data.financeiro.custoVariavel || 0;
  const desloc = data.financeiro.deslocamento || 0;
  const custoDireto = hh + mat + desloc;
  const custoFixo = data.financeiro.custoFixo || 0;
  const imposto = data.financeiro.imposto || 0;
  const taxaPlat = data.financeiro.taxaPlataforma !== undefined ? data.financeiro.taxaPlataforma : (preco * 0.10);
  const taxaGate = data.financeiro.taxaGateway !== undefined ? data.financeiro.taxaGateway : (preco * 0.0399);
  const lucroParceira = data.financeiro.lucroParceira !== undefined ? data.financeiro.lucroParceira : Math.max(0, preco - custoDireto - custoFixo - imposto - taxaPlat);
  const margemLiquidaUaiFix = taxaPlat - taxaGate;

  const levelConfigs: Record<OsReportLevel, { title: string; badge: string; color: string; desc: string }> = {
    cliente: {
      title: 'ORDEM DE SERVIÇO • VIA DO CLIENTE',
      badge: 'Via do Cliente • Consumidor Final',
      color: '#2563eb',
      desc: 'Comprovante oficial de conclusão e garantia de serviço'
    },
    parceira: {
      title: 'DEMONSTRATIVO OPERACIONAL • EMPRESA PARCEIRA',
      badge: 'Relatório B2B • Empresa Parceira',
      color: '#0d9488',
      desc: 'Fechamento operacional de custos diretos, taxas e margem de execução'
    },
    master: {
      title: 'DRE CONSOLIDADO & AUDITORIA MASTER • UAI-FIX',
      badge: 'Governança Executiva • UAI-Fix Master',
      color: '#d97706',
      desc: 'Auditoria financeira integral 360°, take-rate da plataforma e rentabilidade líquida'
    }
  };

  const currentCfg = levelConfigs[level];

  // Renderiza seção financeira conforme o nível
  const renderFinanceiroHtml = () => {
    if (level === 'cliente') {
      return `
      <div class="section">
        <div class="section-title">💰 Demonstrativo Financeiro e Pagamento</div>
        <table class="table-custom">
          <thead>
            <tr>
              <th>Descrição do Item</th>
              <th style="width: 140px; text-align: center;">Condição de Pagamento</th>
              <th style="width: 100px; text-align: center;">Nota Fiscal</th>
              <th style="width: 130px; text-align: right;">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>${data.servico.categoria}</strong> - Mão de Obra e Insumos
                ${data.financeiro.observacoes ? `<br><small style="color: #64748b;">${data.financeiro.observacoes}</small>` : ''}
              </td>
              <td style="text-align: center;">
                ${data.financeiro.formaPagamento || 'PIX'} ${data.financeiro.parcelas && data.financeiro.parcelas > 1 ? `(${data.financeiro.parcelas}x)` : '(À vista)'}
              </td>
              <td style="text-align: center;">
                ${data.financeiro.notaFiscal ? 'Sim (Emitida)' : 'Inclusa no Recibo'}
              </td>
              <td style="text-align: right; font-weight: 700;">
                ${formatCurrency(preco)}
              </td>
            </tr>
          </tbody>
        </table>

        <div class="total-box">
          <span class="total-title">VALOR TOTAL DA ORDEM DE SERVIÇO:</span>
          <span class="total-amount">${formatCurrency(preco)}</span>
        </div>
      </div>`;
    }

    if (level === 'parceira') {
      const margemPct = preco > 0 ? ((lucroParceira / preco) * 100).toFixed(1) : '0.0';
      return `
      <div class="section" style="border-left: 3px solid #0d9488;">
        <div class="section-title" style="color: #0f766e;">🏢 DRE Operacional da Empresa Parceira</div>
        <table class="table-custom">
          <thead>
            <tr>
              <th>Composição de Custos e Faturamento</th>
              <th style="width: 130px; text-align: center;">Classificação</th>
              <th style="width: 130px; text-align: right;">Valor (R$)</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background: #f0fdf4;">
              <td><strong>(+) Faturamento Bruto da OS (Cobrado do Cliente)</strong></td>
              <td style="text-align: center; color: #166534; font-weight: 700;">Receita Bruta</td>
              <td style="text-align: right; font-weight: 700; color: #166534;">${formatCurrency(preco)}</td>
            </tr>
            <tr>
              <td>&nbsp;&nbsp;(-) Mão de Obra Técnica (Horas Técnicas / Prestador)</td>
              <td style="text-align: center; color: #64748b;">Custo Direto</td>
              <td style="text-align: right; color: #b91c1c;">- ${formatCurrency(hh)}</td>
            </tr>
            <tr>
              <td>&nbsp;&nbsp;(-) Insumos, Peças e Materiais Empregados</td>
              <td style="text-align: center; color: #64748b;">Custo Direto</td>
              <td style="text-align: right; color: #b91c1c;">- ${formatCurrency(mat)}</td>
            </tr>
            <tr>
              <td>&nbsp;&nbsp;(-) Deslocamento / Visita Técnica de Campo</td>
              <td style="text-align: center; color: #64748b;">Custo Direto</td>
              <td style="text-align: right; color: #b91c1c;">- ${formatCurrency(desloc)}</td>
            </tr>
            <tr style="background: #f8fafc; font-weight: 600;">
              <td><strong>Subtotal Custos Diretos de Execução</strong></td>
              <td style="text-align: center;">Custo Operacional</td>
              <td style="text-align: right;">${formatCurrency(custoDireto)}</td>
            </tr>
            <tr>
              <td>&nbsp;&nbsp;(-) Rateio de Custo Fixo / Overhead Administrativo</td>
              <td style="text-align: center; color: #64748b;">Custo Indireto</td>
              <td style="text-align: right; color: #b91c1c;">- ${formatCurrency(custoFixo)}</td>
            </tr>
            <tr>
              <td>&nbsp;&nbsp;(-) Provisão de Impostos e Encargos da Parceira</td>
              <td style="text-align: center; color: #64748b;">Tributos</td>
              <td style="text-align: right; color: #b91c1c;">- ${formatCurrency(imposto)}</td>
            </tr>
            <tr style="background: #fefce8;">
              <td>&nbsp;&nbsp;(-) Taxa de Plataforma UAI-Fix (Intermediação & Software)</td>
              <td style="text-align: center; color: #854d0e; font-weight: 600;">Taxa UAI-Fix</td>
              <td style="text-align: right; color: #854d0e; font-weight: 700;">- ${formatCurrency(taxaPlat)}</td>
            </tr>
          </tbody>
        </table>

        <div class="total-box" style="background: #f0fdfa; border-color: #99f6e4;">
          <span class="total-title" style="color: #0f766e;">MARGEM LÍQUIDA DA EMPRESA PARCEIRA:</span>
          <span class="total-amount" style="color: #0d9488;">${formatCurrency(lucroParceira)}</span>
          <div style="font-size: 9.5px; color: #115e59; margin-top: 3px; font-weight: 600;">
            Rentabilidade Efetiva da Parceira: <strong>${margemPct}%</strong> do valor total do contrato
          </div>
        </div>
      </div>`;
    }

    // Master
    const takeRatePct = preco > 0 ? ((taxaPlat / preco) * 100).toFixed(1) : '0.0';
    return `
    <div class="section" style="border-left: 3px solid #d97706;">
      <div class="section-title" style="color: #b45309;">👑 DRE Consolidado da Plataforma • UAI-Fix Master</div>
      <table class="table-custom">
        <thead>
          <tr>
            <th>Demonstrativo Consolidado 360°</th>
            <th style="width: 140px; text-align: center;">Centro de Resultado</th>
            <th style="width: 130px; text-align: right;">Valor (R$)</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background: #eff6ff;">
            <td><strong>(+) Receita Bruta Total Faturada ao Cliente</strong></td>
            <td style="text-align: center; font-weight: 700; color: #1d4ed8;">Receita Total</td>
            <td style="text-align: right; font-weight: 700; color: #1d4ed8;">${formatCurrency(preco)}</td>
          </tr>
          <tr>
            <td>&nbsp;&nbsp;(-) Custos Diretos Totais da Operação (Materiais + HH + Deslocamento)</td>
            <td style="text-align: center; color: #64748b;">Repasse Parceira</td>
            <td style="text-align: right; color: #64748b;">${formatCurrency(custoDireto)}</td>
          </tr>
          <tr>
            <td>&nbsp;&nbsp;(-) Margem Líquida da Empresa Parceira</td>
            <td style="text-align: center; color: #64748b;">Resultado Parceira</td>
            <td style="text-align: right; color: #64748b;">${formatCurrency(lucroParceira)}</td>
          </tr>
          <tr style="background: #fffbeb;">
            <td><strong>(+) Taxa de Plataforma Bruta UAI-Fix (Take-Rate)</strong></td>
            <td style="text-align: center; font-weight: 700; color: #b45309;">Take-Rate (${takeRatePct}%)</td>
            <td style="text-align: right; font-weight: 700; color: #b45309;">${formatCurrency(taxaPlat)}</td>
          </tr>
          <tr>
            <td>&nbsp;&nbsp;(-) Custo de Gateway de Pagamento & Split Financeiro</td>
            <td style="text-align: center; color: #64748b;">Taxa Gateway</td>
            <td style="text-align: right; color: #b91c1c;">- ${formatCurrency(taxaGate)}</td>
          </tr>
        </tbody>
      </table>

      <div class="total-box" style="background: #fffbeb; border-color: #fde68a;">
        <span class="total-title" style="color: #92400e;">MARGEM DE CONTRIBUIÇÃO LÍQUIDA UAI-FIX:</span>
        <span class="total-amount" style="color: #b45309;">${formatCurrency(margemLiquidaUaiFix)}</span>
        <div style="font-size: 9.5px; color: #78350f; margin-top: 3px; font-weight: 600;">
          Margem Líquida da Plataforma pós-gateway • Auditoria Master
        </div>
      </div>
    </div>`;
  };

  const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Ordem de Serviço #${data.codigoOs} - ${currentCfg.title}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm 15mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.4;
    }
    .os-container {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid ${currentCfg.color};
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-logo-img {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      object-fit: cover;
      border: 1px solid #cbd5e1;
      box-shadow: 0 2px 4px rgba(0,0,0,0.06);
    }
    .brand-text h1 {
      margin: 0;
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
    }
    .brand-text p {
      margin: 2px 0 0;
      font-size: 9px;
      color: #64748b;
    }
    .os-badge {
      text-align: right;
    }
    .os-number {
      font-size: 16px;
      font-weight: 900;
      color: ${currentCfg.color};
      margin: 0;
    }
    .os-date {
      font-size: 9px;
      color: #64748b;
      margin: 2px 0 0;
    }
    .status-tag {
      display: inline-block;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: 9999px;
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
      margin-top: 4px;
    }
    .report-level-badge {
      display: inline-block;
      font-size: 9px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 6px;
      background: ${level === 'master' ? '#fef3c7' : level === 'parceira' ? '#ccfbf1' : '#dbeafe'};
      color: ${currentCfg.color};
      border: 1px solid ${currentCfg.color}40;
      margin-top: 3px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 10px;
    }
    .section {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
      margin-bottom: 10px;
    }
    .section-title {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #1e3a8a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .data-row {
      display: flex;
      margin-bottom: 3px;
      font-size: 10.5px;
    }
    .data-label {
      width: 110px;
      color: #64748b;
      font-weight: 600;
      flex-shrink: 0;
    }
    .data-val {
      color: #0f172a;
      font-weight: 500;
      flex-grow: 1;
    }
    .highlight-val {
      font-weight: 700;
      color: #0f172a;
    }
    .table-custom {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
      font-size: 10px;
    }
    .table-custom th {
      background: #e2e8f0;
      color: #334155;
      font-weight: 700;
      text-align: left;
      padding: 4px 6px;
      border: 1px solid #cbd5e1;
    }
    .table-custom td {
      padding: 4px 6px;
      border: 1px solid #e2e8f0;
      color: #1e293b;
    }
    .total-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      padding: 8px;
      text-align: right;
      margin-top: 6px;
    }
    .total-title {
      font-size: 10.5px;
      color: #1e40af;
      font-weight: 700;
    }
    .total-amount {
      font-size: 17px;
      font-weight: 900;
      color: #1d4ed8;
      margin-left: 8px;
    }
    .photos-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 6px;
    }
    .photo-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
      text-align: center;
      background: #ffffff;
    }
    .photo-label {
      background: #f1f5f9;
      padding: 3px;
      font-size: 9px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      border-bottom: 1px solid #cbd5e1;
    }
    .photo-img {
      width: 100%;
      height: 110px;
      object-fit: cover;
      display: block;
    }
    .signature-box {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px dashed #94a3b8;
    }
    .signature-block {
      flex: 1;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .signature-img-container {
      height: 55px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      margin-bottom: 4px;
    }
    .signature-img {
      max-height: 50px;
      max-width: 180px;
      object-fit: contain;
    }
    .signature-line {
      width: 80%;
      border-top: 1px solid #475569;
      margin: 2px 0;
    }
    .signature-title {
      font-size: 9.5px;
      font-weight: 700;
      color: #1e293b;
    }
    .signature-sub {
      font-size: 8.5px;
      color: #64748b;
    }
    .footer {
      margin-top: 14px;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8.5px;
      color: #94a3b8;
    }
    .legal-notice {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 4px;
      padding: 5px 8px;
      font-size: 8.5px;
      color: #92400e;
      margin-top: 6px;
    }
    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="os-container">
    
    <!-- CABEÇALHO -->
    <div class="header">
      <div class="brand">
        <img src="${UAI_FIX_LOGO_BASE64}" alt="UAI Fix" class="brand-logo-img" />
        <div class="brand-text">
          <h1>UAI FIX SOLUÇÕES E SERVIÇOS</h1>
          <p>${currentCfg.desc}</p>
        </div>
      </div>
      <div class="os-badge">
        <div class="os-number">OS #${data.codigoOs}</div>
        <div class="os-date">Emissão: ${data.dataEmissao ? formatDateBr(data.dataEmissao) : formatDateBr(new Date().toISOString())}</div>
        <div class="report-level-badge">${currentCfg.badge}</div>
      </div>
    </div>

    <!-- DADOS DO CLIENTE, PARCEIRA E PROFISSIONAL -->
    <div class="grid-2">
      <!-- CLIENTE / EMPRESA PARCEIRA -->
      <div class="section">
        <div class="section-title">👤 Identificação do Cliente</div>
        <div class="data-row">
          <span class="data-label">Nome:</span>
          <span class="data-val highlight-val">${data.cliente.nome}</span>
        </div>
        ${data.cliente.cpf ? `
        <div class="data-row">
          <span class="data-label">CPF:</span>
          <span class="data-val">${data.cliente.cpf}</span>
        </div>` : ''}
        ${data.cliente.telefone ? `
        <div class="data-row">
          <span class="data-label">Telefone:</span>
          <span class="data-val">${data.cliente.telefone}</span>
        </div>` : ''}
        <div class="data-row">
          <span class="data-label">Endereço:</span>
          <span class="data-val">${data.cliente.enderecoCompleto || 'Não informado'} ${data.cliente.complemento ? `(${data.cliente.complemento})` : ''}</span>
        </div>
        ${data.cliente.bairro || data.cliente.cidade ? `
        <div class="data-row">
          <span class="data-label">Localidade:</span>
          <span class="data-val">${data.cliente.bairro ? `${data.cliente.bairro}, ` : ''}${data.cliente.cidade || ''} ${data.cliente.cep ? `- CEP ${data.cliente.cep}` : ''}</span>
        </div>` : ''}
        ${data.empresaParceira?.nome ? `
        <div class="data-row" style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #e2e8f0;">
          <span class="data-label" style="color: #0f766e;">Empresa Parceira:</span>
          <span class="data-val" style="font-weight: 700; color: #0f766e;">${data.empresaParceira.nome}</span>
        </div>` : ''}
      </div>

      <!-- PROFISSIONAL / PRESTADOR -->
      <div class="section">
        <div class="section-title">🛠️ Profissional Responsável</div>
        <div class="data-row">
          <span class="data-label">Especialista:</span>
          <span class="data-val highlight-val">${data.profissional?.nome || 'Prestador Autorizado UAI Fix'}</span>
        </div>
        <div class="data-row">
          <span class="data-label">Especialidade:</span>
          <span class="data-val">${data.servico.categoria || data.profissional?.especialidade || 'Manutenção Geral'}</span>
        </div>
        ${data.profissional?.telefone ? `
        <div class="data-row">
          <span class="data-label">Contato:</span>
          <span class="data-val">${data.profissional.telefone}</span>
        </div>` : ''}
        <div class="data-row">
          <span class="data-label">Data Execução:</span>
          <span class="data-val">${data.servico.dataExecucao ? formatDateBr(data.servico.dataExecucao) : 'Conforme Agendamento'} ${data.servico.turno ? `(${data.servico.turno})` : ''}</span>
        </div>
        <div class="data-row">
          <span class="data-label">Status da OS:</span>
          <span class="data-val" style="font-weight: 700; text-transform: uppercase;">${data.status || 'Concluído'}</span>
        </div>
      </div>
    </div>

    <!-- ESCOPO DO SERVIÇO E PLANEJAMENTO -->
    <div class="section">
      <div class="section-title">📋 Escopo do Serviço & Planejamento Técnico</div>
      <div class="data-row">
        <span class="data-label">Atividade Principal:</span>
        <span class="data-val highlight-val">${data.servico.categoria}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Descrição:</span>
        <span class="data-val">${data.servico.descricaoPedido || 'Prestação de serviço técnico especializado.'}</span>
      </div>
      ${data.servico.recursosAlocados && data.servico.recursosAlocados.length > 0 ? `
      <div class="data-row">
        <span class="data-label">Materiais/Peças:</span>
        <span class="data-val">${data.servico.recursosAlocados.join(', ')}</span>
      </div>` : ''}
      ${data.servico.observacoes ? `
      <div class="data-row">
        <span class="data-label">Observações:</span>
        <span class="data-val">${data.servico.observacoes}</span>
      </div>` : ''}
    </div>

    <!-- SEÇÃO FINANCEIRA ADAPTADA AO NÍVEL (CLIENTE / PARCEIRA / MASTER) -->
    ${renderFinanceiroHtml()}

    <!-- COMPROVAÇÃO VISUAL (ANTES E DEPOIS) -->
    ${(data.execucao?.fotoAntes?.length || data.execucao?.fotoDepois?.length) ? `
    <div class="section">
      <div class="section-title">📷 Registro de Conformidade Visual em Campo</div>
      <div class="photos-grid">
        <div class="photo-card">
          <div class="photo-label">Estado Inicial (Antes)</div>
          ${data.execucao.fotoAntes && data.execucao.fotoAntes[0] ? `
            <img src="${data.execucao.fotoAntes[0]}" class="photo-img" alt="Foto Antes" crossorigin="anonymous" />
          ` : '<div style="height: 110px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:10px;">Foto não anexada</div>'}
        </div>
        <div class="photo-card">
          <div class="photo-label">Estado Final Concluído (Depois)</div>
          ${data.execucao.fotoDepois && data.execucao.fotoDepois[0] ? `
            <img src="${data.execucao.fotoDepois[0]}" class="photo-img" alt="Foto Depois" crossorigin="anonymous" />
          ` : '<div style="height: 110px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:10px;">Foto não anexada</div>'}
        </div>
      </div>
    </div>` : ''}

    <!-- TERMO LEGAL DE GARANTIA -->
    <div class="legal-notice">
      ⚖️ <strong>Garantia Legal & Termo de Aceite:</strong> Os serviços executados possuem garantia de 90 (noventa) dias conforme Art. 26 do Código de Defesa do Consumidor (Lei nº 8.078/90). O cliente declara ter conferido e aprovado a execução do serviço e os materiais empregados.
    </div>

    <!-- BLOCO DE ASSINATURA DIGITAL -->
    <div class="signature-box">
      <div class="signature-block">
        <div class="signature-img-container">
          <span style="color: #64748b; font-size: 10px; font-weight: 600;">UAI FIX SOLUÇÕES DIGITAIS</span>
        </div>
        <div class="signature-line"></div>
        <div class="signature-title">${data.profissional?.nome || 'Profissional UAI Fix'}</div>
        <div class="signature-sub">Prestador de Serviços Autorizado</div>
      </div>

      <div class="signature-block">
        <div class="signature-img-container">
          ${data.assinatura?.assinaturaUrl ? `
            <img src="${data.assinatura.assinaturaUrl}" class="signature-img" alt="Assinatura Cliente" />
          ` : '<span style="color: #94a3b8; font-size: 9px; font-style: italic;">Assinatura Digital Registrada no App</span>'}
        </div>
        <div class="signature-line"></div>
        <div class="signature-title">${data.cliente.nome}</div>
        <div class="signature-sub">
          ${data.assinatura?.cpfAssinante ? `CPF: ${data.assinatura.cpfAssinante} • ` : (data.cliente.cpf ? `CPF: ${data.cliente.cpf} • ` : '')}
          Aceite Digital em ${data.assinatura?.timestamp ? formatDateBr(data.assinatura.timestamp) : formatDateBr(new Date().toISOString())}
        </div>
      </div>
    </div>

    <!-- RODAPÉ -->
    <div class="footer">
      <div>UAI FIX © ${new Date().getFullYear()} • Relatório ${currentCfg.badge} • Documento eletrônico</div>
      <div>Autenticidade: ${data.codigoOs} • Verificado via Supabase Security Layer</div>
    </div>

  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

/**
 * Gera e realiza o download direto do arquivo PDF estruturado da Ordem de Serviço usando jsPDF.
 * Suporta 3 níveis: 'cliente', 'parceira', 'master'.
 */
export const downloadOsPdf = (data: OsPrintData, requestedLevel?: OsReportLevel) => {
  const level: OsReportLevel = requestedLevel || data.reportLevel || 'cliente';
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = level === 'master' ? [217, 119, 6] : level === 'parceira' ? [13, 148, 136] : [37, 99, 235]; // Âmbar / Teal / Azul
  const darkColor = [15, 23, 42];    // #0f172a
  const grayColor = [100, 116, 139]; // #64748b
  const lightBg = [248, 250, 252];   // #f8fafc

  const preco = data.financeiro.precoTotal || 0;
  const hh = data.financeiro.maoDeObraHh || 0;
  const mat = data.financeiro.custoVariavel || 0;
  const desloc = data.financeiro.deslocamento || 0;
  const custoDireto = hh + mat + desloc;
  const custoFixo = data.financeiro.custoFixo || 0;
  const imposto = data.financeiro.imposto || 0;
  const taxaPlat = data.financeiro.taxaPlataforma !== undefined ? data.financeiro.taxaPlataforma : (preco * 0.10);
  const taxaGate = data.financeiro.taxaGateway !== undefined ? data.financeiro.taxaGateway : (preco * 0.0399);
  const lucroParceira = data.financeiro.lucroParceira !== undefined ? data.financeiro.lucroParceira : Math.max(0, preco - custoDireto - custoFixo - imposto - taxaPlat);
  const margemLiquidaUaiFix = taxaPlat - taxaGate;

  let y = 15;

  // 1. Cabeçalho
  try {
    doc.addImage(UAI_FIX_LOGO_BASE64, 'JPEG', 15, y - 2, 13, 13);
  } catch (err) {
    console.warn('Erro ao inserir logo no PDF:', err);
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(15, y, 32, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('UAI FIX', 18, y + 7);
  }

  const levelSubtitles: Record<OsReportLevel, { name: string; tag: string }> = {
    cliente: { name: 'Comprovante do Cliente • Consumidor Final', tag: 'VIA DO CLIENTE' },
    parceira: { name: 'Demonstrativo Operacional B2B • Empresa Parceira', tag: 'VIA DA PARCEIRA' },
    master: { name: 'Governança Executiva & Auditoria Master • UAI-Fix', tag: 'VIA MASTER' }
  };

  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('UAI FIX SOLUÇÕES E SERVIÇOS', 31, y + 3);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text(levelSubtitles[level].name, 31, y + 7.5);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`OS #${data.codigoOs}`, 195, y + 3.5, { align: 'right' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`[${levelSubtitles[level].tag}]`, 195, y + 7.5, { align: 'right' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text(`Emissão: ${data.dataEmissao ? formatDateBr(data.dataEmissao) : formatDateBr(new Date().toISOString())}`, 195, y + 11, { align: 'right' });

  y += 16;
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.6);
  doc.line(15, y, 195, y);
  y += 5;

  // 2. Quadro Cliente & Profissional / Parceira (2 colunas)
  const colWidth = 86;
  
  // Coluna 1: Cliente
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, y, colWidth, 38, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('IDENTIFICAÇÃO DO CLIENTE', 18, y + 6);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(`Nome: ${data.cliente.nome}`, 18, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(`CPF: ${data.cliente.cpf || 'Não informado'}`, 18, y + 17);
  doc.text(`Telefone: ${data.cliente.telefone || 'Não informado'}`, 18, y + 22);
  const endr = `${data.cliente.enderecoCompleto || 'Endereço não informado'} ${data.cliente.complemento || ''}`;
  const splitEndr = doc.splitTextToSize(endr, colWidth - 6);
  doc.text(splitEndr, 18, y + 27);
  doc.text(`${data.cliente.bairro ? `${data.cliente.bairro}, ` : ''}${data.cliente.cidade || ''}`, 18, y + 34);

  // Coluna 2: Profissional / Empresa Parceira
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(109, y, colWidth, 38, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(data.empresaParceira?.nome ? 'PARCEIRA & PRESTADOR' : 'PROFISSIONAL RESPONSÁVEL', 112, y + 6);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  if (data.empresaParceira?.nome) {
    doc.text(`Empresa: ${data.empresaParceira.nome}`, 112, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Técnico: ${data.profissional?.nome || 'Prestador Autorizado'}`, 112, y + 17);
  } else {
    doc.text(`Especialista: ${data.profissional?.nome || 'Prestador Autorizado UAI Fix'}`, 112, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Especialidade: ${data.servico.categoria || data.profissional?.especialidade || 'Geral'}`, 112, y + 17);
  }
  doc.text(`Contato: ${data.profissional?.telefone || 'Central UAI Fix'}`, 112, y + 22);
  doc.text(`Data Execução: ${data.servico.dataExecucao ? formatDateBr(data.servico.dataExecucao) : 'Agendada'}`, 112, y + 27);
  doc.text(`Status: ${(data.status || 'Concluído').toUpperCase()}`, 112, y + 34);

  y += 43;

  // 3. Escopo do Serviço
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(15, y, 180, 24, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('ESCOPO DO SERVIÇO & PLANEJAMENTO', 18, y + 5);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(`Atividade: ${data.servico.categoria}`, 18, y + 11);
  doc.setFont('helvetica', 'normal');
  const desc = data.servico.descricaoPedido || 'Prestação de serviço técnico especializado.';
  const splitDesc = doc.splitTextToSize(`Descrição: ${desc}`, 174);
  doc.text(splitDesc, 18, y + 16);

  if (data.servico.recursosAlocados && data.servico.recursosAlocados.length > 0) {
    doc.text(`Materiais/Peças: ${data.servico.recursosAlocados.join(', ')}`, 18, y + 21);
  }

  y += 29;

  // 4. Seção Financeira adaptada aos 3 Níveis
  if (level === 'cliente') {
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.roundedRect(15, y, 180, 28, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('DEMONSTRATIVO FINANCEIRO E PAGAMENTO', 18, y + 5);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(`Forma de Pagamento: ${data.financeiro.formaPagamento || 'PIX'}`, 18, y + 12);
    doc.text(`Parcelas: ${data.financeiro.parcelas && data.financeiro.parcelas > 1 ? `${data.financeiro.parcelas}x` : 'À vista (1x)'}`, 18, y + 17);
    doc.text(`Nota Fiscal: ${data.financeiro.notaFiscal ? 'Sim (Emitida)' : 'Inclusa no Recibo'}`, 18, y + 22);

    doc.setFillColor(239, 246, 255);
    doc.roundedRect(110, y + 8, 80, 16, 2, 2, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('VALOR TOTAL DA OS:', 115, y + 15);
    doc.setFontSize(12);
    doc.setTextColor(29, 78, 216);
    doc.text(formatCurrency(preco), 185, y + 21, { align: 'right' });

    y += 34;
  } else if (level === 'parceira') {
    // Visão Parceira (DRE Operacional)
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.roundedRect(15, y, 180, 48, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('DRE OPERACIONAL DA EMPRESA PARCEIRA', 18, y + 5);

    doc.setFontSize(7.5);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(`(+) Faturamento Bruto da OS: ${formatCurrency(preco)}`, 18, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(`(-) Mão de Obra Técnica (HH): ${formatCurrency(hh)}`, 18, y + 18);
    doc.text(`(-) Insumos, Peças e Materiais: ${formatCurrency(mat)}`, 18, y + 24);
    doc.text(`(-) Deslocamento / Visita Técnica: ${formatCurrency(desloc)}`, 18, y + 30);
    doc.text(`Subtotal Custos Diretos: ${formatCurrency(custoDireto)}`, 18, y + 36);

    doc.text(`(-) Overhead / Custo Fixo: ${formatCurrency(custoFixo)}`, 105, y + 18);
    doc.text(`(-) Provisão Impostos Parceira: ${formatCurrency(imposto)}`, 105, y + 24);
    doc.setFont('helvetica', 'bold');
    doc.text(`(-) Taxa Plataforma UAI-Fix: ${formatCurrency(taxaPlat)}`, 105, y + 30);

    doc.setFillColor(240, 253, 250);
    doc.roundedRect(105, y + 34, 85, 11, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 118, 110);
    doc.text('MARGEM LÍQUIDA PARCEIRA:', 108, y + 39);
    doc.setFontSize(10);
    doc.setTextColor(13, 148, 136);
    doc.text(formatCurrency(lucroParceira), 185, y + 43, { align: 'right' });

    y += 54;
  } else {
    // Visão Master
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.roundedRect(15, y, 180, 48, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('DRE CONSOLIDADO & AUDITORIA MASTER • UAI-FIX', 18, y + 5);

    doc.setFontSize(7.5);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(`(+) Receita Total Faturada: ${formatCurrency(preco)}`, 18, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(`(-) Custos Diretos de Execução: ${formatCurrency(custoDireto)}`, 18, y + 18);
    doc.text(`(-) Overhead Operacional Parceira: ${formatCurrency(custoFixo)}`, 18, y + 24);
    doc.text(`(-) Margem Líquida da Parceira: ${formatCurrency(lucroParceira)}`, 18, y + 30);

    doc.setFont('helvetica', 'bold');
    doc.text(`(+) Taxa Bruta UAI-Fix: ${formatCurrency(taxaPlat)}`, 105, y + 18);
    doc.setFont('helvetica', 'normal');
    doc.text(`(-) Gateway / Split Financeiro: ${formatCurrency(taxaGate)}`, 105, y + 24);

    doc.setFillColor(254, 243, 199);
    doc.roundedRect(105, y + 32, 85, 12, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(146, 64, 14);
    doc.text('MARGEM LÍQUIDA UAI-FIX:', 108, y + 38);
    doc.setFontSize(10.5);
    doc.setTextColor(180, 83, 9);
    doc.text(formatCurrency(margemLiquidaUaiFix), 185, y + 42, { align: 'right' });

    y += 54;
  }

  // 5. Termo de Aceite e Garantia
  doc.setFillColor(254, 252, 232);
  doc.setDrawColor(253, 230, 138);
  doc.roundedRect(15, y, 180, 14, 2, 2, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(146, 64, 14);
  const legalText = 'Garantia Legal & Termo de Aceite: Os serviços executados possuem garantia de 90 dias (Art. 26 do CDC). O cliente declara ter conferido e aprovado a execução do serviço e os materiais empregados nesta Ordem de Serviço.';
  const splitLegal = doc.splitTextToSize(legalText, 174);
  doc.text(splitLegal, 18, y + 5);

  y += 19;

  // 6. Bloco de Assinaturas
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(25, y + 14, 85, y + 14);
  doc.line(125, y + 14, 185, y + 14);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(data.profissional?.nome || 'Profissional UAI Fix', 55, y + 18, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text('Prestador de Serviços Autorizado', 55, y + 22, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(data.cliente.nome, 155, y + 18, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text(`Aceite Digital • CPF: ${data.assinatura?.cpfAssinante || data.cliente.cpf || 'Registrado'}`, 155, y + 22, { align: 'center' });

  // 7. Rodapé
  doc.setFontSize(6.5);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text(`UAI FIX © ${new Date().getFullYear()} • Relatório ${levelSubtitles[level].tag} • Documento emitido eletronicamente com validade jurídica • Autenticidade: ${data.codigoOs}`, 105, 285, { align: 'center' });

  // Salvar PDF
  doc.save(`OS_${data.codigoOs || 'UAIFIX'}_${level.toUpperCase()}.pdf`);
};
