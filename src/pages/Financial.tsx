import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Contrato, DistribuicaoDemanda, Colaborador } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DollarSign, TrendingUp, TrendingDown, Calendar } from 'lucide-react';

const Financial = () => {
  const [contracts, setContracts] = useState<Contrato[]>([]);
  const [distributions, setDistributions] = useState<DistribuicaoDemanda[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const unsubContracts = onSnapshot(collection(db, 'contratos'), (snapshot) => {
      setContracts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Contrato)));
    });

    const unsubDist = onSnapshot(collection(db, 'distribuicao_demandas'), (snapshot) => {
      setDistributions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DistribuicaoDemanda)));
    });

    const unsubColabs = onSnapshot(collection(db, 'colaboradores'), (snapshot) => {
      setColaboradores(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Colaborador)));
      setLoading(false);
    });

    return () => {
      unsubContracts();
      unsubDist();
      unsubColabs();
    };
  }, []);

  const getMonthlyData = () => {
    const last6Months = eachMonthOfInterval({
      start: subMonths(new Date(), 5),
      end: new Date()
    });

    return last6Months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const monthContracts = contracts.filter(c => {
        const start = c.created_at ? c.created_at.toDate() : new Date();
        return isWithinInterval(start, { start: monthStart, end: monthEnd }) || c.status === 'Ativo';
      });

      const gross = monthContracts.reduce((acc, c) => acc + (Number(c.valor_bruto) || 0), 0);
      const costs = monthContracts.reduce((acc, c) => {
        const contractDist = distributions.filter(d => d.contrato_id === c.id);
        return acc + contractDist.reduce((sum, d) => {
          const colab = colaboradores.find(col => col.id === d.colaborador_id);
          // Exception: "Captação" is always a cost, even for "Proprietário"
          if (colab?.tipo === 'Proprietário' && d.tipo_demanda !== 'Captação') return sum;
          // Exclude the contract's main partner from costs, as their value is already deducted from valor_bruto
          if (c.tem_parceria && colab?.id === c.parceiro_id) return sum;
          return sum + (Number(d.valor_total) || 0);
        }, 0);
      }, 0);

      const net = gross - costs;
      const margin = gross > 0 ? (net / gross) * 100 : 0;

      return {
        month: format(month, 'MMM', { locale: ptBR }),
        gross,
        net,
        costs,
        margin: isNaN(margin) ? 0 : parseFloat(margin.toFixed(1))
      };
    });
  };

  const monthlyData = getMonthlyData();

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="space-y-10 animate-fade-in">
      <header>
        <h1 className="text-4xl font-bold tracking-tight mb-2 text-[#c11720]">Financeiro</h1>
        <p className="text-zinc-500">Análise detalhada de receitas, perda aceitável e rentabilidade mensal.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-none border border-zinc-100 shadow-sm">
          <h3 className="text-xl font-bold mb-8 flex items-center gap-2 text-[#c11720]">
            <TrendingUp size={20} className="text-emerald-500" />
            Evolução de Receita (Bruta vs Líquida)
          </h3>
          <div className="h-[350px] relative">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={100}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F2F2F2" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#F2F2F2" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7b564d" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#7b564d" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 14 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 14 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '0', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '14px' }}
                  />
                  <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
                  <Area type="monotone" dataKey="gross" name="Receita Bruta" stroke="#F2F2F2" fillOpacity={1} fill="url(#colorGross)" strokeWidth={3} />
                  <Area type="monotone" dataKey="net" name="Receita Líquida" stroke="#7b564d" fillOpacity={1} fill="url(#colorNet)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-8 rounded-none border border-zinc-100 shadow-sm">
          <h3 className="text-xl font-bold mb-8 flex items-center gap-2 text-[#c11720]">
            <TrendingUp size={20} className="text-indigo-500" />
            Evolução da Receita Líquida (%)
          </h3>
          <div className="h-[350px] relative">
            {isMounted && (
              <ResponsiveContainer width="100%" height={100} minWidth={0} minHeight={0} debounce={100}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 14 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 14 }} unit="%" />
                  <Tooltip 
                    contentStyle={{ borderRadius: '0', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '14px' }}
                  />
                  <Line type="monotone" dataKey="margin" name="Margem (%)" stroke="#6366f1" strokeWidth={4} dot={{ r: 6, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-none border border-zinc-100 shadow-sm">
        <h3 className="text-xl font-bold mb-8">Resumo Mensal Detalhado</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100">
                <th className="pb-4">Mês</th>
                <th className="pb-4">Receita Bruta</th>
                <th className="pb-4">Perda Aceitável</th>
                <th className="pb-4">Receita Líquida</th>
                <th className="pb-4">Margem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {monthlyData.map((data, i) => (
                <tr key={i}>
                  <td className="py-5 font-bold text-zinc-900">{data.month}</td>
                  <td className="py-5 text-zinc-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.gross)}</td>
                  <td className="py-5 text-[#c11720] font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.costs)}</td>
                  <td className="py-5 text-[#7b564d] font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.net)}</td>
                  <td className="py-5">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${data.margin >= 70 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-[#c11720]'}`}>
                      {data.margin}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Financial;
