import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Colaborador, TipoColaborador } from '../types';
import { Plus, Trash2, Users, UserPlus, Briefcase, User as UserIcon, AlertCircle } from 'lucide-react';

const Team = () => {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [colabToDelete, setColabToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({ nome: '', tipo: 'Equipe' as TipoColaborador, salario: 0 });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'colaboradores'), (snapshot) => {
      setColaboradores(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Colaborador)));
    });
    return () => unsub();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    await addDoc(collection(db, 'colaboradores'), {
      nome: formData.nome,
      tipo: formData.tipo,
      salario_fixo: formData.salario,
      uid: auth.currentUser.uid,
      created_at: serverTimestamp()
    });
    setIsModalOpen(false);
    setFormData({ nome: '', tipo: 'Equipe', salario: 0 });
  };

  const handleDelete = async () => {
    if (!colabToDelete) return;
    try {
      await deleteDoc(doc(db, 'colaboradores', colabToDelete));
      setIsDeleteModalOpen(false);
      setColabToDelete(null);
    } catch (error) {
      console.error("Erro ao excluir colaborador:", error);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 text-[#c11720]">Equipe</h1>
          <p className="text-zinc-500">Gerencie os colaboradores e proprietários do sistema.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-[#c11720] text-white px-6 py-3 rounded-2xl font-bold hover:bg-red-800 transition-all active:scale-95"
        >
          <UserPlus size={20} />
          Novo Colaborador
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {colaboradores.map(colab => (
          <div key={colab.id} className="bg-white p-8 rounded-none border border-zinc-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-6">
              <div className={`p-4 rounded-2xl ${colab.tipo === 'Proprietário' ? 'bg-[#c11720] text-white' : 'bg-zinc-100 text-zinc-600'}`}>
                {colab.tipo === 'Proprietário' ? <Briefcase size={24} className="text-white" /> : <UserIcon size={24} />}
              </div>
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
            <h3 className="text-xl font-bold mb-1 text-[#c11720]">{colab.nome}</h3>
            <p className="text-sm text-zinc-500 mb-4">{colab.tipo}</p>
            {colab.salario_fixo > 0 && (
              <div className="pt-4 border-t border-zinc-50">
                <p className="text-xs text-zinc-400 font-bold uppercase mb-1">Salário Fixo</p>
                <p className="text-lg font-bold text-zinc-900">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(colab.salario_fixo)}
                </p>
              </div>
            )}
          </div>
        ))}
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
