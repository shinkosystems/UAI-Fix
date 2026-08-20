import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../supabaseClient';
import { 
  FileSpreadsheet, Download, UploadCloud, CheckCircle2, AlertTriangle, 
  X, RefreshCw, FileCheck, ArrowRight, DollarSign, Database,
  Layers, ShieldAlert, Check, HelpCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ParsedOrcamentoRow {
  rowIndex: number;
  rawCodigoOs: string;
  chaveId?: number;
  chaveUnica?: string;
  clienteNome?: string;
  preco: number;
  tipopagmto: string;
  parcelas: number;
  hh: number;
  custofixo: number;
  custo_variavel: number;
  custo_deslocamento: number;
  taxa_plataforma: number;
  taxa_pagamento: number;
  lucro: number;
  notafiscal: boolean;
  observacaocliente: string;
  status: 'valid' | 'invalid';
  errorMessage?: string;
}

const AdminImportOrcamentos: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedOrcamentoRow[]>([]);
  const [previewFilter, setPreviewFilter] = useState<'todos' | 'valid' | 'invalid'>('todos');
  const [importSuccess, setImportSuccess] = useState<{ totalImported: number } | null>(null);

  // 1. Generate & Download Template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'codigo_os': 'OS-EXEMPLO-001',
        'preco': 350.00,
        'tipo_pagamento': 'Pix',
        'parcelas': 1,
        'mao_de_obra_hh': 100.00,
        'custo_fixo': 50.00,
        'custo_variavel': 80.00,
        'deslocamento': 30.00,
        'taxa_plataforma': 20.00,
        'taxa_pagamento': 0.00,
        'lucro': 70.00,
        'nota_fiscal': 'Sim',
        'observacoes_cliente': 'Substituição de peças com garantia de 90 dias'
      },
      {
        'codigo_os': 'OS-EXEMPLO-002',
        'preco': 720.00,
        'tipo_pagamento': 'Cartão de Crédito',
        'parcelas': 3,
        'mao_de_obra_hh': 200.00,
        'custo_fixo': 120.00,
        'custo_variavel': 150.00,
        'deslocamento': 40.00,
        'taxa_plataforma': 35.00,
        'taxa_pagamento': 25.00,
        'lucro': 150.00,
        'nota_fiscal': 'Não',
        'observacoes_cliente': 'Manutenção preventiva e corretiva'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);

    // Set column widths for readability
    worksheet['!cols'] = [
      { wch: 18 }, // codigo_os
      { wch: 12 }, // preco
      { wch: 18 }, // tipo_pagamento
      { wch: 10 }, // parcelas
      { wch: 16 }, // mao_de_obra_hh
      { wch: 12 }, // custo_fixo
      { wch: 14 }, // custo_variavel
      { wch: 14 }, // deslocamento
      { wch: 16 }, // taxa_plataforma
      { wch: 16 }, // taxa_pagamento
      { wch: 10 }, // lucro
      { wch: 12 }, // nota_fiscal
      { wch: 45 }  // observacoes_cliente
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Modelo Orçamentos');

    XLSX.writeFile(workbook, 'modelo_importacao_orcamentos_uaifix.xlsx');
  };

  // Normalize header keys (lowercase, remove spaces, accents)
  const normalizeKey = (key: string): string => {
    return key
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  };

  // 2. Parse & Validate File
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setLoading(true);
    setImportSuccess(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

      if (rawJson.length === 0) {
        alert('A planilha selecionada está vazia.');
        setLoading(false);
        return;
      }

      // Fetch all chaves to validate existence
      const { data: dbChaves, error: chavesError } = await supabase
        .from('chaves')
        .select(`
          id, 
          chaveunica, 
          status,
          cliente_user:users!chaves_cliente_fkey(nome)
        `);

      if (chavesError) throw chavesError;

      const chavesMap = new Map<string, { id: number; chaveunica: string; clienteNome?: string }>();
      dbChaves?.forEach((c: any) => {
        if (c.chaveunica) chavesMap.set(String(c.chaveunica).trim().toLowerCase(), { id: c.id, chaveunica: c.chaveunica, clienteNome: c.cliente_user?.nome });
        chavesMap.set(String(c.id).trim().toLowerCase(), { id: c.id, chaveunica: c.chaveunica, clienteNome: c.cliente_user?.nome });
      });

      const parsed: ParsedOrcamentoRow[] = rawJson.map((row, index) => {
        // Map dynamic keys
        const mappedRow: Record<string, any> = {};
        Object.entries(row).forEach(([k, v]) => {
          mappedRow[normalizeKey(k)] = v;
        });

        const rawCodigo = String(
          mappedRow['codigoos'] || 
          mappedRow['chaveunica'] || 
          mappedRow['chave'] || 
          mappedRow['os'] || 
          mappedRow['id'] || 
          ''
        ).trim();

        const precoNum = Number(mappedRow['preco'] || mappedRow['precototal'] || mappedRow['valor'] || 0);
        const parcelasNum = parseInt(mappedRow['parcelas'] || '1', 10);
        const tipoPagamento = String(mappedRow['tipopagamento'] || mappedRow['tipopagmto'] || mappedRow['formapagamento'] || 'Pix').trim();
        const hhNum = Number(mappedRow['maodeobrahh'] || mappedRow['hh'] || 0);
        const custoFixoNum = Number(mappedRow['custofixo'] || 0);
        const custoVariavelNum = Number(mappedRow['custovariavel'] || mappedRow['materiais'] || 0);
        const deslocamentoNum = Number(mappedRow['deslocamento'] || mappedRow['custodeslocamento'] || 0);
        const taxaPlataformaNum = Number(mappedRow['taxaplataforma'] || 0);
        const taxaPagamentoNum = Number(mappedRow['taxapagamento'] || 0);
        const lucroNum = Number(mappedRow['lucro'] || 0);
        const nfString = String(mappedRow['notafiscal'] || mappedRow['nf'] || 'não').toLowerCase();
        const notafiscal = ['sim', 's', 'true', '1', 'yes'].includes(nfString);
        const observacoes = String(mappedRow['observacoescliente'] || mappedRow['observacoes'] || mappedRow['obs'] || '').trim();

        let status: 'valid' | 'invalid' = 'valid';
        let errorMessage = '';

        if (!rawCodigo) {
          status = 'invalid';
          errorMessage = 'Código de OS ausente na linha.';
        } else {
          const matchedChave = chavesMap.get(rawCodigo.toLowerCase());
          if (!matchedChave) {
            status = 'invalid';
            errorMessage = `OS "${rawCodigo}" não encontrada no sistema.`;
          } else if (isNaN(precoNum) || precoNum <= 0) {
            status = 'invalid';
            errorMessage = 'Preço total inválido (deve ser maior que zero).';
          } else {
            return {
              rowIndex: index + 2,
              rawCodigoOs: rawCodigo,
              chaveId: matchedChave.id,
              chaveUnica: matchedChave.chaveunica,
              clienteNome: matchedChave.clienteNome,
              preco: precoNum,
              tipopagmto: tipoPagamento,
              parcelas: isNaN(parcelasNum) || parcelasNum < 1 ? 1 : parcelasNum,
              hh: isNaN(hhNum) ? 0 : hhNum,
              custofixo: isNaN(custoFixoNum) ? 0 : custoFixoNum,
              custo_variavel: isNaN(custoVariavelNum) ? 0 : custoVariavelNum,
              custo_deslocamento: isNaN(deslocamentoNum) ? 0 : deslocamentoNum,
              taxa_plataforma: isNaN(taxaPlataformaNum) ? 0 : taxaPlataformaNum,
              taxa_pagamento: isNaN(taxaPagamentoNum) ? 0 : taxaPagamentoNum,
              lucro: isNaN(lucroNum) ? 0 : lucroNum,
              notafiscal,
              observacaocliente: observacoes,
              status: 'valid'
            };
          }
        }

        return {
          rowIndex: index + 2,
          rawCodigoOs: rawCodigo || 'Vazio',
          preco: isNaN(precoNum) ? 0 : precoNum,
          tipopagmto: tipoPagamento,
          parcelas: parcelasNum || 1,
          hh: hhNum || 0,
          custofixo: custoFixoNum || 0,
          custo_variavel: custoVariavelNum || 0,
          custo_deslocamento: deslocamentoNum || 0,
          taxa_plataforma: taxaPlataformaNum || 0,
          taxa_pagamento: taxaPagamentoNum || 0,
          lucro: lucroNum || 0,
          notafiscal,
          observacaocliente: observacoes,
          status: 'invalid',
          errorMessage
        };
      });

      setParsedRows(parsed);
    } catch (err: any) {
      console.error('Erro ao ler planilha:', err);
      alert(`Falha ao processar arquivo: ${err.message || 'Formato incompatível'}`);
    } finally {
      setLoading(false);
    }
  };

  // 3. Confirm and Save to Supabase
  const handleConfirmImport = async () => {
    const validItems = parsedRows.filter(r => r.status === 'valid' && r.chaveId);
    if (validItems.length === 0) {
      alert('Nenhum registro válido para importação.');
      return;
    }

    setImporting(true);

    try {
      // 1. Prepare batch insert for orcamentos
      const orcamentosToInsert = validItems.map(item => ({
        chave: item.chaveId!,
        preco: item.preco,
        tipopagmto: item.tipopagmto,
        parcelas: item.parcelas,
        hh: item.hh,
        custofixo: item.custofixo,
        custo_variavel: item.custo_variavel || 0,
        custo_deslocamento: item.custo_deslocamento || 0,
        taxa_plataforma: item.taxa_plataforma || 0,
        taxa_pagamento: item.taxa_pagamento || 0,
        lucro: item.lucro,
        notafiscal: item.notafiscal,
        observacaocliente: item.observacaocliente,
        ativo: true
      }));

      // Desativar orçamentos anteriores para as mesmas chaves
      const chaveIds = validItems.map(i => i.chaveId!);
      await supabase
        .from('orcamentos')
        .update({ ativo: false })
        .in('chave', chaveIds);

      // Inserir os novos orçamentos
      const { error: insertError } = await supabase
        .from('orcamentos')
        .insert(orcamentosToInsert);

      if (insertError) throw insertError;

      // 2. Atualizar status das OSs para 'orcamento'
      await supabase
        .from('chaves')
        .update({ status: 'orcamento' })
        .in('id', chaveIds);

      setImportSuccess({ totalImported: validItems.length });
      setParsedRows([]);
      setFile(null);
    } catch (err: any) {
      console.error('Erro ao gravar orçamentos no Supabase:', err);
      alert(`Erro durante a importação: ${err.message || 'Erro de conexão com o banco'}`);
    } finally {
      setImporting(false);
    }
  };

  const validCount = parsedRows.filter(r => r.status === 'valid').length;
  const invalidCount = parsedRows.filter(r => r.status === 'invalid').length;

  const displayedRows = parsedRows.filter(r => {
    if (previewFilter === 'valid') return r.status === 'valid';
    if (previewFilter === 'invalid') return r.status === 'invalid';
    return true;
  });

  return (
    <div className="space-y-8">

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider border border-blue-400/30">
              <Database size={14} /> Integração & Ingestão em Lote
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Importação de Orçamentos</h1>
            <p className="text-sm text-slate-300">
              Envie planilhas Excel (.xlsx, .xls) ou .csv para cadastrar e vincular orçamentos em lote às Ordens de Serviço.
            </p>
          </div>

          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm border border-white/20 shadow-sm transition-all flex-shrink-0"
          >
            <Download size={16} />
            Baixar Modelo (.xlsx)
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {importSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-emerald-900">Importação Concluída com Sucesso!</h3>
              <p className="text-sm text-emerald-700">
                <strong>{importSuccess.totalImported}</strong> orçamentos foram validados e inseridos no sistema. As OSs correspondentes foram atualizadas.
              </p>
            </div>
          </div>
          <button
            onClick={() => setImportSuccess(null)}
            className="p-2 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Upload Box & Instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Upload Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                <FileSpreadsheet size={18} className="text-blue-600" />
                Carregar Planilha de Orçamentos
              </div>
              <span className="text-xs text-slate-400">Formatos aceitos: .xlsx, .xls, .csv</span>
            </div>

            <label className="relative border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-blue-50/30">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="sr-only"
                disabled={loading}
              />
              <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
                <UploadCloud size={28} />
              </div>
              <p className="text-sm font-bold text-slate-800">
                {file ? file.name : 'Clique para selecionar ou arraste o arquivo aqui'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Tamanho máximo recomendado: 10MB
              </p>
            </label>
          </div>

          {loading && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-blue-600 font-semibold">
              <RefreshCw size={16} className="animate-spin" />
              Lendo planilha e validando códigos no banco de dados...
            </div>
          )}
        </div>

        {/* Guidelines Card */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
              <HelpCircle size={18} />
              Instruções de Preenchimento
            </div>
            <ul className="text-xs text-slate-300 space-y-2.5 list-disc pl-4">
              <li>
                <strong className="text-white">codigo_os:</strong> Deve corresponder ao código da OS (ex: <code>OS-001</code>) ou ao ID numérico existente.
              </li>
              <li>
                <strong className="text-white">preco:</strong> Valor total do serviço (ex: <code>450.00</code>).
              </li>
              <li>
                <strong className="text-white">tipo_pagamento:</strong> Pix, Cartão de Crédito, Boleto, etc.
              </li>
              <li>
                <strong className="text-white">nota_fiscal:</strong> Preencha com <code>Sim</code> ou <code>Não</code>.
              </li>
              <li>
                Campos opcionais: <code>mao_de_obra_hh</code>, <code>custo_fixo</code>, <code>lucro</code>, <code>observacoes_cliente</code>.
              </li>
            </ul>
          </div>

          <button
            onClick={handleDownloadTemplate}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
          >
            <Download size={14} />
            Baixar Planilha Modelo
          </button>
        </div>

      </div>

      {/* Preview Section */}
      {parsedRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-6 p-6">
          
          {/* Header & Stats Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FileCheck size={18} className="text-blue-600" />
                Conferência e Validação Prévia ({parsedRows.length} linhas lidas)
              </h2>
              <p className="text-xs text-slate-500">
                Revise os dados abaixo antes de confirmar a gravação no banco de dados.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setPreviewFilter('todos')}
                className={`px-3 py-1.5 rounded-lg transition-all ${previewFilter === 'todos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
              >
                Todos ({parsedRows.length})
              </button>
              <button
                onClick={() => setPreviewFilter('valid')}
                className={`px-3 py-1.5 rounded-lg transition-all ${previewFilter === 'valid' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-slate-600'}`}
              >
                Válidos ({validCount})
              </button>
              {invalidCount > 0 && (
                <button
                  onClick={() => setPreviewFilter('invalid')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${previewFilter === 'invalid' ? 'bg-white text-red-700 shadow-xs font-bold' : 'text-slate-600'}`}
                >
                  Com Erros ({invalidCount})
                </button>
              )}
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                <CheckCircle2 size={14} /> {validCount} prontos para gravar
              </span>
              {invalidCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 font-bold">
                  <AlertTriangle size={14} /> {invalidCount} com inconsistências (serão ignorados)
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={() => { setParsedRows([]); setFile(null); }}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 text-xs font-semibold transition-colors"
                disabled={importing}
              >
                Cancelar
              </button>

              <button
                onClick={handleConfirmImport}
                disabled={validCount === 0 || importing}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md ${
                  validCount > 0 && !importing
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {importing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Gravando no Banco...
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    Confirmar e Importar {validCount} Orçamentos
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Preview Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Linha</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Código OS</th>
                  <th className="py-3 px-3">Cliente</th>
                  <th className="py-3 px-3">Preço</th>
                  <th className="py-3 px-3">Pagamento</th>
                  <th className="py-3 px-3">Parcelas</th>
                  <th className="py-3 px-3">NF</th>
                  <th className="py-3 px-3">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {displayedRows.map((row) => (
                  <tr 
                    key={row.rowIndex} 
                    className={row.status === 'valid' ? 'hover:bg-slate-50' : 'bg-red-50/40 hover:bg-red-50/70'}
                  >
                    <td className="py-3 px-3 text-slate-400 font-mono">#{row.rowIndex}</td>
                    <td className="py-3 px-3">
                      {row.status === 'valid' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                          <CheckCircle2 size={14} /> Válido
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600 font-bold" title={row.errorMessage}>
                          <AlertTriangle size={14} /> {row.errorMessage}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">{row.rawCodigoOs}</td>
                    <td className="py-3 px-3 text-slate-800">{row.clienteNome || '-'}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">R$ {row.preco.toFixed(2)}</td>
                    <td className="py-3 px-3 text-slate-600">{row.tipopagmto}</td>
                    <td className="py-3 px-3 text-slate-600">{row.parcelas}x</td>
                    <td className="py-3 px-3">{row.notafiscal ? 'Sim' : 'Não'}</td>
                    <td className="py-3 px-3 text-slate-500 max-w-xs truncate" title={row.observacaocliente}>
                      {row.observacaocliente || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

    </div>
  );
};

export default AdminImportOrcamentos;
