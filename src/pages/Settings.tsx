import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { UserProfile, UserRole, UserStatus } from '../types';
import { Shield, UserCheck, UserX, Trash2, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Settings() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*');
      
      if (error) {
        console.error("Error fetching users:", error);
      } else {
        setUsers(data as UserProfile[]);
      }
      setLoading(false);
    };

    fetchUsers();

    // Subscribe to changes
    const channel = supabase
      .channel('users-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId);
      
      if (error) throw error;
    } catch (error) {
      console.error("Error updating role:", error);
      alert("Erro ao atualizar o nível de acesso.");
    }
  };

  const handleUpdateStatus = async (userId: string, newStatus: UserStatus) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: newStatus })
        .eq('id', userId);
      
      if (error) throw error;
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Erro ao atualizar o status do usuário.");
    }
  };

  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  const handleDeleteUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);
      
      if (error) throw error;
      setUserToDelete(null);
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Erro ao excluir o usuário.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-zinc-200 border-t-[#c11720] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {userToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full">
            <h3 className="text-lg font-bold text-zinc-900">Excluir usuário</h3>
            <p className="text-zinc-600 mt-2">Tem certeza que deseja excluir o usuário <strong>{userToDelete.name}</strong>? Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => handleDeleteUser(userToDelete.id)}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Configurações</h1>
        <p className="text-zinc-500 mt-2">Gerencie os usuários e permissões do sistema.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="p-6 border-b border-zinc-200 flex items-center gap-3">
          <Shield className="text-[#c11720]" size={24} />
          <h2 className="text-xl font-bold text-zinc-900">Gerenciamento de Usuários</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="px-6 py-4 text-sm font-semibold text-zinc-600">Usuário</th>
                <th className="px-6 py-4 text-sm font-semibold text-zinc-600">Email</th>
                <th className="px-6 py-4 text-sm font-semibold text-zinc-600">Nível de Acesso</th>
                <th className="px-6 py-4 text-sm font-semibold text-zinc-600">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-zinc-600 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-zinc-900">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-500">{user.email}</td>
                  <td className="px-6 py-4">
                    <select
                      value={user.role}
                      onChange={(e) => handleUpdateRole(user.id, e.target.value as UserRole)}
                      className="bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm rounded-lg focus:ring-[#c11720] focus:border-[#c11720] block w-full p-2.5"
                    >
                      <option value="ADM">Administrador</option>
                      <option value="Parceiro">Parceiro</option>
                      <option value="Equipe">Equipe</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {user.status === 'active' && <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full text-xs font-medium"><CheckCircle2 size={14} /> Ativo</span>}
                      {user.status === 'pending' && <span className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full text-xs font-medium"><Clock size={14} /> Pendente</span>}
                      {user.status === 'rejected' && <span className="flex items-center gap-1.5 text-red-600 bg-red-50 px-2.5 py-1 rounded-full text-xs font-medium"><XCircle size={14} /> Negado</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {user.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(user.id, 'active')}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Aprovar Acesso"
                          >
                            <UserCheck size={20} />
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(user.id, 'rejected')}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Negar Acesso"
                          >
                            <UserX size={20} />
                          </button>
                        </>
                      )}
                      {user.status === 'active' && (
                        <button
                          onClick={() => handleUpdateStatus(user.id, 'rejected')}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Suspender Acesso"
                        >
                          <UserX size={20} />
                        </button>
                      )}
                      {user.status === 'rejected' && (
                        <button
                          onClick={() => handleUpdateStatus(user.id, 'active')}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Restaurar Acesso"
                        >
                          <UserCheck size={20} />
                        </button>
                      )}
                      <button
                        onClick={() => setUserToDelete(user)}
                        className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-2"
                        title="Excluir Usuário"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
