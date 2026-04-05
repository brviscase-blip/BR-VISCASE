import React, { createContext, useContext, useState } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MonthContextType {
  currentMonth: string | null; // Format: 'YYYY-MM'
  setCurrentMonth: (month: string | null) => void;
  nextMonth: () => void;
  prevMonth: () => void;
  monthLabel: string;
}

const MonthContext = createContext<MonthContextType | undefined>(undefined);

export const MonthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentMonth, setCurrentMonth] = useState<string | null>(null);

  const nextMonth = () => {
    if (!currentMonth) return;
    const date = new Date(currentMonth + '-01T00:00:00');
    setCurrentMonth(format(addMonths(date, 1), 'yyyy-MM'));
  };

  const prevMonth = () => {
    if (!currentMonth) return;
    const date = new Date(currentMonth + '-01T00:00:00');
    setCurrentMonth(format(subMonths(date, 1), 'yyyy-MM'));
  };

  const monthLabel = currentMonth 
    ? format(new Date(currentMonth + '-01T00:00:00'), 'MMMM yyyy', { locale: ptBR })
    : '';

  return (
    <MonthContext.Provider value={{ currentMonth, setCurrentMonth, nextMonth, prevMonth, monthLabel }}>
      {children}
    </MonthContext.Provider>
  );
};

export const useMonth = () => {
  const context = useContext(MonthContext);
  if (!context) throw new Error('useMonth must be used within a MonthProvider');
  return context;
};
