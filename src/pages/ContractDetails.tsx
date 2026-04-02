import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, query, where, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Contrato, DemandaContrato, Colaborador, DistribuicaoDemanda, TipoDemanda, PRECOS_DEMANDAS } from '../types';
import { 
  ArrowLeft, 
  DollarSign, 
  TrendingUp, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Edit2,
  Users,
  CheckCircle2,
  Clock,
  PieChart as PieIcon,
  BarChart as BarIcon
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

const ALL_DEMAND_TYPES: TipoDemanda[] = ["Gestão de Conteúdo", "Carrossel", "Captação", "Vídeo", "Criativo"];

const ContractDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contract, setContract] = useState<Contrato | null>(null);
  const [demandas, setDemandas] = useState<DemandaContrato[]>([]);
  const [distribuicoes, setDistribuicoes] = useState<DistribuicaoDemanda[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [isAddingDemanda, setIsAddingDemanda] = useState(false);
  const [isAddingDist, setIsAddingDist] = useState(false);
  const [isEditingDemanda, setIsEditingDemanda] = useState(false);
  const [isDeletingDemanda, setIsDeletingDemanda] = useState(false);
  const [newDemanda, setNewDemanda] = useState({ tipo: 'Criativo' as TipoDemanda, qtd: 0 });
  const [editingDemandaData, setEditingDemandaData] = useState<{ 
    id: string, 
    tipo: TipoDemanda, 
    qtd: number,
    dists: { id?: string, colabId: string, qtd: number, valor_total?: number }[]
  } | null>(null);
  const [demandaToDelete, setDemandaToDelete] = useState<string | null>(null);
  const [distsToDelete, setDistsToDelete] = useState<string[]>([]);
  const [newDist, setNewDist] = useState({ colabId: '', tipo: 'Criativo' as TipoDemanda, qtd: 0 });
  const [paymentValues, setPaymentValues] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (!id) return;

    const unsubContract = onSnapshot(doc(db, 'contratos', id), async (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as Contrato;
        setContract(data);
        
        let v1 = data.valor_pagamento_1q || 0;
        let v2 = data.valor_pagamento_2q || 0;
        
        // Automatic estimation: if both are 0 and there's a gross value, split it
        if (v1 === 0 && v2 === 0 && data.valor_bruto > 0) {
          const estimate = data.valor_bruto / 2;
          await updateDoc(doc(db, 'contratos', id), {
            valor_pagamento_1q: estimate,
            valor_pagamento_2q: estimate
          });
          // The next snapshot will update the state
          return;
        }

        // Initialize local payment values from Firestore
        setPaymentValues({
          valor_pagamento_1q: new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(v1),
          valor_pagamento_2q: new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(v2)
        });
      }
    });

    const unsubDemandas = onSnapshot(query(collection(db, 'demandas_contrato'), where('contrato_id', '==', id)), (snapshot) => {
      setDemandas(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DemandaContrato)));
    });

    const unsubDist = onSnapshot(query(collection(db, 'distribuicao_demandas'), where('contrato_id', '==', id)), (snapshot) => {
      setDistribuicoes(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DistribuicaoDemanda)));
    });

    const unsubColabs = onSnapshot(collection(db, 'colaboradores'), (snapshot) => {
      setColaboradores(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Colaborador)));
      setLoading(false);
    });

    return () => {
      unsubContract();
      unsubDemandas();
      unsubDist();
      unsubColabs();
    };
  }, [id]);

  const handleAddDemanda = async () => {
    if (!id || newDemanda.qtd <= 0) return;
    const dataToSave = { ...newDemanda };
    setIsAddingDemanda(false);
    setNewDemanda({ tipo: 'Criativo', qtd: 0 });

    await addDoc(collection(db, 'demandas_contrato'), {
      contrato_id: id,
      tipo_demanda: dataToSave.tipo,
      quantidade_total: dataToSave.qtd
    });
  };

  const handleUpdateDemanda = async () => {
    if (!editingDemandaData || editingDemandaData.qtd < 0) return;
    
    const dataToSave = { ...editingDemandaData };
    const distsToDeleteNow = [...distsToDelete];
    
    setIsEditingDemanda(false);
    setEditingDemandaData(null);
    setDistsToDelete([]);

    let currentDemandaId = dataToSave.id;

    // Update or Create main demand
    if (currentDemandaId.startsWith('temp-')) {
      const docRef = await addDoc(collection(db, 'demandas_contrato'), {
        contrato_id: id,
        tipo_demanda: dataToSave.tipo,
        quantidade_total: dataToSave.qtd
      });
      currentDemandaId = docRef.id;
    } else {
      await updateDoc(doc(db, 'demandas_contrato', currentDemandaId), {
        tipo_demanda: dataToSave.tipo,
        quantidade_total: dataToSave.qtd
      });
    }

    // Handle distributions
    const valorUnit = PRECOS_DEMANDAS[dataToSave.tipo];

    // 1. Delete removed distributions
    for (const distId of distsToDeleteNow) {
      await deleteDoc(doc(db, 'distribuicao_demandas', distId));
    }

    // 2. Update or Create distributions
    for (const dist of dataToSave.dists) {
      const colab = colaboradores.find(c => c.id === dist.colabId);
      const isParceria = colab?.tipo === 'Parceria';
      const finalValorTotal = isParceria ? (dist.valor_total || 0) : (dist.qtd * valorUnit);
      const finalValorUnit = isParceria ? (dist.qtd > 0 ? finalValorTotal / dist.qtd : 0) : valorUnit;

      if (dist.id) {
        // Update existing
        await updateDoc(doc(db, 'distribuicao_demandas', dist.id), {
          colaborador_id: dist.colabId,
          quantidade: dist.qtd,
          tipo_demanda: dataToSave.tipo, // Sync type if changed
          valor_unitario: finalValorUnit,
          valor_total: finalValorTotal
        });
      } else {
        // Create new
        await addDoc(collection(db, 'distribuicao_demandas'), {
          contrato_id: id,
          colaborador_id: dist.colabId,
          tipo_demanda: dataToSave.tipo,
          quantidade: dist.qtd,
          valor_unitario: finalValorUnit,
          valor_total: finalValorTotal
        });
      }
    }
  };

  const handleDeleteDemanda = async (demandaId: string) => {
    setDemandaToDelete(demandaId);
    setIsDeletingDemanda(true);
  };

  const confirmDeleteDemanda = async () => {
    if (!demandaToDelete) return;
    const idToDelete = demandaToDelete;
    setIsDeletingDemanda(false);
    setDemandaToDelete(null);

    // Delete distributions first
    const distsToDelete = distribuicoes.filter(d => d.tipo_demanda === demandas.find(dem => dem.id === idToDelete)?.tipo_demanda);
    for (const dist of distsToDelete) {
      await deleteDoc(doc(db, 'distribuicao_demandas', dist.id));
    }

    // Delete the demand
    await deleteDoc(doc(db, 'demandas_contrato', idToDelete));
  };

  const handleAddDist = async () => {
    if (!id || !newDist.colabId || newDist.qtd <= 0) return;
    const dataToSave = { ...newDist };
    setIsAddingDist(false);
    setNewDist({ colabId: '', tipo: 'Criativo', qtd: 0 });

    const valorUnit = PRECOS_DEMANDAS[dataToSave.tipo];
    await addDoc(collection(db, 'distribuicao_demandas'), {
      contrato_id: id,
      colaborador_id: dataToSave.colabId,
      tipo_demanda: dataToSave.tipo,
      quantidade: dataToSave.qtd,
      valor_unitario: valorUnit,
      valor_total: dataToSave.qtd * valorUnit
    });
  };

  const updatePaymentStatus = async (field: 'status_pagamento_1q' | 'status_pagamento_2q', status: string) => {
    if (!id) return;
    await updateDoc(doc(db, 'contratos', id), { [field]: status });
  };

  const updateDistProgress = async (distId: string, field: 'quantidade_concluida' | 'quantidade_paga', value: string) => {
    const numValue = parseInt(value) || 0;
    await updateDoc(doc(db, 'distribuicao_demandas', distId), {
      [field]: numValue
    });
  };

  const updatePaymentValue = async (field: 'valor_pagamento_1q' | 'valor_pagamento_2q') => {
    if (!id || !contract) return;
    const value = paymentValues[field];
    const numValue = Number(value.replace(/\D/g, '')) / 100;
    
    // Validation: Sum of payments cannot exceed gross value
    const otherField = field === 'valor_pagamento_1q' ? 'valor_pagamento_2q' : 'valor_pagamento_1q';
    const otherValue = Number(contract[otherField] || 0);
    
    if (numValue + otherValue > contract.valor_bruto) {
      alert(`O valor total das quinzenas (${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numValue + otherValue)}) não pode exceder o valor bruto do contrato (${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contract.valor_bruto)}).`);
      // Reset local value to Firestore value
      setPaymentValues(prev => ({
        ...prev,
        [field]: new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(contract[field] || 0)
      }));
      return;
    }

    await updateDoc(doc(db, 'contratos', id), { [field]: numValue });
  };

  const handlePaymentInputChange = (field: string, value: string) => {
    // Basic currency masking logic
    const digits = value.replace(/\D/g, '');
    const numValue = Number(digits) / 100;
    const formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(numValue);
    setPaymentValues(prev => ({ ...prev, [field]: formatted }));
  };

  const updateContractStatus = async (status: string) => {
    if (!id) return;
    await updateDoc(doc(db, 'contratos', id), { status });
  };

  if (loading || !contract) return <div>Carregando...</div>;

  const mergedDemandas = ALL_DEMAND_TYPES.map(tipo => {
    const existing = demandas.find(d => d.tipo_demanda === tipo);
    return existing || { 
      id: `temp-${tipo}`, 
      contrato_id: id!, 
      tipo_demanda: tipo, 
      quantidade_total: 0 
    } as DemandaContrato;
  });

  const totalCosts = distribuicoes.reduce((acc, d) => {
    const colab = colaboradores.find(c => c.id === d.colaborador_id);
    // Exception: "Captação" is always a cost, even for "Proprietário"
    if (colab?.tipo === 'Proprietário' && d.tipo_demanda !== 'Captação') return acc;
    // Exclude the contract's main partner from costs, as their value is already deducted from valor_bruto
    if (contract.tem_parceria && colab?.id === contract.parceiro_id) return acc;
    
    return acc + (Number(d.valor_total) || 0);
  }, 0);
  const netRevenue = (Number(contract.valor_bruto) || 0) - totalCosts;
  const margin = (Number(contract.valor_bruto) || 0) > 0 ? (netRevenue / Number(contract.valor_bruto)) * 100 : 0;
  const loss = 100 - margin;
  const isAtRisk = loss > 30;

  return (
    <div className="space-y-10 animate-fade-in">
      <button 
        onClick={() => navigate('/contracts')}
        className="flex items-center gap-2 text-zinc-500 hover:text-black transition-colors font-medium"
      >
        <ArrowLeft size={20} />
        Voltar para Contratos
      </button>

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-bold tracking-tight text-[#c11720]">{contract.nome}</h1>
            <span className="px-3 py-1 bg-zinc-100 text-zinc-600 rounded-full text-xs font-bold border border-zinc-200">
              {contract.pacote}
            </span>
          </div>
          <p className="text-zinc-500">Iniciado em {contract.created_at ? format(contract.created_at.toDate(), 'dd/MM/yyyy') : 'N/A'}</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white px-6 py-4 rounded-none border border-zinc-100 shadow-sm group">
            <p className="text-xs text-zinc-400 font-bold uppercase mb-1">Status do Contrato</p>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                contract.status === 'Ativo' ? 'bg-emerald-500' : 
                contract.status === 'Encerrado' ? 'bg-rose-500' : 'bg-zinc-400'
              }`} />
              <select 
                value={contract.status}
                onChange={(e) => updateContractStatus(e.target.value)}
                className="font-bold text-sm bg-transparent border-none p-0 focus:ring-0 cursor-pointer outline-none hover:text-indigo-600 transition-colors"
              >
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
                <option value="Encerrado">Encerrado</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6", contract.tem_parceria ? "lg:grid-cols-3 xl:grid-cols-6" : "lg:grid-cols-4")}>
        {contract.tem_parceria && (
          <>
            <div className="bg-white p-6 rounded-none border border-zinc-100 shadow-sm">
              <p className="text-zinc-500 text-sm mb-1">Valor Total</p>
              <p className="text-2xl font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contract.valor_total_cliente || 0)}</p>
            </div>
            <div className="bg-white p-6 rounded-none border border-zinc-100 shadow-sm">
              <p className="text-zinc-500 text-sm mb-1">Valor Parceiro</p>
              <p className="text-2xl font-bold text-amber-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contract.valor_parceiro || 0)}</p>
            </div>
          </>
        )}
        <div className="bg-white p-6 rounded-none border border-zinc-100 shadow-sm">
          <p className="text-zinc-500 text-sm mb-1">{contract.tem_parceria ? 'Valor Bruto (Agência)' : 'Valor Bruto'}</p>
          <p className="text-2xl font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contract.valor_bruto)}</p>
        </div>
        <div className="bg-white p-6 rounded-none border border-zinc-100 shadow-sm">
          <p className="text-zinc-500 text-sm mb-1">Perda Aceitável</p>
          <p className="text-2xl font-bold text-rose-500">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCosts)}</p>
        </div>
        <div className="bg-white p-6 rounded-none border border-zinc-100 shadow-sm">
          <p className="text-zinc-500 text-sm mb-1">Receita Líquida</p>
          <p className="text-2xl font-bold text-emerald-500">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(netRevenue)}</p>
        </div>
        <div className={`p-6 rounded-none border shadow-sm transition-colors ${margin < 75 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
          <div className="flex justify-between items-start mb-1">
            <p className="text-zinc-500 text-sm">Margem de Lucro</p>
            {margin < 75 && <AlertCircle size={18} className="text-rose-500" />}
          </div>
          <p className={`text-2xl font-bold ${margin < 75 ? 'text-rose-600' : 'text-emerald-600'}`}>{margin.toFixed(1)}%</p>
          <p className="text-[10px] font-bold uppercase mt-1 opacity-60">Perda Aceitável: {loss.toFixed(1)}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pagamentos */}
        <div className="bg-white p-8 rounded-none border border-zinc-100 shadow-sm">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-[#c11720]">
            <Clock size={20} className="text-[#c11720]" />
            Cronograma de Pagamentos
          </h3>
          <div className="space-y-6">
            {[
              { q: '1ª Quinzena', date: contract.data_pagamento_1q, status: contract.status_pagamento_1q, field: 'status_pagamento_1q', valField: 'valor_pagamento_1q', value: contract.valor_pagamento_1q },
              { q: '2ª Quinzena', date: contract.data_pagamento_2q, status: contract.status_pagamento_2q, field: 'status_pagamento_2q', valField: 'valor_pagamento_2q', value: contract.valor_pagamento_2q }
            ].map((p, i) => (
              <div key={i} className="p-4 bg-zinc-50 rounded-none border border-zinc-100">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-zinc-900">{p.q}</p>
                    <p className="text-xs text-zinc-500">{p.date ? format(parseISO(p.date), 'dd/MM/yyyy') : 'Data não definida'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select 
                      value={p.status}
                      onChange={(e) => updatePaymentStatus(p.field as any, e.target.value)}
                      className={`text-xs font-bold border rounded-none px-2 py-1 focus:ring-1 focus:ring-black outline-none ${
                        p.status === 'Pago' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        p.status === 'Atrasado' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                        'bg-amber-50 text-amber-700 border-amber-100'
                      }`}
                    >
                      <option value="Pendente">Pendente</option>
                      <option value="Pago">Pago</option>
                      <option value="Atrasado">Atrasado</option>
                    </select>
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">R$</span>
                  <input 
                    type="text"
                    placeholder="0,00"
                    value={paymentValues[p.valField] || '0,00'}
                    onChange={(e) => handlePaymentInputChange(p.valField, e.target.value)}
                    onBlur={() => updatePaymentValue(p.valField as any)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-none text-sm font-bold focus:ring-1 focus:ring-[#c11720] focus:border-[#c11720] outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resumo de Custos por Colaborador */}
        <div className="lg:col-span-2 bg-white p-8 rounded-none border border-zinc-100 shadow-sm">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-[#c11720]">
            <Users size={20} className="text-[#c11720]" />
            Demandas por Equipe
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Show main partner if exists */}
            {contract.tem_parceria && contract.parceiro_id && (
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-none flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-zinc-900">
                        {colaboradores.find(c => c.id === contract.parceiro_id)?.nome || 'Parceiro'}
                      </p>
                      <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold uppercase">Parceiro Principal</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase">
                      Repasse Direto
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-amber-700">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contract.valor_parceiro || 0)}
                    </p>
                    <p className="text-[10px] text-zinc-400 font-medium">
                      Valor Fixo
                    </p>
                  </div>
                </div>
              </div>
            )}

            {colaboradores.filter(c => distribuicoes.some(d => d.colaborador_id === c.id) && (!contract.tem_parceria || c.id !== contract.parceiro_id)).map(colab => {
              const colabDists = distribuicoes.filter(d => d.colaborador_id === colab.id);
              const totalColab = colabDists.reduce((acc, d) => acc + d.valor_total, 0);
              const isOwner = colab.tipo === 'Proprietário';
              
              return (
                <div key={colab.id} className={cn(
                  "p-4 rounded-none border flex flex-col gap-4",
                  isOwner ? "bg-emerald-50 border-emerald-100" : "bg-zinc-50 border-transparent"
                )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-zinc-900">{colab.nome}</p>
                        {isOwner && (
                          <span className="text-[8px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-bold uppercase">Proprietário</span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase">
                        {isOwner ? 'Lucro Direto' : colab.tipo === 'Parceria' ? 'Custo Parceria' : 'Perda Aceitável Equipe'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-sm font-bold", isOwner ? "text-emerald-700" : "text-zinc-900")}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalColab)}
                      </p>
                      <p className="text-[10px] text-zinc-400 font-medium">
                        {colabDists.reduce((acc, d) => acc + d.quantidade, 0)} itens totais
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-zinc-200/50 pt-3 space-y-3">
                    {colabDists.map(dist => {
                      const concluida = dist.quantidade_concluida || 0;
                      const paga = dist.quantidade_paga || 0;
                      const aPagar = (concluida - paga) * dist.valor_unitario;

                      return (
                        <div key={dist.id} className={cn(
                          "flex flex-col gap-2 p-2 rounded-sm border",
                          !isOwner && aPagar > 0 ? "bg-rose-50/50 border-rose-100" : 
                          !isOwner && concluida > 0 && aPagar === 0 ? "bg-emerald-50/50 border-emerald-100" : 
                          "bg-white/50 border-zinc-100"
                        )}>
                          <div className="flex justify-between items-center text-xs font-bold text-zinc-700">
                            <div className="flex items-center gap-2">
                              <span>{dist.tipo_demanda} ({dist.quantidade} un.)</span>
                              {!isOwner && concluida > 0 && (
                                aPagar > 0 ? (
                                  <span className="text-[8px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full uppercase">Pendente</span>
                                ) : (
                                  <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase">Pago</span>
                                )
                              )}
                            </div>
                            <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dist.valor_total)}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <label className="text-[10px] text-zinc-500 uppercase block mb-1">Concluídas</label>
                              <input 
                                type="number" 
                                max={dist.quantidade} 
                                min={0} 
                                value={concluida} 
                                onChange={(e) => updateDistProgress(dist.id, 'quantidade_concluida', e.target.value)} 
                                className="w-full text-xs p-1.5 border border-zinc-200 rounded-none focus:ring-1 focus:ring-[#c11720] outline-none font-bold" 
                              />
                            </div>
                            {!isOwner && (
                              <div className="flex-1">
                                <label className="text-[10px] text-zinc-500 uppercase block mb-1">Pagas</label>
                                <input 
                                  type="number" 
                                  max={concluida} 
                                  min={0} 
                                  value={paga} 
                                  onChange={(e) => updateDistProgress(dist.id, 'quantidade_paga', e.target.value)} 
                                  className="w-full text-xs p-1.5 border border-zinc-200 rounded-none focus:ring-1 focus:ring-[#c11720] outline-none font-bold" 
                                />
                              </div>
                            )}
                          </div>
                          {!isOwner && aPagar > 0 && (
                            <div className="text-[10px] text-right font-bold text-rose-600 mt-1">
                              A Pagar: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(aPagar)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {distribuicoes.length === 0 && (
              <p className="text-center text-zinc-400 py-10 text-sm italic col-span-full">Aguardando distribuição de demandas.</p>
            )}
          </div>
        </div>
      </div>

      {/* Demandas Totais e Distribuição */}
      <div className="bg-white p-8 rounded-none border border-zinc-100 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2 text-[#c11720]">
              <BarIcon size={20} className="text-[#c11720]" />
              Demandas e Distribuição Detalhada
            </h3>
            <p className="text-sm text-zinc-500">Gerencie o que foi contratado e quem executará cada item.</p>
          </div>
        </div>
        
        <div className="flex flex-wrap justify-center gap-6">
          {mergedDemandas.map(d => {
            const distsForType = distribuicoes.filter(dist => dist.tipo_demanda === d.tipo_demanda);
            const totalDist = distsForType.reduce((acc, dist) => acc + dist.quantidade, 0);
            const isConfigured = d.quantidade_total > 0;
            const isFullyDistributed = totalDist >= d.quantidade_total && isConfigured;

            return (
              <div key={d.id} className={cn(
                "w-full md:w-[calc(50%-12px)] xl:w-[calc(33.333%-16px)] p-5 border rounded-none space-y-4 transition-all",
                isConfigured 
                  ? "bg-white border-zinc-100 shadow-sm hover:border-zinc-200" 
                  : "bg-zinc-50/50 border-zinc-100 opacity-75"
              )}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-[#c11720] text-lg">{d.tipo_demanda}</p>
                      {!isConfigured ? (
                        <span className="bg-zinc-200 text-zinc-500 text-[10px] font-bold px-2 py-0.5 rounded-full">NÃO CONFIGURADO</span>
                      ) : isFullyDistributed ? (
                        <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-100">COMPLETO</span>
                      ) : (
                        <span className="bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-100">PENDENTE</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 font-medium">Total Contratado: <span className="text-zinc-900 font-bold">{d.quantidade_total}</span></p>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2 mb-2">
                      <button 
                        onClick={() => {
                          const currentDists = distribuicoes
                            .filter(dist => dist.tipo_demanda === d.tipo_demanda)
                            .map(dist => ({ id: dist.id, colabId: dist.colaborador_id, qtd: dist.quantidade, valor_total: dist.valor_total }));
                          
                          setEditingDemandaData({ 
                            id: d.id, 
                            tipo: d.tipo_demanda, 
                            qtd: d.quantidade_total,
                            dists: currentDists
                          });
                          setDistsToDelete([]);
                          setIsEditingDemanda(true);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-none transition-all"
                        title="Configurar Demanda"
                      >
                        <Edit2 size={14} />
                      </button>
                      {!d.id.startsWith('temp-') && (
                        <button 
                          onClick={() => handleDeleteDemanda(d.id)}
                          className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-none transition-all"
                          title="Resetar Demanda"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    {isConfigured && (
                      <>
                        <p className="text-xs text-zinc-400 font-bold uppercase mb-1">Custo Total</p>
                        <p className="text-sm font-bold text-[#c11720]">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(d.quantidade_total * PRECOS_DEMANDAS[d.tipo_demanda])}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {isConfigured && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold uppercase text-zinc-400">
                      <span>Progresso da Distribuição</span>
                      <span>{totalDist} / {d.quantidade_total}</span>
                    </div>
                    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${isFullyDistributed ? 'bg-emerald-500' : 'bg-[#c11720]'}`}
                        style={{ width: `${d.quantidade_total > 0 ? Math.min((totalDist / d.quantidade_total) * 100, 100) : 0}%` }}
                      />
                    </div>
                  </div>
                )}

                {isConfigured && (
                  <div className="bg-white rounded-none p-3 space-y-2 border border-zinc-100">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Responsáveis</p>
                    {distsForType.length > 0 ? (
                      <div className="space-y-2">
                        {distsForType.map(dist => {
                          const colab = colaboradores.find(c => c.id === dist.colaborador_id);
                          return (
                            <div key={dist.id} className="flex items-center justify-between text-xs group">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
                                <span className="text-zinc-600">{colab?.nome}</span>
                              </div>
                              <span className="font-bold text-zinc-900">{dist.quantidade} un.</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[10px] text-zinc-400 italic">Nenhum responsável alocado.</p>
                    )}
                  </div>
                )}

              </div>
            );
          })}

        </div>
      </div>

      {/* Modals */}
      {isAddingDemanda && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-none p-8 animate-slide-up">
            <h2 className="text-2xl font-bold mb-6">Adicionar Demanda</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold text-zinc-700">Tipo</label>
                <select 
                  className="w-full px-4 py-3 bg-zinc-50 border-none rounded-none mt-1"
                  value={newDemanda.tipo}
                  onChange={e => setNewDemanda({...newDemanda, tipo: e.target.value as TipoDemanda})}
                >
                  {Object.keys(PRECOS_DEMANDAS).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-zinc-700">Quantidade Total</label>
                <input 
                  type="number" 
                  className="w-full px-4 py-3 bg-zinc-50 border-none rounded-none mt-1"
                  value={newDemanda.qtd}
                  onChange={e => {
                    const val = parseInt(e.target.value);
                    setNewDemanda({...newDemanda, qtd: isNaN(val) ? 0 : val});
                  }}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setIsAddingDemanda(false)} className="flex-1 py-3 bg-zinc-100 rounded-none font-bold">Cancelar</button>
                <button onClick={handleAddDemanda} className="flex-1 py-3 bg-black text-white rounded-none font-bold">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditingDemanda && editingDemandaData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-none p-8 animate-slide-up max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">Editar Demanda e Distribuição</h2>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-zinc-700">Tipo</label>
                  <select 
                    className="w-full px-4 py-3 bg-zinc-50 border-none rounded-none mt-1"
                    value={editingDemandaData.tipo}
                    onChange={e => setEditingDemandaData({...editingDemandaData, tipo: e.target.value as TipoDemanda})}
                  >
                    {Object.keys(PRECOS_DEMANDAS).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold text-zinc-700">Quantidade Total</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-3 bg-zinc-50 border-none rounded-none mt-1"
                    value={editingDemandaData.qtd}
                    onChange={e => {
                      const val = parseInt(e.target.value);
                      setEditingDemandaData({...editingDemandaData, qtd: isNaN(val) ? 0 : val});
                    }}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-100">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-zinc-900">Distribuição da Equipe</h3>
                  <button 
                    onClick={() => setEditingDemandaData({
                      ...editingDemandaData,
                      dists: [...editingDemandaData.dists, { colabId: '', qtd: 0 }]
                    })}
                    className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:text-indigo-700"
                  >
                    <Plus size={14} />
                    Adicionar Responsável
                  </button>
                </div>

                <div className="space-y-3">
                  {editingDemandaData.dists.map((dist, index) => (
                    <div key={index} className="flex items-end gap-3 p-3 bg-zinc-50 rounded-none">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Colaborador</label>
                        <select 
                          className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-none mt-1 text-sm"
                          value={dist.colabId}
                          onChange={e => {
                            const newDists = [...editingDemandaData.dists];
                            newDists[index].colabId = e.target.value;
                            setEditingDemandaData({...editingDemandaData, dists: newDists});
                          }}
                        >
                          <option value="">Selecione...</option>
                          {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      </div>
                      <div className="w-24">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Qtd</label>
                        <input 
                          type="number" 
                          className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-none mt-1 text-sm"
                          value={dist.qtd}
                          onChange={e => {
                            const val = parseInt(e.target.value);
                            const newDists = [...editingDemandaData.dists];
                            newDists[index].qtd = isNaN(val) ? 0 : val;
                            setEditingDemandaData({...editingDemandaData, dists: newDists});
                          }}
                        />
                      </div>
                      {colaboradores.find(c => c.id === dist.colabId)?.tipo === 'Parceria' && (
                        <div className="w-32">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase">Valor (R$)</label>
                          <input 
                            type="number" 
                            step="0.01"
                            className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-none mt-1 text-sm"
                            value={dist.valor_total || ''}
                            onChange={e => {
                              const val = parseFloat(e.target.value);
                              const newDists = [...editingDemandaData.dists];
                              newDists[index].valor_total = isNaN(val) ? 0 : val;
                              setEditingDemandaData({...editingDemandaData, dists: newDists});
                            }}
                          />
                        </div>
                      )}
                      <button 
                        onClick={() => {
                          if (dist.id) {
                            setDistsToDelete([...distsToDelete, dist.id]);
                          }
                          const newDists = editingDemandaData.dists.filter((_, i) => i !== index);
                          setEditingDemandaData({...editingDemandaData, dists: newDists});
                        }}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-none transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                  {editingDemandaData.dists.length === 0 && (
                    <p className="text-center text-zinc-400 text-xs py-4 italic">Nenhum responsável atribuído.</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => { setIsEditingDemanda(false); setEditingDemandaData(null); }} className="flex-1 py-3 bg-zinc-100 rounded-none font-bold">Cancelar</button>
                <button onClick={handleUpdateDemanda} className="flex-1 py-3 bg-black text-white rounded-none font-bold">Salvar Alterações</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isDeletingDemanda && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-none p-8 animate-slide-up text-center">
            <div className="w-16 h-16 bg-[#c11720] text-white rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-xl font-bold mb-2">Excluir Demanda?</h2>
            <p className="text-zinc-500 text-sm mb-8">
              Esta ação não pode ser desfeita. Todos os dados desta demanda serão removidos permanentemente.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => { setIsDeletingDemanda(false); setDemandaToDelete(null); }} 
                className="flex-1 py-3 bg-zinc-100 rounded-none font-bold text-zinc-600 hover:bg-zinc-200 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDeleteDemanda} 
                className="flex-1 py-3 bg-[#c11720] text-white rounded-none font-bold hover:bg-red-800 transition-all"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddingDist && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-none p-8 animate-slide-up">
            <h2 className="text-2xl font-bold mb-6">Distribuir Demanda</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold text-zinc-700">Colaborador</label>
                <select 
                  className="w-full px-4 py-3 bg-zinc-50 border-none rounded-none mt-1"
                  value={newDist.colabId}
                  onChange={e => setNewDist({...newDist, colabId: e.target.value})}
                >
                  <option value="">Selecione...</option>
                  {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.tipo})</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-zinc-700">Tipo de Demanda</label>
                <select 
                  className="w-full px-4 py-3 bg-zinc-50 border-none rounded-none mt-1"
                  value={newDist.tipo}
                  onChange={e => setNewDist({...newDist, tipo: e.target.value as TipoDemanda})}
                >
                  {demandas.map(d => <option key={d.id} value={d.tipo_demanda}>{d.tipo_demanda}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-zinc-700">Quantidade</label>
                <input 
                  type="number" 
                  className="w-full px-4 py-3 bg-zinc-50 border-none rounded-none mt-1"
                  value={newDist.qtd}
                  onChange={e => {
                    const val = parseInt(e.target.value);
                    setNewDist({...newDist, qtd: isNaN(val) ? 0 : val});
                  }}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setIsAddingDist(false)} className="flex-1 py-3 bg-zinc-100 rounded-none font-bold">Cancelar</button>
                <button onClick={handleAddDist} className="flex-1 py-3 bg-black text-white rounded-none font-bold">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractDetails;
