import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMonth } from '../contexts/MonthContext';
import Financial from './Financial';
import { format, setMonth, isFuture, isSameMonth, subMonths, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, ArrowRight, AlertCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from '../supabase';
import { inheritMonthData } from '../services/contractService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Home = () => {
  const { currentMonth, setCurrentMonth } = useMonth();
  const navigate = useNavigate();
  const [isInheritModalOpen, setIsInheritModalOpen] = useState(false);
  const [pendingMonth, setPendingMonth] = useState<string | null>(null);
  const [isInheriting, setIsInheriting] = useState(false);

  const currentYear = new Date().getFullYear();
  const today = new Date();

  const months = Array.from({ length: 12 }, (_, i) => {
    const date = setMonth(new Date(currentYear, 0, 1), i);
    const monthString = format(date, 'yyyy-MM');
    const isCurrent = isSameMonth(date, today);
    const isFutureMonth = isFuture(date) && !isCurrent;
    const isSelected = currentMonth === monthString;

    return {
      date,
      monthString,
      label: format(date, 'MMMM', { locale: ptBR }),
      isCurrent,
      isFutureMonth,
      isSelected
    };
  });

  const startOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  };

  const checkAndInherit = async (monthString: string) => {
    const selectedDate = new Date(monthString + '-01T00:00:00');
    const prevDate = subMonths(selectedDate, 1);
    const prevMonthString = format(prevDate, 'yyyy-MM');

    // Check if selected month has contracts
    const { data: currentContracts } = await supabase
      .from('contratos')
      .select('id')
      .eq('mes_ano', monthString);

    if (currentContracts && currentContracts.length > 0) {
      // Already has data, just navigate
      setCurrentMonth(monthString);
      navigate('/dashboard');
      return;
    }

    // Check if previous month has contracts
    const { data: prevContracts } = await supabase
      .from('contratos')
      .select('mes_ano');

    const hasPrevContracts = prevContracts && prevContracts.some(c => {
      return c.mes_ano === prevMonthString || (!c.mes_ano && prevMonthString === '2026-04');
    });

    if (!hasPrevContracts) {
      // Nothing to inherit, just navigate
      setCurrentMonth(monthString);
      navigate('/dashboard');
      return;
    }

    // If selected month is in the past relative to today, ask
    const isPast = isBefore(selectedDate, startOfMonth(today));
    
    if (isPast) {
      setPendingMonth(monthString);
      setIsInheritModalOpen(true);
    } else {
      // Automatic inheritance for current/future months
      setIsInheriting(true);
      await inheritMonthData(prevMonthString, monthString);
      setIsInheriting(false);
      setCurrentMonth(monthString);
      navigate('/dashboard');
    }
  };

  const handleMonthSelect = (monthString: string) => {
    checkAndInherit(monthString);
  };

  const confirmInherit = async (shouldInherit: boolean) => {
    if (!pendingMonth) return;
    
    if (shouldInherit) {
      setIsInheriting(true);
      const prevDate = subMonths(new Date(pendingMonth + '-01T00:00:00'), 1);
      const prevMonthString = format(prevDate, 'yyyy-MM');
      await inheritMonthData(prevMonthString, pendingMonth);
      setIsInheriting(false);
    }
    
    setIsInheritModalOpen(false);
    setCurrentMonth(pendingMonth);
    navigate('/dashboard');
  };

  return (
    <div className="space-y-12 animate-fade-in relative">
      {isInheriting && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[#c11720] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-lg font-bold text-[#0c3249]">Preparando o mês...</p>
          </div>
        </div>
      )}

      {isInheritModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-4 text-amber-600 mb-6">
              <AlertCircle size={32} />
              <h3 className="text-xl font-bold text-zinc-900">Herdar Planejamento?</h3>
            </div>
            <p className="text-zinc-600 mb-8 leading-relaxed">
              Identificamos que este mês não possui contratos cadastrados. Deseja importar automaticamente os contratos e equipe do mês anterior?
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => confirmInherit(false)}
                className="flex-1 px-6 py-3 bg-zinc-100 text-zinc-700 font-bold rounded-xl hover:bg-zinc-200 transition-colors"
                disabled={isInheriting}
              >
                Não, começar vazio
              </button>
              <button 
                onClick={() => confirmInherit(true)}
                className="flex-1 px-6 py-3 bg-[#c11720] text-white font-bold rounded-xl hover:bg-red-800 transition-colors"
                disabled={isInheriting}
              >
                Sim, herdar dados
              </button>
            </div>
          </div>
        </div>
      )}

      <section>
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-[#0c3249]">Planejamento Mensal</h1>
          <p className="text-zinc-500 mt-2">Selecione o mês para acessar o painel de gestão.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {months.map((m) => (
            <button
              key={m.monthString}
              onClick={() => !m.isFutureMonth && handleMonthSelect(m.monthString)}
              disabled={m.isFutureMonth || isInheriting}
              className={cn(
                "relative flex flex-col items-center justify-center p-6 rounded-2xl border transition-all duration-300 min-h-[140px]",
                m.isFutureMonth 
                  ? "bg-zinc-50 border-zinc-100 opacity-50 cursor-not-allowed" 
                  : "bg-white border-zinc-200 hover:border-[#c11720] hover:shadow-md cursor-pointer group",
                m.isCurrent && !m.isFutureMonth && "ring-2 ring-[#c11720] ring-offset-2 border-transparent"
              )}
            >
              {m.isCurrent && (
                <span className="absolute top-3 right-3 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c11720] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#c11720]"></span>
                </span>
              )}
              
              <Calendar 
                size={32} 
                className={cn(
                  "mb-3 transition-colors",
                  m.isFutureMonth ? "text-zinc-300" : "text-[#0c3249] group-hover:text-[#c11720]"
                )} 
              />
              <span className="text-lg font-bold capitalize text-zinc-800">
                {m.label}
              </span>
              
              {!m.isFutureMonth && (
                <div className="absolute bottom-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs font-bold text-[#c11720]">
                  Acessar <ArrowRight size={12} />
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      <hr className="border-zinc-200" />

      <section>
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-[#0c3249]">Visão Geral Financeira (YTD)</h2>
          <p className="text-zinc-500 mt-2">Acompanhamento financeiro acumulado do ano.</p>
        </div>
        
        {/* Render the Financial component here */}
        <Financial />
      </section>
    </div>
  );
};

export default Home;
