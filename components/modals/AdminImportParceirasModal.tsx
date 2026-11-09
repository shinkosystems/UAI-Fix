import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../supabaseClient';
import { 
  FileSpreadsheet, Download, UploadCloud, CheckCircle2, AlertTriangle, 
  X, RefreshCw, Building2, Users, ShieldCheck, Wrench, ArrowRight,
  Check, FileCheck, Layers, HelpCircle
} from 'lucide-react';

interface ParsedUserRow {
  index: number;
  tipo: 'gestor' | 'cliente' | 'profissional';
  nome: string;
  cpf: string;
  email: string;
  whatsapp: string;
  status: 'valid' | 'invalid';
  errorMessage?: string;
}

interface ParsedEmpresaData {
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj?: string;
  dataCriacao?: string;
  setor?: string;
  email?: string;
  whatsapp?: string;
}

interface AdminImportParceirasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AdminImportParceirasModal: React.FC<AdminImportParceirasModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  
  const [empresaData, setEmpresaData] = useState<ParsedEmpresaData | null>(null);
  const [parsedUsers, setParsedUsers] = useState<ParsedUserRow[]>([]);
  const [previewFilter, setPreviewFilter] = useState<'todos' | 'gestor' | 'cliente' | 'profissional' | 'invalid'>('todos');
  const [importResult, setImportResult] = useState<{ totalEmpresa: string; totalUsers: number } | null>(null);

  if (!isOpen) return null;

  // 1. Download Template Excel com 4 Abas Padronizadas
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Aba 1: Dados da Empresa
    const empresaSheetData = [
      {
        'Razao_Social': 'Exemplo Reformas e Facilities LTDA',
        'Nome_Fantasia': 'Exemplo Reformas',
        'CNPJ': '12.345.678/0001-90',
        'Data_Criacao': '2020-05-15',
        'Setor_Mercado': 'Reformas Prediais e Comerciais',
        'Email_Corporativo': 'contato@exemploreformas.com.br',
        'WhatsApp_Contato': '(31) 99999-8888'
      }
    ];
    const wsEmpresa = XLSX.utils.json_to_sheet(empresaSheetData);
    wsEmpresa['!cols'] = [{ wch: 35 }, { wch: 25 }, { wch: 22 }, { wch: 15 }, { wch: 30 }, { wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsEmpresa, 'Empresa');

    // Aba 2: Gestores
    const gestoresSheetData = [
      { 'Nome': 'Carlos Alberto Gestor', 'CPF': '111.222.333-44', 'E-mail': 'carlos.gestor@exemplo.com.br', 'WhatsApp': '31998765432' },
      { 'Nome': 'Mariana Silva Coordenadora', 'CPF': '222.333.444-55', 'E-mail': 'mariana.silva@exemplo.com.br', 'WhatsApp': '31998765433' }
    ];
    const wsGestores = XLSX.utils.json_to_sheet(gestoresSheetData);
    wsGestores['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 32 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsGestores, 'Gestores');

    // Aba 3: Clientes
    const clientesSheetData = [
      { 'Nome': 'Condomínio Residencial Parque Sul', 'CPF': '333.444.555-66', 'E-mail': 'sindico@parquesul.com.br', 'WhatsApp': '31988881111' },
      { 'Nome': 'Loja Shopping Boulevard', 'CPF': '444.555.666-77', 'E-mail': 'gerencia@shoppingboulevard.com', 'WhatsApp': '31988882222' }
    ];
    const wsClientes = XLSX.utils.json_to_sheet(clientesSheetData);
    wsClientes['!cols'] = [{ wch: 35 }, { wch: 18 }, { wch: 32 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsClientes, 'Clientes');

    // Aba 4: Parceiros / Prestadores
    const prestadoresSheetData = [
      { 'Nome': 'João Pintor Especialista', 'CPF': '555.666.777-88', 'E-mail': 'joao.pintor@exemplo.com.br', 'WhatsApp': '31977773333' },
      { 'Nome': 'Marcos Eletricista Técnico', 'CPF': '666.777.888-99', 'E-mail': 'marcos.eletrica@exemplo.com.br', 'WhatsApp': '31977774444' }
    ];
    const wsPrestadores = XLSX.utils.json_to_sheet(prestadoresSheetData);
    wsPrestadores['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 32 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsPrestadores, 'Prestadores');

    XLSX.writeFile(wb, 'modelo_onboarding_empresa_parceira_uaifix.xlsx');
  };

  // 2. Parser Resiliente (Suporta Multi-Aba ou Folha Única com Blocos Verticais)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setLoading(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        let parsedEmpresa: ParsedEmpresaData | null = null;
        const usersList: ParsedUserRow[] = [];
        let globalIndex = 1;

        const cleanVal = (val: any): string => {
          if (val === undefined || val === null) return '';
          return String(val).trim();
        };

        const cleanCpf = (val: any): string => {
          return cleanVal(val).replace(/\D/g, '');
        };

        const cleanZap = (val: any): string => {
          let zap = cleanVal(val).replace(/\D/g, '');
          if (zap && !zap.startsWith('55') && (zap.length === 10 || zap.length === 11)) {
            zap = '55' + zap;
          }
          return zap;
        };

        const sheetNames = wb.SheetNames;
        const isMultiSheet = sheetNames.some(name => {
          const n = name.toLowerCase();
          return n.includes('gestor') || n.includes('cliente') || n.includes('prestador') || n.includes('parceiro') || n.includes('empresa');
        });

        if (isMultiSheet) {
          // Processamento Multi-Aba
          sheetNames.forEach(sheetName => {
            const lowerName = sheetName.toLowerCase();
            const ws = wb.Sheets[sheetName];
            const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

            if (lowerName.includes('empresa')) {
              if (rows.length > 0) {
                const r = rows[0];
                parsedEmpresa = {
                  razaoSocial: cleanVal(r['Razao_Social'] || r['Razão Social'] || r['Nome'] || r['Empresa']),
                  nomeFantasia: cleanVal(r['Nome_Fantasia'] || r['Nome Fantasia'] || r['Fantasia']),
                  cnpj: cleanVal(r['CNPJ'] || r['CPF/CNPJ'] || r['CPF_CNPJ']),
                  dataCriacao: cleanVal(r['Data_Criacao'] || r['Data de criação'] || r['Data']),
                  setor: cleanVal(r['Setor_Mercado'] || r['Setor de mercado'] || r['Setor']),
                  email: cleanVal(r['Email_Corporativo'] || r['E-mail'] || r['Email']),
                  whatsapp: cleanZap(r['WhatsApp_Contato'] || r['WhatsApp'] || r['WhatsApp (zap)'])
                };
              }
            } else {
              let targetRole: 'gestor' | 'cliente' | 'profissional' = 'cliente';
              if (lowerName.includes('gestor')) targetRole = 'gestor';
              else if (lowerName.includes('prestador') || lowerName.includes('parceiro') || lowerName.includes('profissional')) targetRole = 'profissional';

              rows.forEach(r => {
                const nome = cleanVal(r['Nome'] || r['nome'] || r['NOME']);
                const email = cleanVal(r['E-mail'] || r['Email'] || r['e-mail'] || r['email']).toLowerCase();
                const cpf = cleanCpf(r['CPF'] || r['Cpf'] || r['CPF/CNPJ'] || r['cpf']);
                const zap = cleanZap(r['WhatsApp (zap)'] || r['WhatsApp'] || r['Whatsapp'] || r['zap'] || r['telefone']);

                if (!nome && !email && !cpf) return; // ignora linha vazia

                const isValid = Boolean(nome && email && email.includes('@'));
                usersList.push({
                  index: globalIndex++,
                  tipo: targetRole,
                  nome: nome || 'Sem Nome',
                  cpf,
                  email: email || 'sem-email@uaifix.com',
                  whatsapp: zap,
                  status: isValid ? 'valid' : 'invalid',
                  errorMessage: !nome ? 'Nome obrigatório' : (!email || !email.includes('@')) ? 'E-mail inválido' : undefined
                });
              });
            }
          });
        } else {
          // Processamento Folha Única com Blocos Verticais (Formato Beto)
          const firstSheet = wb.Sheets[sheetNames[0]];
          const rawRows: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

          let currentRole: 'gestor' | 'cliente' | 'profissional' = 'gestor';
          let roleBlockCount = 0;
          let readingEmpresa = false;

          rawRows.forEach((row) => {
            const rowStr = row.map(cleanVal).join(' ').trim();
            if (!rowStr) return;

            // Identifica início de novo bloco ou instruções
            if (rowStr.includes('Preencha a partir da linha 6') || rowStr.includes('Campos obrigatórios')) {
              roleBlockCount++;
              if (roleBlockCount === 1) currentRole = 'gestor';
              else if (roleBlockCount === 2) currentRole = 'cliente';
              else if (roleBlockCount >= 3) currentRole = 'profissional';
              return;
            }

            if (rowStr.toLowerCase().includes('dados da empresa atendida') || rowStr.toLowerCase().includes('empresa de reforma parceira')) {
              readingEmpresa = true;
              return;
            }

            // Ignora cabeçalhos de tabela
            if (row[0] && String(row[0]).toLowerCase() === 'nome' && row[1] && String(row[1]).toLowerCase().includes('cpf')) {
              return;
            }

            // Lendo dados da Empresa
            if (readingEmpresa) {
              const val = cleanVal(row[0] || row[1]);
              if (!parsedEmpresa) {
                parsedEmpresa = { razaoSocial: val || 'Empresa Parceira Conveniada' };
              } else if (!parsedEmpresa.nomeFantasia && val) {
                parsedEmpresa.nomeFantasia = val;
              } else if (!parsedEmpresa.dataCriacao && val) {
                parsedEmpresa.dataCriacao = val;
              } else if (!parsedEmpresa.setor && val) {
                parsedEmpresa.setor = val;
              }
              return;
            }

            // Lendo linhas de usuários
            const nome = cleanVal(row[0]);
            const cpf = cleanCpf(row[1]);
            const email = cleanVal(row[2]).toLowerCase();
            const zap = cleanZap(row[3]);

            if (!nome && !email) return;

            const isValid = Boolean(nome && email && email.includes('@'));
            usersList.push({
              index: globalIndex++,
              tipo: currentRole,
              nome: nome || 'Sem Nome',
              cpf,
              email: email || 'sem-email@uaifix.com',
              whatsapp: zap,
              status: isValid ? 'valid' : 'invalid',
              errorMessage: !nome ? 'Nome obrigatório' : (!email || !email.includes('@')) ? 'E-mail inválido' : undefined
            });
          });
        }

        if (!parsedEmpresa) {
          parsedEmpresa = {
            razaoSocial: selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'Empresa Parceira'
          };
        }

        setEmpresaData(parsedEmpresa);
        setParsedUsers(usersList);
      } catch (err) {
        console.error('Erro ao processar planilha:', err);
        alert('Erro ao processar o arquivo. Verifique se o formato é válido (.xlsx, .xls ou .csv).');
      } finally {
        setLoading(false);
      }
    };

    reader.readAsBinaryString(selectedFile);
  };

  // 3. Execução da Ingestão no Supabase
  const handleExecuteImport = async () => {
    if (!empresaData || parsedUsers.length === 0) return;

    const validUsers = parsedUsers.filter(u => u.status === 'valid');
    if (validUsers.length === 0) {
      alert('Nenhum registro válido para importar.');
      return;
    }

    try {
      setImporting(true);

      // Passo 1: Criar ou Obter a Empresa Parceira no Banco
      let empresaId: number | null = null;
      try {
        const { data: emp, error: empErr } = await supabase
          .from('empresas_parceiras')
          .insert({
            razao_social: empresaData.razaoSocial,
            nome_fantasia: empresaData.nomeFantasia || empresaData.razaoSocial,
            cnpj: empresaData.cnpj || null,
            setor: empresaData.setor || null,
            email: empresaData.email || null,
            whatsapp: empresaData.whatsapp || null,
            data_criacao: empresaData.dataCriacao || null
          })
          .select('id')
          .single();

        if (!empErr && emp) {
          empresaId = emp.id;
        }
      } catch (e) {
        console.warn('Tabela empresas_parceiras pode não estar criada ainda, continuando com vínculo nominal:', e);
      }

      // Passo 2: Inserir Usuários em Lote na Tabela users
      const usersToInsert = validUsers.map(u => ({
        uuid: crypto.randomUUID(),
        nome: u.nome,
        email: u.email,
        cpf: u.cpf || null,
        whatsapp: u.whatsapp || null,
        tipo: u.tipo,
        ativo: true,
        sexo: 'N',
        cidade: 1,
        estado: 1,
        empresa_id: empresaId,
        empresa_nome: empresaData?.razaoSocial || null
      }));

      const { error: insertErr } = await supabase
        .from('users')
        .insert(usersToInsert);

      if (insertErr) {
        throw insertErr;
      }

      setImportResult({
        totalEmpresa: empresaData.razaoSocial,
        totalUsers: validUsers.length
      });

      onSuccess();
    } catch (err: any) {
      console.error('Erro na ingestão em lote:', err);
      alert('Erro ao gravar registros no banco de dados: ' + (err.message || 'Verifique as permissões de acesso.'));
    } finally {
      setImporting(false);
    }
  };

  const filteredUsers = parsedUsers.filter(u => {
    if (previewFilter === 'todos') return true;
    if (previewFilter === 'invalid') return u.status === 'invalid';
    return u.tipo === previewFilter;
  });

  const gestoresCount = parsedUsers.filter(u => u.tipo === 'gestor').length;
  const clientesCount = parsedUsers.filter(u => u.tipo === 'cliente').length;
  const prestadoresCount = parsedUsers.filter(u => u.tipo === 'profissional').length;
  const invalidCount = parsedUsers.filter(u => u.status === 'invalid').length;
  const validCount = parsedUsers.filter(u => u.status === 'valid').length;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-2xl shadow-xs">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Onboarding em Lote de Empresa Parceira
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Importação automática da Empresa, Gestores, Clientes e Prestadores via planilha Excel/CSV
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Download size={13} />
              <span>Baixar Modelo (.xlsx)</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Estado de Sucesso */}
          {importResult && (
            <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                <Check size={24} />
              </div>
              <h4 className="text-lg font-black text-emerald-950">
                Ingestão Concluída com Sucesso!
              </h4>
              <p className="text-xs text-emerald-800 max-w-md mx-auto">
                A empresa <strong>{importResult.totalEmpresa}</strong> e <strong>{importResult.totalUsers} usuários</strong> (gestores, clientes e prestadores) foram cadastrados e vinculados no ecossistema UAI-Fix.
              </p>
              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="px-5 py-2 bg-emerald-700 text-white font-bold text-xs rounded-xl hover:bg-emerald-800 transition-colors cursor-pointer shadow-xs"
                >
                  Fechar Janela
                </button>
              </div>
            </div>
          )}

          {/* Upload Dropzone */}
          {!importResult && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  file ? 'border-blue-400 bg-blue-50/30' : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <UploadCloud className="mx-auto text-slate-400 mb-2" size={32} />
                <div className="text-xs font-bold text-slate-800">
                  {file ? file.name : 'Clique para selecionar a planilha de onboarding (.xlsx ou .csv)'}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  O sistema reconhece automaticamente os blocos de Gestores, Clientes e Prestadores
                </p>
              </div>
            </div>
          )}

          {/* Preview dos Dados Identificados */}
          {parsedUsers.length > 0 && !importResult && (
            <div className="space-y-4">
              
              {/* Card da Empresa */}
              {empresaData && (
                <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white/10 rounded-xl">
                      <Building2 size={22} className="text-amber-400" />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold text-amber-400 tracking-wider uppercase">
                        Empresa Parceira Identificada
                      </span>
                      <h4 className="text-base font-extrabold">{empresaData.razaoSocial}</h4>
                      <div className="text-xs text-slate-300 mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                        {empresaData.cnpj && <span>CNPJ: {empresaData.cnpj}</span>}
                        {empresaData.setor && <span>Setor: {empresaData.setor}</span>}
                        {empresaData.dataCriacao && <span>Fundação: {empresaData.dataCriacao}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-xs rounded-xl">
                      Pronta para Vínculo
                    </span>
                  </div>
                </div>
              )}

              {/* Cards de Contadores de Usuários */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200">
                  <div className="flex items-center gap-2 text-purple-700 font-bold text-[11px]">
                    <ShieldCheck size={14} /> Gestores
                  </div>
                  <div className="text-xl font-extrabold text-purple-950 mt-1">{gestoresCount}</div>
                  <div className="text-[10px] text-purple-600">Acesso operacional</div>
                </div>

                <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200">
                  <div className="flex items-center gap-2 text-blue-700 font-bold text-[11px]">
                    <Users size={14} /> Clientes
                  </div>
                  <div className="text-xl font-extrabold text-blue-950 mt-1">{clientesCount}</div>
                  <div className="text-[10px] text-blue-600">Carteira de reformas</div>
                </div>

                <div className="p-3 bg-teal-50 rounded-2xl border border-teal-200">
                  <div className="flex items-center gap-2 text-teal-700 font-bold text-[11px]">
                    <Wrench size={14} /> Prestadores
                  </div>
                  <div className="text-xl font-extrabold text-teal-950 mt-1">{prestadoresCount}</div>
                  <div className="text-[10px] text-teal-600">Profissionais de campo</div>
                </div>

                <div className={`p-3 rounded-2xl border ${invalidCount > 0 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                  <div className="flex items-center gap-2 font-bold text-[11px]">
                    <AlertTriangle size={14} className={invalidCount > 0 ? 'text-amber-600' : 'text-slate-400'} /> 
                    Pendentes
                  </div>
                  <div className="text-xl font-extrabold mt-1">{invalidCount}</div>
                  <div className="text-[10px] opacity-80">Dados incompletos</div>
                </div>
              </div>

              {/* Filtros da Tabela de Preview */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1 overflow-x-auto text-xs">
                  <button
                    onClick={() => setPreviewFilter('todos')}
                    className={`px-3 py-1.5 font-bold rounded-lg transition-colors cursor-pointer ${
                      previewFilter === 'todos' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Todos ({parsedUsers.length})
                  </button>
                  <button
                    onClick={() => setPreviewFilter('gestor')}
                    className={`px-3 py-1.5 font-bold rounded-lg transition-colors cursor-pointer ${
                      previewFilter === 'gestor' ? 'bg-purple-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Gestores ({gestoresCount})
                  </button>
                  <button
                    onClick={() => setPreviewFilter('cliente')}
                    className={`px-3 py-1.5 font-bold rounded-lg transition-colors cursor-pointer ${
                      previewFilter === 'cliente' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Clientes ({clientesCount})
                  </button>
                  <button
                    onClick={() => setPreviewFilter('profissional')}
                    className={`px-3 py-1.5 font-bold rounded-lg transition-colors cursor-pointer ${
                      previewFilter === 'profissional' ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Prestadores ({prestadoresCount})
                  </button>
                  {invalidCount > 0 && (
                    <button
                      onClick={() => setPreviewFilter('invalid')}
                      className={`px-3 py-1.5 font-bold rounded-lg transition-colors cursor-pointer ${
                        previewFilter === 'invalid' ? 'bg-amber-600 text-white' : 'text-amber-700 hover:bg-amber-50'
                      }`}
                    >
                      Incompletos ({invalidCount})
                    </button>
                  )}
                </div>

                <div className="text-xs text-slate-500 font-medium">
                  {validCount} registros prontos para gravação
                </div>
              </div>

              {/* Tabela de Preview dos Usuários */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-600 font-bold sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Papel</th>
                      <th className="py-2.5 px-3">Nome</th>
                      <th className="py-2.5 px-3">CPF</th>
                      <th className="py-2.5 px-3">E-mail</th>
                      <th className="py-2.5 px-3">WhatsApp</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((u) => (
                      <tr key={u.index} className="hover:bg-slate-50/80">
                        <td className="py-2 px-3">
                          <span className={`inline-block px-2 py-0.5 text-[10px] font-extrabold rounded-md uppercase ${
                            u.tipo === 'gestor' ? 'bg-purple-100 text-purple-800' :
                            u.tipo === 'profissional' ? 'bg-teal-100 text-teal-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {u.tipo}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900">{u.nome}</td>
                        <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">{u.cpf || '-'}</td>
                        <td className="py-2 px-3 text-slate-600">{u.email}</td>
                        <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">{u.whatsapp || '-'}</td>
                        <td className="py-2 px-3 text-right">
                          {u.status === 'valid' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                              <CheckCircle2 size={13} /> Válido
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600" title={u.errorMessage}>
                              <AlertTriangle size={13} /> {u.errorMessage || 'Incompleto'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          {parsedUsers.length > 0 && !importResult && (
            <button
              onClick={handleExecuteImport}
              disabled={importing || validCount === 0}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {importing ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Gravando no Banco...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Confirmar & Ingerir {validCount} Cadastros</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default AdminImportParceirasModal;
