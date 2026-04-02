import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Contrato, DistribuicaoDemanda, Colaborador } from '../types';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  FileText, 
  Users,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  BarChart3
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';

const StatCard = ({ title, value, subValue, icon: Icon, trend, trendValue, color }: any) => (
  <div className="bg-white p-6 rounded-none border border-zinc-100 shadow-sm hover:shadow-md transition-all duration-300">
    <div className="flex justify-between items-start mb-4">
      <div className={cn("p-3 rounded-2xl", color)}>
        <Icon size={24} />
      </div>
      {trend && (
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold",
          trend === 'up' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-[#c11720]"
        )}>
          {trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {trendValue}
        </div>
      )}
    </div>
    <h3 className="text-[#71717b] text-sm font-normal mb-1 uppercase tracking-wider">{title}</h3>
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-bold tracking-tight text-black">{value}</span>
      {subValue && <span className="text-[13px] text-zinc-400 font-medium">{subValue}</span>}
    </div>
  </div>
);

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

const Dashboard = () => {
  const [contracts, setContracts] = useState<Contrato[]>([]);
  const [distributions, setDistributions] = useState<DistribuicaoDemanda[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const q = query(collection(db, 'contratos'), where('status', '==', 'Ativo'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contrato));
      setContracts(data);
    });

    const qDist = query(collection(db, 'distribuicao_demandas'));
    const unsubscribeDist = onSnapshot(qDist, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DistribuicaoDemanda));
      setDistributions(data);
    });

    const unsubscribeColabs = onSnapshot(collection(db, 'colaboradores'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Colaborador));
      setColaboradores(data);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      unsubscribeDist();
      unsubscribeColabs();
    };
  }, []);

  const calculateStats = () => {
    const totalGross = contracts.reduce((acc, c) => acc + (Number(c.valor_bruto) || 0), 0);
    
    // Calculate costs per contract
    const contractStats = contracts.map(contract => {
      const contractDistributions = distributions.filter(d => d.contrato_id === contract.id);
      const costs = contractDistributions.reduce((acc, d) => {
        const colab = colaboradores.find(c => c.id === d.colaborador_id);
        // Exception: "Captação" is always a cost, even for "Proprietário"
        if (colab?.tipo === 'Proprietário' && d.tipo_demanda !== 'Captação') return acc;
        return acc + (Number(d.valor_total) || 0);
      }, 0);
      const net = (Number(contract.valor_bruto) || 0) - costs;
      const margin = (Number(contract.valor_bruto) || 0) > 0 ? (net / Number(contract.valor_bruto)) * 100 : 0;
      const loss = 100 - margin;
      
      return { costs, net, margin, loss };
    });

    const totalNet = contractStats.reduce((acc, s) => acc + (Number(s.net) || 0), 0);
    const totalCosts = contractStats.reduce((acc, s) => acc + (Number(s.costs) || 0), 0);

    // Median calculation helper
    const getMedian = (arr: number[]) => {
      const validArr = arr.filter(v => !isNaN(v));
      if (validArr.length === 0) return 0;
      const sorted = [...validArr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    const medianMargin = getMedian(contractStats.map(s => s.margin));
    const medianLoss = getMedian(contractStats.map(s => s.loss));
    const contractsAtRisk = contractStats.filter(s => s.loss > 30).length;

    return {
      totalGross,
      totalNet,
      totalCosts,
      medianMargin,
      medianLoss,
      contractsAtRisk
    };
  };

  const stats = calculateStats();

  const chartData = [
    { name: 'Receita Bruta', value: stats.totalGross, color: '#F2F2F2' },
    { name: 'Receita Líquida', value: stats.totalNet, color: '#7b564d' },
    { name: 'Perda Aceitável', value: stats.totalCosts, color: '#c11720' },
  ];

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="space-y-10 animate-fade-in">
      <header>
        <h1 className="text-4xl font-bold tracking-tight mb-2 text-[#c11720]">Visão Geral</h1>
        <p className="text-zinc-500">Acompanhe a saúde financeira e operacional dos seus contratos.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Receita Bruta Mensal" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalGross)}
          icon={DollarSign}
          color="bg-[#F2F2F2] text-black border border-white"
        />
        <StatCard 
          title="Receita Líquida Mensal" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalNet)}
          icon={TrendingUp}
          color="bg-[#7b564d] text-white"
          trend="up"
          trendValue={`${stats.totalGross > 0 ? ((stats.totalNet / stats.totalGross) * 100).toFixed(1) : '0.0'}%`}
        />
        <StatCard 
          title="Mediana de Receita Líquida" 
          value={
            <span className={stats.medianMargin >= 75 ? 'text-emerald-600' : 'text-rose-600'}>
              {stats.medianMargin.toFixed(1)}%
            </span>
          }
          subValue="Meta: ≥ 70%"
          icon={BarChart3}
          color="bg-[#7b564d] text-white"
          trend={stats.medianMargin >= 70 ? 'up' : 'down'}
          trendValue={stats.medianMargin >= 70 ? 'No Alvo' : 'Abaixo'}
        />
        <StatCard 
          title="Contratos em Alerta" 
          value={stats.contractsAtRisk}
          subValue="Perda > 30%"
          icon={AlertCircle}
          color="bg-[#7b564d] text-white"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-none border border-zinc-100 shadow-sm min-h-[450px]">
          <h3 className="text-xl font-bold mb-8 text-[#c11720]">Performance Financeira Consolidada</h3>
          <div className="h-[349px] w-full flex items-center justify-center mt-[-30px]">
            {isMounted && (
              <ResponsiveContainer width="100%" height={349}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 14 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 14 }} />
                  <Tooltip 
                    cursor={{ fill: '#f8f9fa' }}
                    contentStyle={{ borderRadius: '0', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '14px' }}
                  />
                  <Bar dataKey="value" radius={0} barSize={60}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-8 rounded-none border border-zinc-100 shadow-sm flex flex-col">
          <h3 className="text-xl font-bold mb-2 text-[#c11720]">Distribuição de Receita Líquida</h3>
          <p className="text-sm text-zinc-500 mb-8">Mediana de perda aceitável: {stats.medianLoss.toFixed(1)}%</p>
          
          <div className="flex-1 flex items-center justify-center relative min-h-[250px] w-full">
            {isMounted && (
              <ResponsiveContainer width="100%" height={250} minHeight={250}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Receita Líquida', value: stats.medianMargin },
                      { name: 'Perda Aceitável', value: stats.medianLoss }
                    ]}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    <Cell fill="#7b564d" />
                    <Cell fill="#c11720" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          
          <div className="space-y-3 mt-4">
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-none bg-[#7b564d]" />
                <span className="text-zinc-600">Receita Líquida</span>
              </div>
              <span className={`font-bold ${stats.medianMargin >= 75 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {stats.medianMargin.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-none bg-[#c11720]" />
                <span className="text-zinc-600">Perda Aceitável</span>
              </div>
              <span className="font-bold">{stats.medianLoss.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
