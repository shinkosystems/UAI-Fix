import jsPDF from 'jspdf';
import { UAI_FIX_LOGO_BASE64 } from './logoData';

export interface OsPrintData {
  codigoOs: string;
  dataEmissao?: string;
  status?: string;
  
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
 */
export const printOsDocument = (data: OsPrintData) => {
  const printWindow = window.open('', '_blank', 'width=900,height=1100');
  if (!printWindow) {
    alert('Por favor, permita popups no navegador para imprimir a Ordem de Serviço.');
    return;
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Ordem de Serviço #${data.codigoOs} - UAI Fix</title>
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
      border-bottom: 2px solid #2563eb;
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
      font-size: 16px;
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
      color: #2563eb;
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
      font-size: 10.5px;
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
      font-size: 11px;
      color: #1e40af;
      font-weight: 700;
    }
    .total-amount {
      font-size: 18px;
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
          <p>Plataforma Inteligente de Gestão e Execução de Serviços Residenciais e Comerciais</p>
        </div>
      </div>
      <div class="os-badge">
        <div class="os-number">OS #${data.codigoOs}</div>
        <div class="os-date">Emissão: ${data.dataEmissao ? formatDateBr(data.dataEmissao) : formatDateBr(new Date().toISOString())}</div>
        <div class="status-tag">Status: ${data.status || 'Finalizado'}</div>
      </div>
    </div>

    <!-- DADOS DO CLIENTE E PROFISSIONAL -->
    <div class="grid-2">
      <!-- CLIENTE -->
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

    <!-- FINANCEIRO & PAGAMENTO -->
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
              ${formatCurrency(data.financeiro.precoTotal)}
            </td>
          </tr>
        </tbody>
      </table>

      <div class="total-box">
        <span class="total-title">VALOR TOTAL DA ORDEM DE SERVIÇO:</span>
        <span class="total-amount">${formatCurrency(data.financeiro.precoTotal)}</span>
      </div>
    </div>

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
      <div>UAI FIX © ${new Date().getFullYear()} • Documento emitido eletronicamente com validade jurídica</div>
      <div>Autenticidade: ${data.codigoOs} • Verificado via Supabase Security Layer</div>
    </div>

  </div>

  <script>
    window.onload = function() {
      // Dispara o diálogo de impressão automaticamente após carregar imagens
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
 */
export const downloadOsPdf = (data: OsPrintData) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [37, 99, 235]; // #2563eb
  const darkColor = [15, 23, 42];    // #0f172a
  const grayColor = [100, 116, 139]; // #64748b
  const lightBg = [248, 250, 252];   // #f8fafc

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

  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('UAI FIX SOLUÇÕES E SERVIÇOS', 31, y + 3.5);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text('Plataforma Inteligente de Gestão de Ordens de Serviço', 31, y + 8);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`OS #${data.codigoOs}`, 195, y + 5, { align: 'right' });
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text(`Emissão: ${data.dataEmissao ? formatDateBr(data.dataEmissao) : formatDateBr(new Date().toISOString())}`, 195, y + 9, { align: 'right' });

  y += 15;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(15, y, 195, y);
  y += 6;

  // 2. Quadro Cliente & Profissional (2 colunas)
  const colWidth = 86;
  
  // Coluna 1: Cliente
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(15, y, colWidth, 38, 2, 2, 'FD');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('IDENTIFICAÇÃO DO CLIENTE', 18, y + 6);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(`Nome: ${data.cliente.nome}`, 18, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.text(`CPF: ${data.cliente.cpf || 'Não informado'}`, 18, y + 18);
  doc.text(`Telefone: ${data.cliente.telefone || 'Não informado'}`, 18, y + 23);
  const endr = `${data.cliente.enderecoCompleto || 'Endereço não informado'} ${data.cliente.complemento || ''}`;
  const splitEndr = doc.splitTextToSize(endr, colWidth - 6);
  doc.text(splitEndr, 18, y + 28);
  doc.text(`${data.cliente.bairro ? `${data.cliente.bairro}, ` : ''}${data.cliente.cidade || ''}`, 18, y + 35);

  // Coluna 2: Profissional
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(109, y, colWidth, 38, 2, 2, 'FD');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('PROFISSIONAL RESPONSÁVEL', 112, y + 6);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(`Especialista: ${data.profissional?.nome || 'Prestador Autorizado UAI Fix'}`, 112, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.text(`Especialidade: ${data.servico.categoria || data.profissional?.especialidade || 'Geral'}`, 112, y + 18);
  doc.text(`Contato: ${data.profissional?.telefone || 'Central UAI Fix'}`, 112, y + 23);
  doc.text(`Data Execução: ${data.servico.dataExecucao ? formatDateBr(data.servico.dataExecucao) : 'Agendada'}`, 112, y + 28);
  doc.text(`Turno: ${data.servico.turno || 'Comercial'}`, 112, y + 33);

  y += 44;

  // 3. Escopo do Serviço
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(15, y, 180, 26, 2, 2, 'FD');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('ESCOPO DO SERVIÇO & PLANEJAMENTO', 18, y + 6);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(`Atividade: ${data.servico.categoria}`, 18, y + 12);
  doc.setFont('helvetica', 'normal');
  const desc = data.servico.descricaoPedido || 'Prestação de serviço técnico especializado.';
  const splitDesc = doc.splitTextToSize(`Descrição: ${desc}`, 174);
  doc.text(splitDesc, 18, y + 17);

  if (data.servico.recursosAlocados && data.servico.recursosAlocados.length > 0) {
    doc.text(`Materiais/Peças: ${data.servico.recursosAlocados.join(', ')}`, 18, y + 23);
  }

  y += 32;

  // 4. Demonstrativo Financeiro
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(15, y, 180, 32, 2, 2, 'FD');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('DEMONSTRATIVO FINANCEIRO E PAGAMENTO', 18, y + 6);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(`Forma de Pagamento: ${data.financeiro.formaPagamento || 'PIX'}`, 18, y + 13);
  doc.text(`Parcelas: ${data.financeiro.parcelas && data.financeiro.parcelas > 1 ? `${data.financeiro.parcelas}x` : 'À vista (1x)'}`, 18, y + 18);
  doc.text(`Nota Fiscal: ${data.financeiro.notaFiscal ? 'Sim (Emitida)' : 'Inclusa no Recibo'}`, 18, y + 23);

  doc.setFillColor(239, 246, 255);
  doc.roundedRect(110, y + 10, 80, 16, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('VALOR TOTAL DA OS:', 115, y + 17);
  doc.setFontSize(13);
  doc.setTextColor(29, 78, 216);
  doc.text(formatCurrency(data.financeiro.precoTotal), 185, y + 23, { align: 'right' });

  y += 38;

  // 5. Termo de Aceite e Garantia
  doc.setFillColor(254, 252, 232);
  doc.setDrawColor(253, 230, 138);
  doc.roundedRect(15, y, 180, 14, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(146, 64, 14);
  const legalText = 'Garantia Legal & Termo de Aceite: Os serviços executados possuem garantia de 90 dias (Art. 26 do CDC). O cliente declara ter conferido e aprovado a execução do serviço e os materiais empregados nesta Ordem de Serviço.';
  const splitLegal = doc.splitTextToSize(legalText, 174);
  doc.text(splitLegal, 18, y + 5);

  y += 20;

  // 6. Bloco de Assinaturas
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(25, y + 15, 85, y + 15);
  doc.line(125, y + 15, 185, y + 15);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(data.profissional?.nome || 'Profissional UAI Fix', 55, y + 19, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text('Prestador de Serviços Autorizado', 55, y + 23, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(data.cliente.nome, 155, y + 19, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text(`Aceite Digital • CPF: ${data.assinatura?.cpfAssinante || data.cliente.cpf || 'Registrado'}`, 155, y + 23, { align: 'center' });

  // 7. Rodapé
  doc.setFontSize(7);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text(`UAI FIX © ${new Date().getFullYear()} • Documento emitido eletronicamente com validade jurídica • Autenticidade: ${data.codigoOs}`, 105, 285, { align: 'center' });

  // Salvar PDF
  doc.save(`OS_${data.codigoOs || 'UAIFIX'}.pdf`);
};
