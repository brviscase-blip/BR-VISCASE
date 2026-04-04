import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Contrato, Pacote, StatusContrato, StatusPagamento, DemandaContrato, DistribuicaoDemanda, Colaborador } from '../types';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Eye, 
  Edit2, 
  Trash2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  FileText,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, isAfter, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    "Ativo": "bg-emerald-50 text-emerald-700 border-emerald-100",
    "Inativo": "bg-zinc-100 text-zinc-600 border-zinc-200",
    "Encerrado": "bg-rose-50 text-rose-700 border-rose-100",
    "Pago": "bg-emerald-50 text-emerald-700 border-emerald-100",
    "Pendente": "bg-amber-50 text-amber-700 border-amber-100",
    "Atrasado": "bg-rose-50 text-rose-700 border-rose-100",
  };

  return (
    <span className={cn(
      "px-3 py-1 rounded-full text-xs font-bold border",
      styles[status] || "bg-zinc-100 text-zinc-600"
    )}>
      {status}
    </span>
  );
};

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

const Contracts = () => {
  const [contracts, setContracts] = useState<Contrato[]>([]);
  const [demandas, setDemandas] = useState<DemandaContrato[]>([]);
  const [distribuicoes, setDistribuicoes] = useState<DistribuicaoDemanda[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<Contrato | null>(null);
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    pacote: 'Starter' as Pacote,
    valor_total_cliente: 0,
    valor_bruto: 0,
    tem_parceria: false,
    parceiro_id: '',
    valor_parceiro: 0,
    data_pagamento_1q: '',
    data_pagamento_2q: '',
  });

  useEffect(() => {
    const q = query(collection(db, 'contratos'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data() as Contrato;
        // Auto-calculate status based on dates
        let status1 = d.status_pagamento_1q;
        let status2 = d.status_pagamento_2q;
        const today = new Date();

        if (d.data_pagamento_1q && isAfter(today, parseISO(d.data_pagamento_1q)) && status1 === 'Pendente') {
          status1 = 'Atrasado';
        }
        if (d.data_pagamento_2q && isAfter(today, parseISO(d.data_pagamento_2q)) && status2 === 'Pendente') {
          status2 = 'Atrasado';
        }

        return { 
          id: doc.id, 
          ...d,
          status_pagamento_1q: status1,
          status_pagamento_2q: status2
        } as Contrato;
      });
      setContracts(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'demandas_contrato'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DemandaContrato));
      setDemandas(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'distribuicao_demandas'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DistribuicaoDemanda));
      setDistribuicoes(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'colaboradores'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Colaborador));
      setColaboradores(data);
    });
    return () => unsubscribe();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const dataToSave = { ...formData };
    setIsModalOpen(false);
    setFormData({
      nome: '',
      pacote: 'Starter',
      valor_total_cliente: 0,
      valor_bruto: 0,
      tem_parceria: false,
      parceiro_id: '',
      valor_parceiro: 0,
      data_pagamento_1q: '',
      data_pagamento_2q: '',
    });

    const valorBruto = dataToSave.tem_parceria ? dataToSave.valor_bruto : dataToSave.valor_total_cliente;
    const valorTotalCliente = dataToSave.tem_parceria ? (dataToSave.valor_bruto + dataToSave.valor_parceiro) : dataToSave.valor_total_cliente;

    try {
      await addDoc(collection(db, 'contratos'), {
        nome: dataToSave.nome,
        pacote: dataToSave.pacote,
        valor_total_cliente: valorTotalCliente,
        tem_parceria: dataToSave.tem_parceria,
        parceiro_id: dataToSave.tem_parceria ? dataToSave.parceiro_id : null,
        valor_parceiro: dataToSave.tem_parceria ? dataToSave.valor_parceiro : 0,
        valor_bruto: valorBruto,
        data_pagamento_1q: dataToSave.data_pagamento_1q,
        data_pagamento_2q: dataToSave.data_pagamento_2q,
        status: 'Ativo',
        status_pagamento_1q: 'Pendente',
        status_pagamento_2q: 'Pendente',
        uid: auth.currentUser.uid,
        created_at: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao criar contrato:", error);
    }
  };

  const handleDelete = async () => {
    if (!contractToDelete) return;
    const idToDelete = contractToDelete.id;
    setIsDeleteModalOpen(false);
    setContractToDelete(null);

    try {
      await deleteDoc(doc(db, 'contratos', idToDelete));
    } catch (error) {
      console.error("Erro ao excluir contrato:", error);
    }
  };

  const filteredContracts = contracts.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 text-[#c11720]">Contratos</h1>
          <p className="text-zinc-500">Gerencie seus contratos ativos e acompanhe pagamentos.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-[#c11720] text-white px-6 py-3 rounded-2xl font-bold hover:bg-red-800 transition-all active:scale-95"
        >
          <Plus size={20} />
          Novo Contrato
        </button>
      </header>

      <div className="bg-white rounded-none border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar contrato por nome..."
              className="w-full pl-12 pr-4 py-3 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-black transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="flex items-center gap-2 px-6 py-3 bg-zinc-50 text-zinc-600 rounded-2xl font-medium hover:bg-zinc-100 transition-all">
            <Filter size={18} />
            Filtros
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50">
                <th className="px-6 py-4 text-xs font-bold text-[#7b564d] uppercase tracking-wider">Contrato</th>
                <th className="px-6 py-4 text-xs font-bold text-[#7b564d] uppercase tracking-wider">Demandas</th>
                <th className="px-6 py-4 text-xs font-bold text-[#7b564d] uppercase tracking-wider">Valor Bruto</th>
                <th className="px-6 py-4 text-xs font-bold text-[#7b564d] uppercase tracking-wider">Valor Líquido</th>
                <th className="px-6 py-4 text-xs font-bold text-[#7b564d] uppercase tracking-wider">Receita Líquida</th>
                <th className="px-6 py-4 text-xs font-bold text-[#7b564d] uppercase tracking-wider">Pagamentos</th>
                <th className="px-6 py-4 text-xs font-bold text-[#7b564d] uppercase tracking-wider" style={{ paddingLeft: '29px', paddingRight: '24px' }}>Status</th>
                <th className="px-6 py-4 text-xs font-bold text-[#7b564d] uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredContracts.map((contract) => {
                const contractDemands = demandas.filter(d => d.contrato_id === contract.id);
                const totalDemandsCount = contractDemands.reduce((acc, d) => acc + (Number(d.quantidade_total) || 0), 0);
                
                const contractDists = distribuicoes.filter(d => d.contrato_id === contract.id);
                const totalCosts = contractDists.reduce((acc, d) => {
                  const colab = colaboradores.find(c => c.id === d.colaborador_id);
                  // Exception: "Captação" is always a cost, even for "Proprietário"
                  if (colab?.tipo === 'Proprietário' && d.tipo_demanda !== 'Captação') return acc;
                  // Exclude the contract's main partner from costs, as their value is already deducted from valor_bruto
                  if (contract.tem_parceria && colab?.id === contract.parceiro_id) return acc;
                  return acc + (Number(d.valor_total) || 0);
                }, 0);
                
                const netValue = Number(contract.valor_bruto) - totalCosts;
                const marginPercentage = contract.valor_bruto > 0 ? (netValue / contract.valor_bruto) * 100 : 0;
                const lossPercentage = 100 - marginPercentage;

                return (
                  <tr 
                    key={contract.id} 
                    className="hover:bg-zinc-50/50 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/contratos/${contract.id}`)}
                  >
                    <td className="px-6 py-5">
                      <div className="font-bold text-[#c11720] group-hover:text-red-700" style={{ fontFamily: 'Arial' }}>{contract.nome}</div>
                      <div className="text-xs text-[#7b564d] font-bold">{contract.pacote}</div>
                      <div className="text-[11px] text-zinc-400">Início: {contract.created_at ? format(contract.created_at.toDate(), 'dd/MM/yyyy') : 'N/A'}</div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-bold text-zinc-700">{totalDemandsCount} un.</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm text-zinc-600 font-medium">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contract.valor_bruto)}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`text-sm font-bold ${netValue >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(netValue)}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className={`text-sm font-bold ${marginPercentage >= 75 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {marginPercentage.toFixed(1)}%
                        </span>
                        <span className="text-[11px] font-bold text-zinc-400">PERDA ACEITÁVEL: {lossPercentage.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">1ªQ:</span>
                          <StatusBadge status={contract.status_pagamento_1q} />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">2ªQ:</span>
                          <StatusBadge status={contract.status_pagamento_2q} />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <StatusBadge status={contract.status} />
                    </td>
                    <td className="px-6 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => navigate(`/contratos/${contract.id}`)}
                          className="p-2 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-xl transition-all"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            setContractToDelete(contract);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredContracts.length === 0 && !loading && (
            <div className="p-20 text-center">
              <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-300">
                <FileText size={32} />
              </div>
              <h3 className="text-lg font-bold text-[#c11720]">Nenhum contrato encontrado</h3>
              <p className="text-zinc-500">Comece criando seu primeiro contrato de serviço.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-none shadow-2xl overflow-hidden animate-slide-up">
            <div className="p-8 border-b border-zinc-100 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-[#c11720]">Novo Contrato</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-none transition-all">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#c11720]">Nome do Contrato</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-black transition-all"
                    placeholder="Ex: Mega Elétrica"
                    value={formData.nome}
                    onChange={e => setFormData({...formData, nome: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#c11720]">Pacote</label>
                  <select 
                    className="w-full px-4 py-3 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-black transition-all"
                    value={formData.pacote}
                    onChange={e => setFormData({...formData, pacote: e.target.value as Pacote})}
                  >
                    <option value="Starter">Starter</option>
                    <option value="Starter Master Acessível">Starter Master Acessível</option>
                    <option value="Nível Pro Acessível">Nível Pro Acessível</option>
                    <option value="Master Potencial">Master Potencial</option>
                    <option value="Nível Pro Potencial">Nível Pro Potencial</option>
                  </select>
                </div>
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-zinc-300 text-[#c11720] focus:ring-[#c11720]"
                      checked={formData.tem_parceria}
                      onChange={e => setFormData({...formData, tem_parceria: e.target.checked})}
                    />
                    <span className="text-sm font-bold text-zinc-700">Este contrato possui um Parceiro Estratégico?</span>
                  </label>
                </div>

                {formData.tem_parceria ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#c11720]">Valor da Agência (R$)</label>
                      <input 
                        required
                        type="number" 
                        step="0.01"
                        className="w-full px-4 py-3 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-black transition-all"
                        placeholder="0,00"
                        value={formData.valor_bruto}
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          setFormData({...formData, valor_bruto: isNaN(val) ? 0 : val});
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#c11720]">Valor do Parceiro (R$)</label>
                      <input 
                        required={formData.tem_parceria}
                        type="number" 
                        step="0.01"
                        className="w-full px-4 py-3 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-black transition-all"
                        placeholder="0,00"
                        value={formData.valor_parceiro}
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          setFormData({...formData, valor_parceiro: isNaN(val) ? 0 : val});
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#c11720]">Selecione o Parceiro</label>
                      <select 
                        required={formData.tem_parceria}
                        className="w-full px-4 py-3 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-black transition-all"
                        value={formData.parceiro_id}
                        onChange={e => setFormData({...formData, parceiro_id: e.target.value})}
                      >
                        <option value="">Selecione...</option>
                        {colaboradores.filter(c => c.tipo === 'Parceria').map(p => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-zinc-500">Valor Total do Contrato (R$)</label>
                      <input 
                        disabled
                        type="text" 
                        className="w-full px-4 py-3 bg-zinc-100 border-none rounded-2xl text-zinc-500 font-bold"
                        value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.valor_bruto + formData.valor_parceiro)}
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#c11720]">Valor Total do Contrato (R$)</label>
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      className="w-full px-4 py-3 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-black transition-all"
                      placeholder="0,00"
                      value={formData.valor_total_cliente}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setFormData({...formData, valor_total_cliente: isNaN(val) ? 0 : val});
                      }}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#c11720]">Vencimento 1ª Quinzena</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-3 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-black transition-all"
                    value={formData.data_pagamento_1q}
                    onChange={e => setFormData({...formData, data_pagamento_1q: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#c11720]">Vencimento 2ª Quinzena</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-3 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-black transition-all"
                    value={formData.data_pagamento_2q}
                    onChange={e => setFormData({...formData, data_pagamento_2q: e.target.value})}
                  />
                </div>
              </div>
              <div className="pt-6 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-4 bg-[#c11720] text-white rounded-2xl font-bold hover:bg-red-800 transition-all"
                >
                  Salvar Contrato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && contractToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-none p-8 animate-slide-up text-center">
            <div className="w-16 h-16 bg-[#c11720] text-white rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-xl font-bold mb-2">Excluir Contrato?</h2>
            <p className="text-zinc-500 text-sm mb-8">
              Tem certeza que deseja excluir o contrato de <span className="font-bold text-zinc-900">{contractToDelete.nome}</span>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => { setIsDeleteModalOpen(false); setContractToDelete(null); }} 
                className="flex-1 py-3 bg-zinc-100 rounded-2xl font-bold text-zinc-600 hover:bg-zinc-200 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDelete} 
                className="flex-1 py-3 bg-[#c11720] text-white rounded-2xl font-bold hover:bg-red-800 transition-all"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contracts;
