import React, { useEffect, useMemo, useState } from 'react';
import {
    DollarSign,
    Plus,
    Trash2,
    Package,
    Calculator,
    TrendingUp,
    Percent,
    ShieldCheck,
    Wrench,
    Truck,
    Clock,
    Layers,
    ChevronDown,
    ChevronUp,
    HelpCircle,
    Sliders
} from 'lucide-react';
import { SearchableSelect } from '../SearchableSelect';
import {
    ItemMaterialOrcamento,
    ItemServicoOrcamento,
    DetalhamentoCustosOrcamento,
    PricingEngineConfig
} from '../../types';
import {
    calculatePricingEngine,
    DEFAULT_PRICING_CONFIG
} from '../../utils/pricingEngine';

interface BudgetSectionProps {
    formData: any;
    setFormData: React.Dispatch<React.SetStateAction<any>> | ((data: any) => void);
    showBudgetForm: boolean;
    isReadOnly?: boolean;
}

const BudgetSection: React.FC<BudgetSectionProps> = ({
    formData,
    setFormData,
    showBudgetForm,
    isReadOnly = false
}) => {
    if (!(showBudgetForm && formData.status !== 'pendente')) return null;

    const [showAdvancedParameters, setShowAdvancedParameters] = useState(false);

    // Listas de Itens
    const itensMateriais: ItemMaterialOrcamento[] = Array.isArray(formData.orcamentoItensMateriais)
        ? formData.orcamentoItensMateriais
        : [];

    const itensServicos: ItemServicoOrcamento[] = Array.isArray(formData.orcamentoItensServicos)
        ? formData.orcamentoItensServicos
        : [];

    // Handlers para Materiais
    const handleAddMaterial = () => {
        const newItem: ItemMaterialOrcamento = {
            id: `mat-${Date.now()}`,
            nome: '',
            quantidade: 1,
            valor_unitario: 0,
            valor_total: 0
        };
        const updated = [...itensMateriais, newItem];
        updateMateriais(updated);
    };

    const handleRemoveMaterial = (index: number) => {
        const updated = itensMateriais.filter((_, i) => i !== index);
        updateMateriais(updated);
    };

    const handleMaterialChange = (index: number, field: keyof ItemMaterialOrcamento, value: any) => {
        const updated = [...itensMateriais];
        const current = { ...updated[index] };

        if (field === 'quantidade') {
            const qtd = Math.max(0, parseFloat(value) || 0);
            current.quantidade = qtd;
            current.valor_total = +(qtd * (current.valor_unitario || 0)).toFixed(2);
        } else if (field === 'valor_unitario') {
            const unit = Math.max(0, parseFloat(value) || 0);
            current.valor_unitario = unit;
            current.valor_total = +((current.quantidade || 0) * unit).toFixed(2);
        } else if (field === 'nome') {
            current.nome = value;
        }

        updated[index] = current;
        updateMateriais(updated);
    };

    const updateMateriais = (updatedItens: ItemMaterialOrcamento[]) => {
        const totalVariavel = updatedItens.reduce((acc, item) => acc + (item.valor_total || 0), 0);
        setFormData((prev: any) => ({
            ...prev,
            orcamentoItensMateriais: updatedItens,
            orcamentoCustoVariavel: +totalVariavel.toFixed(2)
        }));
    };

    // Handlers para Serviços / Mão de Obra
    const handleAddServico = () => {
        const newServico: ItemServicoOrcamento = {
            id: `srv-${Date.now()}`,
            nome: '',
            horas: 1,
            valor_hora: DEFAULT_PRICING_CONFIG.custo_hora_base,
            valor_total: DEFAULT_PRICING_CONFIG.custo_hora_base
        };
        const updated = [...itensServicos, newServico];
        updateServicos(updated);
    };

    const handleRemoveServico = (index: number) => {
        const updated = itensServicos.filter((_, i) => i !== index);
        updateServicos(updated);
    };

    const handleServicoChange = (index: number, field: keyof ItemServicoOrcamento, value: any) => {
        const updated = [...itensServicos];
        const current = { ...updated[index] };

        if (field === 'horas') {
            const h = Math.max(0, parseFloat(value) || 0);
            current.horas = h;
            current.valor_total = +(h * (current.valor_hora || 0)).toFixed(2);
        } else if (field === 'valor_hora') {
            const vh = Math.max(0, parseFloat(value) || 0);
            current.valor_hora = vh;
            current.valor_total = +((current.horas || 0) * vh).toFixed(2);
        } else if (field === 'nome') {
            current.nome = value;
        }

        updated[index] = current;
        updateServicos(updated);
    };

    const updateServicos = (updatedItens: ItemServicoOrcamento[]) => {
        const totalHH = updatedItens.reduce((acc, item) => acc + (item.valor_total || 0), 0);
        setFormData((prev: any) => ({
            ...prev,
            orcamentoItensServicos: updatedItens,
            orcamentoHH: +totalHH.toFixed(2)
        }));
    };

    // Handlers para Logística e Deslocamento
    const handleDistanciaChange = (val: string) => {
        const parsed = val === '' ? 0 : Math.max(0, parseFloat(val) || 0);
        const custoKm = formData.orcamentoCustoKmUnitario !== undefined
            ? (parseFloat(formData.orcamentoCustoKmUnitario) || 0)
            : DEFAULT_PRICING_CONFIG.custo_km_padrao;
        const totalCalculado = +(parsed * custoKm).toFixed(2);

        setFormData((prev: any) => ({
            ...prev,
            orcamentoDistanciaKm: parsed,
            orcamentoDeslocamento: totalCalculado
        }));
    };

    const handleCustoKmChange = (val: string) => {
        const parsed = val === '' ? 0 : Math.max(0, parseFloat(val) || 0);
        const dist = parseFloat(formData.orcamentoDistanciaKm) || 0;
        const totalCalculado = +(dist * parsed).toFixed(2);

        setFormData((prev: any) => ({
            ...prev,
            orcamentoCustoKmUnitario: parsed,
            orcamentoDeslocamento: totalCalculado
        }));
    };

    const handleTotalDeslocamentoChange = (val: string) => {
        const parsed = val === '' ? 0 : Math.max(0, parseFloat(val) || 0);
        setFormData((prev: any) => ({
            ...prev,
            orcamentoDeslocamento: parsed
        }));
    };

    // Distância e Km
    const distanciaKm = parseFloat(formData.orcamentoDistanciaKm) || 0;
    const custoKmUnitario = formData.orcamentoCustoKmUnitario !== undefined
        ? (parseFloat(formData.orcamentoCustoKmUnitario) || 0)
        : DEFAULT_PRICING_CONFIG.custo_km_padrao;

    // Percentuais operacionais e fiscais
    const taxaFerramentasPct = formData.orcamentoTaxaFerramentas !== undefined ? parseFloat(formData.orcamentoTaxaFerramentas) : DEFAULT_PRICING_CONFIG.taxa_ferramental_padrao_pct;
    const taxaSeguroPct = formData.orcamentoTaxaSeguro !== undefined ? parseFloat(formData.orcamentoTaxaSeguro) : DEFAULT_PRICING_CONFIG.taxa_seguro_padrao_pct;
    const taxaOverheadPct = formData.orcamentoTaxaOverhead !== undefined ? parseFloat(formData.orcamentoTaxaOverhead) : DEFAULT_PRICING_CONFIG.taxa_overhead_padrao_pct;
    const taxaPlataformaPct = formData.orcamentoTaxaPlataformaPct !== undefined ? parseFloat(formData.orcamentoTaxaPlataformaPct) : DEFAULT_PRICING_CONFIG.taxa_plataforma_padrao_pct;
    const taxaGatewayPct = formData.orcamentoTaxaGatewayPct !== undefined ? parseFloat(formData.orcamentoTaxaGatewayPct) : DEFAULT_PRICING_CONFIG.taxa_gateway_padrao_pct;
    const margemLucroPct = formData.orcamentoMargemLucroPct !== undefined ? parseFloat(formData.orcamentoMargemLucroPct) : DEFAULT_PRICING_CONFIG.margem_lucro_padrao_pct;
    const impostoPct = formData.orcamentoImposto !== undefined ? parseFloat(formData.orcamentoImposto) : DEFAULT_PRICING_CONFIG.aliquota_imposto_padrao_pct;

    // Executa o cálculo analítico através do motor puro
    const dre: DetalhamentoCustosOrcamento = useMemo(() => {
        const input = {
            itens_materiais: itensMateriais,
            itens_servicos: itensServicos,
            distancia_km: distanciaKm,
            custo_km_unitario: custoKmUnitario,
            override_custo_deslocamento: distanciaKm > 0
                ? (distanciaKm * custoKmUnitario)
                : (formData.orcamentoDeslocamento !== undefined ? parseFloat(formData.orcamentoDeslocamento) : undefined),
            override_custo_mao_de_obra: itensServicos.length === 0 && formData.orcamentoHH ? parseFloat(formData.orcamentoHH) : undefined,
            override_custo_ferramentas: formData.orcamentoCustoFerramentas ? parseFloat(formData.orcamentoCustoFerramentas) : undefined,
            override_custo_seguro: formData.orcamentoCustoSeguro ? parseFloat(formData.orcamentoCustoSeguro) : undefined,
            override_custo_overhead: formData.orcamentoCustoOverhead ? parseFloat(formData.orcamentoCustoOverhead) : undefined,
            override_custo_fixo_manual: formData.orcamentoCusto ? parseFloat(formData.orcamentoCusto) : undefined,
            taxa_ferramental_pct: taxaFerramentasPct,
            taxa_seguro_pct: taxaSeguroPct,
            taxa_overhead_pct: taxaOverheadPct,
            margem_lucro_pct: margemLucroPct,
            taxa_plataforma_pct: taxaPlataformaPct,
            override_taxa_plataforma: formData.orcamentoTaxaPlataforma ? parseFloat(formData.orcamentoTaxaPlataforma) : undefined,
            taxa_gateway_pct: taxaGatewayPct,
            override_taxa_pagamento: formData.orcamentoTaxaPagamento ? parseFloat(formData.orcamentoTaxaPagamento) : undefined,
            aliquota_imposto_pct: impostoPct
        };

        return calculatePricingEngine(input);
    }, [
        itensMateriais,
        itensServicos,
        distanciaKm,
        custoKmUnitario,
        formData.orcamentoDeslocamento,
        formData.orcamentoHH,
        formData.orcamentoCustoFerramentas,
        formData.orcamentoCustoSeguro,
        formData.orcamentoCustoOverhead,
        formData.orcamentoCusto,
        formData.orcamentoMargemLucroPct,
        formData.orcamentoTaxaPlataforma,
        formData.orcamentoTaxaPagamento,
        taxaFerramentasPct,
        taxaSeguroPct,
        taxaOverheadPct,
        margemLucroPct,
        taxaPlataformaPct,
        taxaGatewayPct,
        impostoPct
    ]);

    // Sincroniza o preço final e os consolidados no formData
    useEffect(() => {
        if (isReadOnly) return;
        setFormData((prev: any) => {
            // Evita loops infinitos verificando se os valores mudaram
            if (
                prev.orcamentoPreco === dre.preco_final_venda &&
                prev.orcamentoCustoVariavel === dre.total_materiais &&
                prev.orcamentoCusto === dre.custo_overhead_fixo &&
                prev.orcamentoLucro === dre.lucro_margem_valor &&
                prev.orcamentoDeslocamento === dre.total_deslocamento
            ) {
                return prev;
            }
            return {
                ...prev,
                orcamentoPreco: dre.preco_final_venda,
                orcamentoCustoVariavel: dre.total_materiais,
                orcamentoCusto: dre.custo_overhead_fixo,
                orcamentoLucro: dre.lucro_margem_valor,
                orcamentoDeslocamento: dre.total_deslocamento,
                orcamentoTaxaPlataforma: dre.taxa_plataforma_valor,
                orcamentoTaxaPagamento: dre.taxa_gateway_valor,
                orcamentoDetalhamentoCustos: dre
            };
        });
    }, [dre, isReadOnly, setFormData]);

    return (
        <div className="bg-slate-50/90 p-6 sm:p-8 rounded-[2.5rem] border border-slate-200 space-y-7 shadow-xs">
            {/* Header com badge de status */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-100/90 rounded-2xl text-emerald-800 shadow-xs">
                        <Calculator size={22} />
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">Motor de Precificação Contratual</h4>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Apropriação analítica de custos diretos, fixos, ferramentas, RH, taxas e formação de preço
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowAdvancedParameters(!showAdvancedParameters)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-2xs"
                    >
                        <Sliders size={14} className="text-indigo-600" />
                        <span>{showAdvancedParameters ? 'Ocultar Parâmetros' : 'Parâmetros Globais'}</span>
                        {showAdvancedParameters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <span className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${dre.preco_final_venda > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {dre.preco_final_venda > 0 ? 'Orçamento Calculado' : 'Pendente de Cálculo'}
                    </span>
                </div>
            </div>

            {/* PAINEL OPCIONAL: PARÂMETROS GLOBAIS DE RATEIO */}
            {showAdvancedParameters && (
                <div className="bg-indigo-50/70 p-5 rounded-2xl border border-indigo-100 space-y-4 transition-all">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-indigo-900">
                            <Sliders size={16} />
                            <h5 className="text-xs font-black uppercase tracking-wider">Ajuste de Alíquotas e Multiplicadores Operacionais</h5>
                        </div>
                        <span className="text-[11px] text-indigo-700 font-medium">Aplicado diretamente sobre este chamado</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="bg-white p-3 rounded-xl border border-indigo-100 space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Deprec. Ferramentas (%)</label>
                            <input
                                type="number"
                                step="0.5"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                                value={taxaFerramentasPct}
                                onChange={e => setFormData((prev: any) => ({ ...prev, orcamentoTaxaFerramentas: parseFloat(e.target.value) || 0 }))}
                                disabled={isReadOnly}
                            />
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-indigo-100 space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Seguro/Garantia (%)</label>
                            <input
                                type="number"
                                step="0.5"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                                value={taxaSeguroPct}
                                onChange={e => setFormData((prev: any) => ({ ...prev, orcamentoTaxaSeguro: parseFloat(e.target.value) || 0 }))}
                                disabled={isReadOnly}
                            />
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-indigo-100 space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Estrutura/Overhead (%)</label>
                            <input
                                type="number"
                                step="0.5"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                                value={taxaOverheadPct}
                                onChange={e => setFormData((prev: any) => ({ ...prev, orcamentoTaxaOverhead: parseFloat(e.target.value) || 0 }))}
                                disabled={isReadOnly}
                            />
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-indigo-100 space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Margem Lucro (%)</label>
                            <input
                                type="number"
                                step="1"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                                value={margemLucroPct}
                                onChange={e => setFormData((prev: any) => ({ ...prev, orcamentoMargemLucroPct: parseFloat(e.target.value) || 0 }))}
                                disabled={isReadOnly}
                            />
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-indigo-100 space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Taxa Plataforma (%)</label>
                            <input
                                type="number"
                                step="0.5"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                                value={taxaPlataformaPct}
                                onChange={e => setFormData((prev: any) => ({ ...prev, orcamentoTaxaPlataformaPct: parseFloat(e.target.value) || 0 }))}
                                disabled={isReadOnly}
                            />
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-indigo-100 space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Taxa Gateway (%)</label>
                            <input
                                type="number"
                                step="0.1"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                                value={taxaGatewayPct}
                                onChange={e => setFormData((prev: any) => ({ ...prev, orcamentoTaxaGatewayPct: parseFloat(e.target.value) || 0 }))}
                                disabled={isReadOnly}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* 1. SEÇÃO: SERVIÇOS & MÃO DE OBRA (RH TÉCNICO) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-5 shadow-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                            <Clock size={18} />
                        </div>
                        <div>
                            <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">Mão de Obra & Serviços (RH Técnico)</h5>
                            <p className="text-[11px] text-slate-400 font-medium">Especifique as etapas de execução, horas de dedicação e valor/hora</p>
                        </div>
                    </div>
                    {!isReadOnly && (
                        <button
                            type="button"
                            onClick={handleAddServico}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-all shadow-2xs"
                        >
                            <Plus size={15} />
                            <span>Adicionar Serviço / Etapa</span>
                        </button>
                    )}
                </div>

                {itensServicos.length === 0 ? (
                    <div className="py-5 px-4 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/60 space-y-2">
                        <p className="text-xs text-slate-500 font-medium">
                            Nenhuma etapa discriminada. Você pode detalhar os serviços acima ou preencher o valor total de HH diretamente:
                        </p>
                        <div className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                            <span className="text-xs font-bold text-slate-600">Mão de Obra Geral (R$):</span>
                            <input
                                type="number"
                                step="0.01"
                                className="w-28 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-black text-slate-800 text-right outline-none focus:border-blue-500"
                                value={formData.orcamentoHH || 0}
                                onChange={e => setFormData((prev: any) => ({ ...prev, orcamentoHH: parseFloat(e.target.value) || 0 }))}
                                disabled={isReadOnly}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="grid grid-cols-12 gap-3 px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            <span className="col-span-5">Descrição da Etapa / Tarefa</span>
                            <span className="col-span-2 text-center">Horas Estimadas</span>
                            <span className="col-span-2 text-right">Valor / Hora (R$)</span>
                            <span className="col-span-2 text-right">Subtotal Mão de Obra</span>
                            <span className="col-span-1 text-center">Ações</span>
                        </div>

                        {itensServicos.map((item, idx) => (
                            <div key={item.id || idx} className="grid grid-cols-12 gap-3 items-center bg-slate-50/70 hover:bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 transition-colors">
                                <input
                                    type="text"
                                    placeholder="Ex: Instalação e Teste Hidráulico"
                                    className="col-span-5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-400 disabled:opacity-50"
                                    value={item.nome}
                                    onChange={e => handleServicoChange(idx, 'nome', e.target.value)}
                                    disabled={isReadOnly}
                                />
                                <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    placeholder="1"
                                    className="col-span-2 bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 text-center outline-none focus:border-blue-400 disabled:opacity-50"
                                    value={item.horas}
                                    onChange={e => handleServicoChange(idx, 'horas', e.target.value)}
                                    disabled={isReadOnly}
                                />
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    placeholder="60,00"
                                    className="col-span-2 bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 text-right outline-none focus:border-blue-400 disabled:opacity-50"
                                    value={item.valor_hora}
                                    onChange={e => handleServicoChange(idx, 'valor_hora', e.target.value)}
                                    disabled={isReadOnly}
                                />
                                <span className="col-span-2 text-right font-black text-xs text-blue-900 pr-1">
                                    R$ {(item.valor_total || 0).toFixed(2)}
                                </span>
                                <div className="col-span-1 flex justify-center">
                                    {!isReadOnly && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveServico(idx)}
                                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                            title="Remover serviço"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        <div className="flex justify-between items-center pt-3 px-2 border-t border-slate-100">
                            <span className="text-xs text-slate-500 font-medium">
                                Total de Horas: <strong>{dre.total_horas_servico}h</strong>
                            </span>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-400 uppercase">Subtotal Mão de Obra:</span>
                                <span className="text-base font-black text-blue-600">R$ {dre.total_mao_de_obra_rh.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 2. SEÇÃO: MATERIAIS & PEÇAS (CUSTO VARIÁVEL) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-5 shadow-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                            <Package size={18} />
                        </div>
                        <div>
                            <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">Materiais & Insumos (Custo Variável)</h5>
                            <p className="text-[11px] text-slate-400 font-medium">Discrimine cada peça ou material necessário para a execução</p>
                        </div>
                    </div>
                    {!isReadOnly && (
                        <button
                            type="button"
                            onClick={handleAddMaterial}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all shadow-2xs"
                        >
                            <Plus size={15} />
                            <span>Adicionar Peça / Material</span>
                        </button>
                    )}
                </div>

                {itensMateriais.length === 0 ? (
                    <div className="py-5 text-center border-2 border-dashed border-slate-200/80 rounded-2xl bg-slate-50/50">
                        <p className="text-xs text-slate-400 font-medium">Nenhum material/peça inserido. Se houver materiais, adicione pelo botão acima.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="grid grid-cols-12 gap-3 px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            <span className="col-span-5">Descrição do Item / Peça</span>
                            <span className="col-span-2 text-center">Quantidade</span>
                            <span className="col-span-2 text-right">Unitário (R$)</span>
                            <span className="col-span-2 text-right">Subtotal</span>
                            <span className="col-span-1 text-center">Ações</span>
                        </div>

                        {itensMateriais.map((item, idx) => (
                            <div key={item.id || idx} className="grid grid-cols-12 gap-3 items-center bg-slate-50/70 hover:bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 transition-colors">
                                <input
                                    type="text"
                                    placeholder="Ex: Válvula de Retenção 3/4"
                                    className="col-span-5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-400 disabled:opacity-50"
                                    value={item.nome}
                                    onChange={e => handleMaterialChange(idx, 'nome', e.target.value)}
                                    disabled={isReadOnly}
                                />
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    placeholder="1"
                                    className="col-span-2 bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 text-center outline-none focus:border-indigo-400 disabled:opacity-50"
                                    value={item.quantidade}
                                    onChange={e => handleMaterialChange(idx, 'quantidade', e.target.value)}
                                    disabled={isReadOnly}
                                />
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0,00"
                                    className="col-span-2 bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 text-right outline-none focus:border-indigo-400 disabled:opacity-50"
                                    value={item.valor_unitario}
                                    onChange={e => handleMaterialChange(idx, 'valor_unitario', e.target.value)}
                                    disabled={isReadOnly}
                                />
                                <span className="col-span-2 text-right font-black text-xs text-indigo-900 pr-1">
                                    R$ {(item.valor_total || 0).toFixed(2)}
                                </span>
                                <div className="col-span-1 flex justify-center">
                                    {!isReadOnly && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveMaterial(idx)}
                                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                            title="Remover material"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        <div className="flex justify-end pt-3 pr-2 border-t border-slate-100">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-400 uppercase">Subtotal dos Materiais:</span>
                                <span className="text-base font-black text-indigo-600">R$ {dre.total_materiais.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 3. SEÇÃO: LOGÍSTICA & DESLOCAMENTO */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                        <Truck size={18} />
                    </div>
                    <div>
                        <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">Logística, Localização & Deslocamento</h5>
                        <p className="text-[11px] text-slate-400 font-medium">Cálculo paramétrico por quilômetro percorrido ou taxa fixa de visita</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider ml-0.5">Distância Estimada (Km)</label>
                        <input
                            type="number"
                            step="0.5"
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm font-bold text-slate-900 outline-none focus:border-amber-500 focus:bg-white transition-all disabled:opacity-50"
                            placeholder="Ex: 15"
                            value={formData.orcamentoDistanciaKm !== undefined ? formData.orcamentoDistanciaKm : ''}
                            onChange={e => handleDistanciaChange(e.target.value)}
                            disabled={isReadOnly}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider ml-0.5">Custo por Km (R$/Km)</label>
                        <input
                            type="number"
                            step="0.10"
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm font-bold text-slate-900 outline-none focus:border-amber-500 focus:bg-white transition-all disabled:opacity-50"
                            value={formData.orcamentoCustoKmUnitario !== undefined ? formData.orcamentoCustoKmUnitario : DEFAULT_PRICING_CONFIG.custo_km_padrao}
                            onChange={e => handleCustoKmChange(e.target.value)}
                            disabled={isReadOnly}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider ml-0.5">Total Deslocamento (R$)</label>
                        <input
                            type="number"
                            step="0.01"
                            className="w-full bg-amber-50/50 border border-amber-200 rounded-2xl p-3 text-sm font-black text-amber-900 outline-none focus:border-amber-500 focus:bg-white transition-all disabled:opacity-50"
                            value={dre.total_deslocamento}
                            onChange={e => handleTotalDeslocamentoChange(e.target.value)}
                            disabled={isReadOnly}
                        />
                    </div>
                </div>
            </div>

            {/* 4. SEÇÃO: CUSTOS FIXOS, FERRAMENTAL, SEGURO E OVERHEAD */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                        <Layers size={18} />
                    </div>
                    <div>
                        <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">Custos Fixos & Indiretos Automatizados</h5>
                        <p className="text-[11px] text-slate-400 font-medium">Apropriação proporcional de ferramental, seguros e estrutura administrativa</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Ferramentas */}
                    <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Ferramental & Maquinário</span>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">{taxaFerramentasPct}% HH</span>
                        </div>
                        <p className="text-base font-black text-slate-800">R$ {dre.custo_ferramentas.toFixed(2)}</p>
                        <p className="text-[10px] text-slate-400">Depreciação, manutenção e desgaste</p>
                    </div>

                    {/* Seguro e Garantia */}
                    <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Seguro & Garantia Técnica</span>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">{taxaSeguroPct}% Dir</span>
                        </div>
                        <p className="text-base font-black text-slate-800">R$ {dre.custo_seguro_garantia.toFixed(2)}</p>
                        <p className="text-[10px] text-slate-400">Reserva de contingência contratual</p>
                    </div>

                    {/* Estrutura Fixa / Overhead */}
                    <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Overhead / Custo Fixo</span>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">{taxaOverheadPct}%</span>
                        </div>
                        <p className="text-base font-black text-slate-800">R$ {dre.custo_overhead_fixo.toFixed(2)}</p>
                        <p className="text-[10px] text-slate-400">Rateio de infraestrutura e gestão</p>
                    </div>
                </div>
            </div>

            {/* 5. SEÇÃO: TRIBUTAÇÃO E ALÍQUOTAS */}
            <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-200/80 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
                        <Percent size={20} />
                    </div>
                    <div>
                        <label className="text-xs font-black text-amber-950 uppercase tracking-wider block">Alíquota de Imposto / Tributação Municipal & Federal</label>
                        <p className="text-[11px] text-amber-800 font-medium">Calculado sobre a receita base antes dos impostos</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        step="0.1"
                        className="w-24 bg-white border border-amber-300 rounded-xl p-2.5 text-sm font-black text-amber-950 text-right outline-none focus:border-amber-500 disabled:opacity-50"
                        value={impostoPct}
                        onChange={e => setFormData((prev: any) => ({ ...prev, orcamentoImposto: parseFloat(e.target.value) || 0 }))}
                        disabled={isReadOnly}
                    />
                    <span className="text-sm font-black text-amber-900">%</span>
                </div>
            </div>

            {/* 6. DRE / DEMONSTRATIVO DE FORMAÇÃO DO PREÇO DA OS */}
            <div className="bg-gradient-to-br from-emerald-50 via-teal-50/40 to-emerald-50/70 p-6 sm:p-7 rounded-[2rem] border border-emerald-200 space-y-5 shadow-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-emerald-950">
                        <ShieldCheck size={20} />
                        <span className="text-xs font-black uppercase tracking-wider">DRE & Auditoria Financeira da OS</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/90 border border-emerald-300/80 px-3 py-1.5 rounded-xl shadow-2xs">
                        <label className="text-xs font-bold text-emerald-900 whitespace-nowrap">Margem Líquida:</label>
                        <div className="flex items-center">
                            <input
                                type="number"
                                step="1"
                                className="w-14 text-xs font-black text-emerald-900 text-right outline-none bg-transparent"
                                value={margemLucroPct}
                                onChange={e => setFormData((prev: any) => ({ ...prev, orcamentoMargemLucroPct: parseFloat(e.target.value) || 0 }))}
                                disabled={isReadOnly}
                            />
                            <span className="text-xs font-black text-emerald-900 ml-0.5">%</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
                    <div className="bg-white/95 p-3.5 rounded-2xl border border-emerald-100 shadow-2xs">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">1. Custos Diretos</p>
                        <p className="text-sm font-black text-slate-800 mt-1">R$ {dre.subtotal_custos_diretos.toFixed(2)}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">Mat + RH + Desloc</p>
                    </div>

                    <div className="bg-white/95 p-3.5 rounded-2xl border border-emerald-100 shadow-2xs">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">2. Custos Fixos</p>
                        <p className="text-sm font-black text-slate-800 mt-1">R$ {dre.subtotal_custos_indiretos.toFixed(2)}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">Ferram + Seg + Over</p>
                    </div>

                    <div className="bg-white/95 p-3.5 rounded-2xl border border-emerald-100 shadow-2xs">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">3. Custo Operac.</p>
                        <p className="text-sm font-black text-slate-900 mt-1">R$ {dre.custo_operacional_total.toFixed(2)}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">Direto + Indireto</p>
                    </div>

                    <div className="bg-white/95 p-3.5 rounded-2xl border border-emerald-100 shadow-2xs">
                        <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">4. Lucro Líquido</p>
                        <p className="text-sm font-black text-emerald-700 mt-1">R$ {dre.lucro_margem_valor.toFixed(2)}</p>
                        <p className="text-[9px] text-emerald-600/70 mt-0.5">Margem {margemLucroPct}%</p>
                    </div>

                    <div className="bg-white/95 p-3.5 rounded-2xl border border-emerald-100 shadow-2xs">
                        <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">5. Taxas / Interm.</p>
                        <p className="text-sm font-black text-indigo-800 mt-1">R$ {(dre.taxa_plataforma_valor + dre.taxa_gateway_valor).toFixed(2)}</p>
                        <p className="text-[9px] text-indigo-600/70 mt-0.5">Plataforma + Gateway</p>
                    </div>

                    <div className="bg-white/95 p-3.5 rounded-2xl border border-emerald-100 shadow-2xs">
                        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">6. Imposto ({impostoPct}%)</p>
                        <p className="text-sm font-black text-amber-800 mt-1">+ R$ {dre.valor_imposto.toFixed(2)}</p>
                        <p className="text-[9px] text-amber-700/70 mt-0.5">Tributo sobre subtotal</p>
                    </div>
                </div>

                <div className="pt-4 border-t border-emerald-200 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <span className="text-xs font-black text-emerald-950 uppercase tracking-widest block">Preço Final Sugerido da OS:</span>
                        <span className="text-xs text-slate-600 font-medium">
                            Custo Total (R$ {dre.custo_operacional_total.toFixed(2)}) + Lucro (R$ {dre.lucro_margem_valor.toFixed(2)}) + Taxas (R$ {(dre.taxa_plataforma_valor + dre.taxa_gateway_valor).toFixed(2)}) + Imposto (R$ {dre.valor_imposto.toFixed(2)})
                        </span>
                    </div>
                    <div className="text-right">
                        <span className="text-3xl font-black text-emerald-900 tracking-tight">R$ {dre.preco_final_venda.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* 7. SEÇÃO: SUGESTÃO DE PAGAMENTO DIFERENCIADA */}
            <div className="pt-2 border-t border-slate-200 space-y-4">
                <div className="flex items-center gap-2">
                    <DollarSign size={16} className="text-slate-600" />
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Sugestão de Pagamento Diferenciada</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-0.5">Forma de Pagamento</label>
                        <SearchableSelect
                            options={[
                                { value: '', label: 'Nenhuma sugestão' },
                                { value: 'Dinheiro', label: 'Dinheiro' },
                                { value: 'PIX', label: 'PIX' },
                                { value: 'Cartão de Crédito', label: 'Cartão de Crédito' },
                                { value: 'Cartão de Débito', label: 'Cartão de Débito' },
                            ]}
                            value={formData.orcamentoTipoPgtoSugerido}
                            onChange={(val) => setFormData((prev: any) => ({
                                ...prev,
                                orcamentoTipoPgtoSugerido: val,
                                orcamentoParcelasSugerido: 1
                            }))}
                            disabled={isReadOnly}
                            placeholder="Selecione..."
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-0.5">Parcelas</label>
                        <SearchableSelect
                            options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => ({
                                value: n,
                                label: `${n}x`
                            }))}
                            value={formData.orcamentoParcelasSugerido}
                            onChange={(val) => setFormData((prev: any) => ({ ...prev, orcamentoParcelasSugerido: parseInt(val) || 1 }))}
                            disabled={isReadOnly || formData.orcamentoTipoPgtoSugerido !== 'Cartão de Crédito'}
                            placeholder="Selecione..."
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-0.5">Desconto Sugerido (%)</label>
                        <input
                            type="number"
                            step="0.1"
                            className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-400 disabled:opacity-50"
                            placeholder="Ex: 5.0"
                            value={formData.orcamentoDescontoSugerido}
                            onChange={e => setFormData((prev: any) => ({ ...prev, orcamentoDescontoSugerido: parseFloat(e.target.value) || 0 }))}
                            disabled={isReadOnly}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-0.5">Justificativa da Sugestão</label>
                    <textarea
                        className="w-full bg-white border border-slate-200 rounded-2xl p-3.5 text-xs font-medium text-slate-900 outline-none min-h-[75px] focus:border-indigo-400 disabled:opacity-50"
                        placeholder="Explique a razão da sugestão de pagamento ou condição especial..."
                        value={formData.orcamentoJustificativaSugerido}
                        onChange={e => setFormData((prev: any) => ({ ...prev, orcamentoJustificativaSugerido: e.target.value }))}
                        disabled={isReadOnly}
                    />
                </div>
            </div>
        </div>
    );
};

export default BudgetSection;
