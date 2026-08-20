import React from 'react';
import { X, Printer, Download, FileText, CheckCircle2, ShieldCheck, User, Calendar, MapPin } from 'lucide-react';
import { OsPrintData, printOsDocument, downloadOsPdf, formatCurrency, formatDateBr } from '../../utils/osPrinter';

interface PrintOsModalProps {
  isOpen: boolean;
  onClose: () => void;
  osData: OsPrintData | null;
}

export const PrintOsModal: React.FC<PrintOsModalProps> = ({ isOpen, onClose, osData }) => {
  if (!isOpen || !osData) return null;

  const handlePrint = () => {
    printOsDocument(osData);
  };

  const handleDownloadPdf = () => {
    downloadOsPdf(osData);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200">
        
        {/* Header do Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm shadow-blue-500/20">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Ordem de Serviço #{osData.codigoOs}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Visualização Prévia para Impressão e PDF
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo Prévia da OS */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-slate-800">
          
          {/* Card Resumo do Cabeçalho */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black tracking-wider text-blue-600 uppercase">UAI Fix Soluções</span>
              <div className="text-lg font-black text-slate-900">OS #{osData.codigoOs}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Emissão: {osData.dataEmissao ? formatDateBr(osData.dataEmissao) : formatDateBr(new Date().toISOString())}
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-blue-600 text-white font-bold text-xs rounded-full shadow-xs">
                {osData.status || 'Concluído'}
              </span>
              <div className="text-base font-black text-blue-700 mt-1">
                {formatCurrency(osData.financeiro.precoTotal)}
              </div>
            </div>
          </div>

          {/* Grid Cliente / Profissional */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-bold text-slate-900 uppercase text-[10px] tracking-wider text-blue-600 flex items-center gap-1.5">
                <User size={13} /> Cliente
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
              <div className="font-bold text-slate-900 uppercase text-[10px] tracking-wider text-blue-600 flex items-center gap-1.5">
                <ShieldCheck size={13} /> Profissional
              </div>
              <div className="font-bold text-slate-900 text-sm">
                {osData.profissional?.nome || 'Profissional UAI Fix'}
              </div>
              <div className="text-slate-600">
                Especialidade: {osData.servico.categoria || osData.profissional?.especialidade || 'Geral'}
              </div>
              {osData.profissional?.telefone && (
                <div className="text-slate-600">Contato: {osData.profissional.telefone}</div>
              )}
              <div className="text-slate-600">
                Execução: {osData.servico.dataExecucao ? formatDateBr(osData.servico.dataExecucao) : 'Agendada'}
              </div>
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

          {/* Demonstrativo Financeiro */}
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
              <span className="font-black text-blue-600 text-base">{formatCurrency(osData.financeiro.precoTotal)}</span>
            </div>
          </div>

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
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Fechar
          </button>

          <button
            onClick={handleDownloadPdf}
            className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl flex items-center gap-2 shadow-xs transition-colors"
          >
            <Download size={15} /> Baixar PDF
          </button>

          <button
            onClick={handlePrint}
            className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl flex items-center gap-2 shadow-md shadow-blue-500/25 transition-all"
          >
            <Printer size={15} /> Imprimir OS
          </button>
        </div>

      </div>
    </div>
  );
};
