import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Colaborador, TipoColaborador, DistribuicaoDemanda, ExecucaoMensal } from '../types';
import { useMonth } from '../contexts/MonthContext';
import { Plus, Trash2, Users, UserPlus, Briefcase, User as UserIcon, AlertCircle, Handshake, CheckCircle2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Team = () => {
  const { currentMonth } = useMonth();
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [distribuicoes, setDistribuicoes] = useState<DistribuicaoDemanda[]>([]);
  const [execucoesMensais, setExecucoesMensais] = useState<ExecucaoMensal[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [colabToDelete, setColabToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({ nome: '', tipo: 'Equipe' as TipoColaborador, salario: 0 });

  useEffect(() => {
    const fetchData = async () => {
      const { data: colabs } = await supabase
        .from('colaboradores')
        .select('*');
      if (colabs) setColaboradores(colabs as Colaborador[]);

      const { data: dists } = await supabase
        .from('distribuicao_demandas')
        .select('*');
      if (dists) {
        const filteredDists = dists.filter(d => d.mes_ano === currentMonth || (!d.mes_ano && currentMonth === '2026-04'));
        setDistribuicoes(filteredDists as DistribuicaoDemanda[]);
      }
    };

    fetchData();

    const colabsChannel = supabase.channel('colaboradores_channel')
      .on('postgres_changes', { event: '*', schema: 'BR_Gestão_de_Contratos', table: 'colaboradores' }, fetchData)
      .subscribe();
    const distsChannel = supabase.channel('distribuicao_channel')
      .on('postgres_changes', { event: '*', schema: 'BR_Gestão_de_Contratos', table: 'distribuicao_demandas' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(colabsChannel);
      supabase.removeChannel(distsChannel);
    };
  }, [currentMonth]);

  useEffect(() => {
    const fetchExecucoes = async () => {
      const { data: execs } = await supabase
        .from('execucoes_mensais')
        .select('*')
        .eq('mes_ano', currentMonth);
      if (execs) setExecucoesMensais(execs as ExecucaoMensal[]);
    };

    fetchExecucoes();

    const execChannel = supabase.channel('execucoes_channel')
      .on('postgres_changes', { event: '*', schema: 'BR_Gestão_de_Contratos', table: 'execucoes_mensais' }, fetchExecucoes)
      .subscribe();

    return () => {
      supabase.removeChannel(execChannel);
    };
  }, [currentMonth]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const dataToSave = { ...formData };
    setIsModalOpen(false);
    setFormData({ nome: '', tipo: 'Equipe', salario: 0 });

    await supabase
      .from('colaboradores')
      .insert({
        nome: dataToSave.nome,
        tipo: dataToSave.tipo,
        salario_fixo: dataToSave.salario,
        uid: user.id
      });
  };

  const handleDelete = async () => {
    if (!colabToDelete) return;
    const idToDelete = colabToDelete;
    setIsDeleteModalOpen(false);
    setColabToDelete(null);

    try {
      await supabase
        .from('colaboradores')
        .delete()
        .eq('id', idToDelete);
    } catch (error) {
      console.error("Erro ao excluir colaborador:", error);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<TipoColaborador | 'Todos'>('Todos');

  const collaboratorsWithStats = colaboradores.map(colab => {
    const colabDists = distribuicoes.filter(d => d.colaborador_id === colab.id);
    const totalDemands = colabDists.reduce((acc, d) => acc + (d.quantidade || 0), 0);
    
    const completedDemands = colabDists.reduce((acc, d) => {
      const exec = execucoesMensais.find(e => e.distribuicao_id === d.id);
      return acc + (exec?.quantidade_concluida || 0);
    }, 0);
    
    const paidDemands = colabDists.reduce((acc, d) => {
      const exec = execucoesMensais.find(e => e.distribuicao_id === d.id);
      return acc + (exec?.quantidade_paga || 0);
    }, 0);
    
    const aPagarValue = colabDists.reduce((acc, d) => {
      const exec = execucoesMensais.find(e => e.distribuicao_id === d.id);
      const concluida = exec?.quantidade_concluida || 0;
      const paga = exec?.quantidade_paga || 0;
      return acc + ((concluida - paga) * (d.valor_unitario || 0));
    }, 0);

    return {
      ...colab,
      totalDemands,
      completedDemands,
      paidDemands,
      aPagarValue
    };
  });

  const filteredCollaborators = collaboratorsWithStats.filter(c => {
    const matchesSearch = c.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'Todos' || c.tipo === filterType;
    return matchesSearch && matchesFilter;
  });

  const totalPendingPayment = collaboratorsWithStats.reduce((acc, c) => acc + (c.tipo !== 'Proprietário' ? c.aPagarValue : 0), 0);
  const totalDemandsCount = collaboratorsWithStats.reduce((acc, c) => acc + c.totalDemands, 0);
  const totalCompletedCount = collaboratorsWithStats.reduce((acc, c) => acc + c.completedDemands, 0);

  return (
    <div className="space-y-10 animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 text-[#c11720]">Equipe</h1>
          <p className="text-zinc-500">Gestão de talentos, execução de demandas e pendências financeiras.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-[#c11720] text-white px-8 py-4 rounded-2xl font-bold hover:bg-red-800 transition-all active:scale-95 shadow-lg shadow-red-900/10"
        >
          <UserPlus size={20} />
          Novo Colaborador
        </button>
      </header>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 border border-zinc-100 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-400">
            <Users size={28} />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Equipe</p>
            <p className="text-2xl font-black text-zinc-900">{colaboradores.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 border border-zinc-100 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500">
            <Briefcase size={28} />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Demandas Totais</p>
            <p className="text-2xl font-black text-zinc-900">{totalCompletedCount}/{totalDemandsCount}</p>
          </div>
        </div>
        <div className="bg-white p-6 border border-zinc-100 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500">
            <AlertCircle size={28} />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total a Pagar</p>
            <p className="text-2xl font-black text-rose-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPendingPayment)}
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Plus className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 rotate-45" size={20} />
          <input 
            type="text" 
            placeholder="Buscar colaborador..." 
            className="w-full pl-12 pr-4 py-4 bg-white border border-zinc-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 p-1 bg-zinc-100 rounded-2xl">
          {['Todos', 'Equipe', 'Proprietário', 'Parceria'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type as any)}
              className={cn(
                "px-6 py-3 rounded-xl text-xs font-bold transition-all",
                filterType === type 
                  ? "bg-white text-[#c11720] shadow-sm" 
                  : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {filteredCollaborators.map(colab => {
          const isOwner = colab.tipo === 'Proprietário';
          const hasDemands = colab.totalDemands > 0;
          const progress = colab.totalDemands > 0 ? (colab.completedDemands / colab.totalDemands) * 100 : 0;
          const paymentProgress = colab.completedDemands > 0 ? (colab.paidDemands / colab.completedDemands) * 100 : 0;

          return (
            <div key={colab.id} className="bg-white rounded-none border border-zinc-100 shadow-sm hover:shadow-xl transition-all group flex flex-col">
              {/* Card Header */}
              <div className="p-8 pb-6">
                <div className="flex justify-between items-start mb-6">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300",
                    isOwner ? "bg-[#c11720] text-white" : colab.tipo === 'Parceria' ? "bg-[#0c3249] text-white" : "bg-zinc-100 text-zinc-600"
                  )}>
                    {isOwner ? <Briefcase size={28} /> : colab.tipo === 'Parceria' ? <Handshake size={28} /> : <UserIcon size={28} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border",
                      isOwner ? "bg-emerald-50 text-emerald-700 border-emerald-100" : 
                      colab.tipo === 'Parceria' ? "bg-amber-50 text-amber-700 border-amber-100" : 
                      "bg-zinc-50 text-zinc-600 border-zinc-200"
                    )}>
                      {colab.tipo}
                    </span>
                    <button 
                      onClick={() => {
                        setColabToDelete(colab.id);
                        setIsDeleteModalOpen(true);
                      }}
                      className="p-2 text-zinc-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                <h3 className="text-2xl font-black text-zinc-900 mb-1 leading-tight">{colab.nome}</h3>
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">
                  {isOwner ? 'Lucro Direto' : colab.tipo === 'Parceria' ? 'Parceiro Estratégico' : 'Colaborador Equipe'}
                </p>
              </div>

              {/* Stats Section */}
              <div className="px-8 py-6 bg-zinc-50/50 border-y border-zinc-50 flex-1">
                {hasDemands ? (
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between text-[10px] font-black text-zinc-500 uppercase mb-2">
                        <span>Execução ({colab.completedDemands}/{colab.totalDemands})</span>
                        <span className="text-zinc-900">{progress.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full transition-all duration-700 ease-out" 
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {!isOwner && (
                      <div>
                        <div className="flex justify-between text-[10px] font-black text-zinc-500 uppercase mb-2">
                          <span>Pagamentos ({colab.paidDemands}/{colab.completedDemands})</span>
                          <span className="text-zinc-900">{paymentProgress.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-[#c11720] h-full transition-all duration-700 ease-out" 
                            style={{ width: `${paymentProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center py-4">
                    <p className="text-xs text-zinc-400 italic font-medium">Sem demandas ativas</p>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="p-8 pt-6 flex justify-between items-end">
                <div>
                  {colab.salario_fixo > 0 ? (
                    <>
                      <p className="text-[10px] text-zinc-400 font-black uppercase mb-1">Salário Fixo</p>
                      <p className="text-xl font-black text-zinc-900">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(colab.salario_fixo)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] text-zinc-400 font-black uppercase mb-1">Remuneração</p>
                      <p className="text-sm font-bold text-zinc-500 italic">Por Demanda</p>
                    </>
                  )}
                </div>

                {!isOwner && hasDemands && (
                  <div className="text-right">
                    {colab.aPagarValue > 0 ? (
                      <>
                        <span className="text-[10px] text-rose-500 font-black uppercase block mb-1">Pendente</span>
                        <span className="text-xl font-black text-rose-600">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(colab.aPagarValue)}
                        </span>
                      </>
                    ) : colab.completedDemands > 0 ? (
                      <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                        <CheckCircle2 size={14} />
                        <span className="text-[10px] font-black uppercase">Tudo Pago</span>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {filteredCollaborators.length === 0 && (
          <div className="col-span-full py-20 text-center bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-none">
            <Users size={48} className="mx-auto text-zinc-300 mb-4" />
            <p className="text-zinc-500 font-bold">Nenhum colaborador encontrado.</p>
            <p className="text-zinc-400 text-sm">Tente ajustar sua busca ou filtros.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-none p-8 animate-slide-up">
            <h2 className="text-2xl font-bold mb-6">Novo Colaborador</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-bold text-zinc-700">Nome Completo</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-3 bg-zinc-50 border-none rounded-2xl mt-1"
                  value={formData.nome}
                  onChange={e => setFormData({...formData, nome: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-bold text-zinc-700">Tipo</label>
                <select 
                  className="w-full px-4 py-3 bg-zinc-50 border-none rounded-2xl mt-1"
                  value={formData.tipo}
                  onChange={e => setFormData({...formData, tipo: e.target.value as TipoColaborador})}
                >
                  <option value="Equipe">Equipe</option>
                  <option value="Proprietário">Proprietário</option>
                  <option value="Parceria">Parceria</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-zinc-700">Salário Fixo (Opcional)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="w-full px-4 py-3 bg-zinc-50 border-none rounded-2xl mt-1"
                  value={formData.salario}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    setFormData({...formData, salario: isNaN(val) ? 0 : val});
                  }}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-zinc-100 rounded-2xl font-bold">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-[#c11720] text-white rounded-2xl font-bold hover:bg-red-800 transition-all">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-none p-8 animate-slide-up text-center">
            <div className="w-16 h-16 bg-[#c11720] text-white rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-xl font-bold mb-2">Excluir Colaborador?</h2>
            <p className="text-zinc-500 text-sm mb-8">
              Esta ação não pode ser desfeita. Todos os dados deste colaborador serão removidos permanentemente.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => { setIsDeleteModalOpen(false); setColabToDelete(null); }} 
                className="flex-1 py-3 bg-zinc-100 rounded-none font-bold text-zinc-600 hover:bg-zinc-200 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDelete} 
                className="flex-1 py-3 bg-[#c11720] text-white rounded-none font-bold hover:bg-red-800 transition-all"
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

export default Team;
