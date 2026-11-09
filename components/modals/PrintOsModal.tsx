import React, { useState } from 'react';
import { X, Printer, Download, FileText, CheckCircle2, ShieldCheck, User, Calendar, MapPin, Building2, Crown, DollarSign, TrendingUp, Percent } from 'lucide-react';
import { OsPrintData, OsReportLevel, printOsDocument, downloadOsPdf, formatCurrency, formatDateBr } from '../../utils/osPrinter';

interface PrintOsModalProps {
  isOpen: boolean;
  onClose: () => void;
  osData: OsPrintData | null;
}

export const PrintOsModal: React.FC<PrintOsModalProps> = ({ isOpen, onClose, osData }) => {
  if (!isOpen || !osData) return null;

  const [level, setLevel] = useState<OsReportLevel>(osData.reportLevel || 'cliente');

  const preco = osData.financeiro.precoTotal || 0;
  const hh = osData.financeiro.maoDeObraHh || 0;
  const mat = osData.financeiro.custoVariavel || 0;
  const desloc = osData.financeiro.deslocamento || 0;
  const custoDireto = hh + mat + desloc;
  const custoFixo = osData.financeiro.custoFixo || 0;
  const imposto = osData.financeiro.imposto || 0;
  const taxaPlat = osData.financeiro.taxaPlataforma !== undefined ? osData.financeiro.taxaPlataforma : (preco * 0.10);
  const taxaGate = osData.financeiro.taxaGateway !== undefined ? osData.financeiro.taxaGateway : (preco * 0.0399);
  const lucroParceira = osData.financeiro.lucroParceira !== undefined ? osData.financeiro.lucroParceira : Math.max(0, preco - custoDireto - custoFixo - imposto - taxaPlat);
  const margemLiquidaUaiFix = taxaPlat - taxaGate;

  const margemParceiraPct = preco > 0 ? ((lucroParceira / preco) * 100).toFixed(1) : '0.0';
  const takeRatePct = preco > 0 ? ((taxaPlat / preco) * 100).toFixed(1) : '0.0';

  const handlePrint = () => {
    printOsDocument(osData, level);
  };

  const handleDownloadPdf = () => {
    downloadOsPdf(osData, level);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200">
        
        {/* Header do Modal com Seletor dos 3 Níveis */}
        <div className="flex flex-col gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl shadow-xs text-white ${
                level === 'master' ? 'bg-amber-600 shadow-amber-500/20' : 
                level === 'parceira' ? 'bg-teal-600 shadow-teal-500/20' : 
                'bg-blue-600 shadow-blue-500/20'
              }`}>
                {level === 'master' ? <Crown size={20} /> : level === 'parceira' ? <Building2 size={20} /> : <FileText size={20} />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Ordem de Serviço #{osData.codigoOs}
                  </h3>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                    level === 'master' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                    level === 'parceira' ? 'bg-teal-100 text-teal-800 border border-teal-300' :
                    'bg-blue-100 text-blue-800 border border-blue-200'
                  }`}>
                    {level === 'master' ? 'Visão Master' : level === 'parceira' ? 'Visão Parceira' : 'Visão Cliente'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {level === 'master' ? 'Auditoria integral 360° com take-rate e margem da plataforma' :
                   level === 'parceira' ? 'DRE operacional B2B com custos diretos e margem da parceira' :
                   'Comprovante oficial de conclusão, escopo e garantia para o cliente final'}
                </p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Seletor Trinitário de Relatório (3 Níveis) */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/60 rounded-xl">
            <button
              type="button"
              onClick={() => setLevel('cliente')}
              className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                level === 'cliente'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User size={13} />
              <span>1. Cliente Final</span>
            </button>
            <button
              type="button"
              onClick={() => setLevel('parceira')}
              className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                level === 'parceira'
                  ? 'bg-white text-teal-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 size={13} />
              <span>2. Empresa Parceira</span>
            </button>
            <button
              type="button"
              onClick={() => setLevel('master')}
              className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                level === 'master'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Crown size={13} />
              <span>3. UAI-Fix Master</span>
            </button>
          </div>
        </div>

        {/* Conteúdo Prévia da OS */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-slate-800">
          
          {/* Card Resumo do Cabeçalho */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${
            level === 'master' ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200' :
            level === 'parceira' ? 'bg-gradient-to-r from-teal-50 to-emerald-50 border-teal-200' :
            'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
          }`}>
            <div>
              <span className={`text-[10px] font-black tracking-wider uppercase ${
                level === 'master' ? 'text-amber-700' : level === 'parceira' ? 'text-teal-700' : 'text-blue-600'
              }`}>
                {level === 'master' ? 'UAI Fix Master • Governança' : level === 'parceira' ? 'UAI Fix • B2B Parceiras' : 'UAI Fix Soluções'}
              </span>
              <div className="text-lg font-black text-slate-900">OS #{osData.codigoOs}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Emissão: {osData.dataEmissao ? formatDateBr(osData.dataEmissao) : formatDateBr(new Date().toISOString())}
              </div>
            </div>
            <div className="text-right">
              <span className={`inline-block px-3 py-1 font-bold text-xs rounded-full shadow-xs text-white ${
                level === 'master' ? 'bg-amber-600' : level === 'parceira' ? 'bg-teal-600' : 'bg-blue-600'
              }`}>
                {osData.status || 'Concluído'}
              </span>
              <div className={`text-base font-black mt-1 ${
                level === 'master' ? 'text-amber-800' : level === 'parceira' ? 'text-teal-800' : 'text-blue-700'
              }`}>
                {formatCurrency(preco)}
              </div>
            </div>
          </div>

          {/* Grid Cliente / Profissional / Empresa */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-bold uppercase text-[10px] tracking-wider text-blue-600 flex items-center gap-1.5">
                <User size={13} /> Cliente Final
              </div>
              <div className="font-bold text-slate-900 text-sm">{osData.cliente.nome}</div>
              {osData.cliente.cpf && <div className="text-slate-600">CPF: {osData.cliente.cpf}</div>}
              {osData.cliente.telefone && <div className="text-slate-600">Telefone: {osData.cliente.telefone}</div>}
              <div className="text-slate-600 leading-relaxed">
                {osData.cliente.enderecoCompleto || 'Endereço não informado'} {osData.cliente.complemento && `(${osData.cliente.complemento})`}
                {osData.cliente.bairro && `, ${osData.cliente.bairro}`} {osData.cliente.cidade && `- ${osData.cliente.cidade}`}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-bold uppercase text-[10px] tracking-wider text-blue-600 flex items-center gap-1.5">
                <ShieldCheck size={13} /> {osData.empresaParceira?.nome ? 'Empresa & Prestador' : 'Profissional Responsável'}
              </div>
              {osData.empresaParceira?.nome && (
                <div className="font-bold text-teal-800 text-sm flex items-center gap-1">
                  <Building2 size={13} /> {osData.empresaParceira.nome}
                </div>
              )}
              <div className="font-bold text-slate-900 text-xs">
                Técnico: {osData.profissional?.nome || 'Prestador Autorizado UAI Fix'}
              </div>
              <div className="text-slate-600">
                Especialidade: {osData.servico.categoria || osData.profissional?.especialidade || 'Geral'}
              </div>
              {osData.profissional?.telefone && (
                <div className="text-slate-600">Contato: {osData.profissional.telefone}</div>
              )}
            </div>
          </div>

          {/* Escopo do Serviço */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="font-bold text-slate-900 uppercase text-[10px] tracking-wider text-blue-600">
              Escopo & Planejamento Técnico
            </div>
            <div className="text-slate-800 font-semibold text-sm">{osData.servico.categoria}</div>
            <p className="text-slate-600 leading-relaxed">
              {osData.servico.descricaoPedido || 'Serviço executado conforme vistoria e diagnóstico técnico.'}
            </p>
            {osData.servico.recursosAlocados && osData.servico.recursosAlocados.length > 0 && (
              <div className="text-slate-600">
                <strong>Materiais/Peças:</strong> {osData.servico.recursosAlocados.join(', ')}
              </div>
            )}
          </div>

          {/* NÍVEL 1: CLIENTE FINAL */}
          {level === 'cliente' && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="font-bold text-slate-900 uppercase text-[10px] tracking-wider text-blue-600">
                Demonstrativo de Valores
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-200">
                <span className="text-slate-600">Forma de Pagamento:</span>
                <span className="font-bold text-slate-800">
                  {osData.financeiro.formaPagamento || 'PIX'} {osData.financeiro.parcelas && osData.financeiro.parcelas > 1 ? `(${osData.financeiro.parcelas}x)` : '(À vista)'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-200">
                <span className="text-slate-600">Nota Fiscal:</span>
                <span className="font-bold text-slate-800">{osData.financeiro.notaFiscal ? 'Sim' : 'Inclusa no Recibo'}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="font-bold text-slate-800 text-sm">Valor Total:</span>
                <span className="font-black text-blue-600 text-base">{formatCurrency(preco)}</span>
              </div>
            </div>
          )}

          {/* NÍVEL 2: EMPRESA PARCEIRA */}
          {level === 'parceira' && (
            <div className="p-4 rounded-xl bg-teal-50/50 border border-teal-200 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-teal-200/80 pb-2">
                <div className="font-bold text-teal-900 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <Building2 size={13} /> DRE Operacional da Parceira
                </div>
                <span className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded font-bold text-[10px]">
                  Margem: {margemParceiraPct}%
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between py-1 border-b border-teal-100 font-bold text-teal-950">
                  <span>(+) Faturamento Bruto da OS</span>
                  <span>{formatCurrency(preco)}</span>
                </div>
                <div className="flex justify-between text-slate-600 pl-2">
                  <span>(-) Mão de Obra Técnica (HH)</span>
                  <span className="text-rose-600 font-medium">- {formatCurrency(hh)}</span>
                </div>
                <div className="flex justify-between text-slate-600 pl-2">
                  <span>(-) Materiais e Peças</span>
                  <span className="text-rose-600 font-medium">- {formatCurrency(mat)}</span>
                </div>
                <div className="flex justify-between text-slate-600 pl-2">
                  <span>(-) Deslocamento / Visita</span>
                  <span className="text-rose-600 font-medium">- {formatCurrency(desloc)}</span>
                </div>
                <div className="flex justify-between py-1 border-t border-teal-100 text-slate-700 font-semibold pl-2">
                  <span>Subtotal Custos Diretos</span>
                  <span>{formatCurrency(custoDireto)}</span>
                </div>
                <div className="flex justify-between text-slate-600 pl-2">
                  <span>(-) Overhead / Custo Fixo</span>
                  <span className="text-rose-600 font-medium">- {formatCurrency(custoFixo)}</span>
                </div>
                <div className="flex justify-between text-slate-600 pl-2">
                  <span>(-) Provisão Impostos Parceira</span>
                  <span className="text-rose-600 font-medium">- {formatCurrency(imposto)}</span>
                </div>
                <div className="flex justify-between py-1 border-t border-teal-100 font-semibold text-amber-900 bg-amber-50/60 px-2 rounded">
                  <span>(-) Taxa Plataforma UAI-Fix</span>
                  <span className="font-bold text-amber-700">- {formatCurrency(taxaPlat)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-teal-200 mt-2">
                <span className="font-bold text-teal-950 text-xs">Resultado Líquido da Parceira:</span>
                <span className="font-black text-teal-700 text-base">{formatCurrency(lucroParceira)}</span>
              </div>
            </div>
          )}

          {/* NÍVEL 3: UAI-FIX MASTER */}
          {level === 'master' && (
            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                <div className="font-bold text-amber-950 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <Crown size={13} /> DRE Consolidado da Plataforma • UAI-Fix Master
                </div>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-bold text-[10px]">
                  Take-Rate: {takeRatePct}%
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between py-1 border-b border-amber-200 font-bold text-slate-900">
                  <span>(+) Receita Bruta Total do Cliente</span>
                  <span className="text-blue-700">{formatCurrency(preco)}</span>
                </div>
                <div className="flex justify-between text-slate-600 pl-2">
                  <span>(-) Custos Diretos Totais</span>
                  <span>{formatCurrency(custoDireto)}</span>
                </div>
                <div className="flex justify-between text-slate-600 pl-2">
                  <span>(-) Margem Líquida da Parceira</span>
                  <span>{formatCurrency(lucroParceira)}</span>
                </div>
                <div className="flex justify-between py-1.5 px-2 bg-amber-100/70 rounded font-bold text-amber-950">
                  <span>(+) Taxa Bruta UAI-Fix (Take-Rate)</span>
                  <span className="text-amber-800">{formatCurrency(taxaPlat)}</span>
                </div>
                <div className="flex justify-between text-slate-600 pl-2">
                  <span>(-) Gateway de Pagamento / Split</span>
                  <span className="text-rose-600 font-medium">- {formatCurrency(taxaGate)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-amber-200 mt-2">
                <div>
                  <span className="font-bold text-slate-900 text-xs block">Margem Líquida UAI-Fix:</span>
                  <span className="text-[10px] text-slate-500">Rentabilidade líquida pós-taxas de processamento</span>
                </div>
                <span className="font-black text-amber-600 text-base">{formatCurrency(margemLiquidaUaiFix)}</span>
              </div>
            </div>
          )}

          {/* Assinatura Digital / Aceite */}
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <div className="font-bold text-emerald-900">Aceite Digital e Garantia de 90 dias</div>
                <div className="text-[11px] text-emerald-700 mt-0.5">
                  Assinado por {osData.cliente.nome} {osData.assinatura?.cpfAssinante ? `(CPF ${osData.assinatura.cpfAssinante})` : ''}
                </div>
              </div>
            </div>
            {osData.assinatura?.assinaturaUrl && (
              <img
                src={osData.assinatura.assinaturaUrl}
                alt="Assinatura"
                className="max-h-10 max-w-[120px] object-contain bg-white rounded border border-emerald-200 p-1"
              />
            )}
          </div>

        </div>

        {/* Footer com Botões de Ação */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-medium">
            Imprimindo em: <strong className="text-slate-800">{level === 'master' ? 'Visão Master' : level === 'parceira' ? 'Visão Parceira' : 'Visão Cliente'}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Fechar
            </button>

            <button
              onClick={handleDownloadPdf}
              className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Download size={15} /> Baixar PDF
            </button>

            <button
              onClick={handlePrint}
              className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer ${
                level === 'master' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/25' :
                level === 'parceira' ? 'bg-teal-600 hover:bg-teal-700 shadow-teal-500/25' :
                'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25'
              }`}
            >
              <Printer size={15} /> Imprimir OS
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
