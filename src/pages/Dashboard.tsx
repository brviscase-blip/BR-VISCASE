import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  BarChart3,
  X
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
  Pie,
  ComposedChart,
  Line,
  Legend,
  LabelList
} from 'recharts';

const StatCard = ({ title, value, subValue, icon: Icon, trend, trendValue, color, onClick }: any) => (
  <div 
    onClick={onClick}
    className={cn(
      "bg-white p-6 rounded-none border border-zinc-100 shadow-sm hover:shadow-md transition-all duration-300",
      onClick && "cursor-pointer hover:border-[#c11720]/30"
    )}
  >
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
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contrato[]>([]);
  const [distributions, setDistributions] = useState<DistribuicaoDemanda[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [showAtRiskModal, setShowAtRiskModal] = useState(false);
  const [performanceView, setPerformanceView] = useState<'table' | 'chart'>('chart');

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
        // Exclude the contract's main partner from costs, as their value is already deducted from valor_bruto
        if (contract.tem_parceria && colab?.id === contract.parceiro_id) return acc;
        return acc + (Number(d.valor_total) || 0);
      }, 0);
      const net = (Number(contract.valor_bruto) || 0) - costs;
      const margin = (Number(contract.valor_bruto) || 0) > 0 ? (net / Number(contract.valor_bruto)) * 100 : 0;
      const loss = 100 - margin;
      
      return { contract, costs, net, margin, loss };
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
    const medianPartner = getMedian(contractStats.map(s => 
      (Number(s.contract.valor_bruto) > 0 && s.contract.tem_parceria) 
        ? (Number(s.contract.valor_parceiro) / Number(s.contract.valor_bruto)) * 100 
        : 0
    ));
    const atRiskList = contractStats
      .filter(s => s.loss > 30)
      .map(s => ({
        id: s.contract.id,
        nome: s.contract.nome,
        pacote: s.contract.pacote,
        loss: s.loss,
        net: s.net,
        bruto: s.contract.valor_bruto
      }));

    return {
      totalGross,
      totalNet,
      totalCosts,
      medianMargin,
      medianLoss,
      medianPartner,
      contractsAtRisk: atRiskList.length,
      atRiskList,
      contractStats
    };
  };

  const stats = calculateStats();

  const chartData = [
    { name: 'Receita Bruta', value: stats.totalGross, color: '#F2F2F2' },
    { name: 'Receita Líquida', value: stats.totalNet, color: '#0c3249' },
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
          color="bg-[#0c3249] text-white"
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
          color="bg-[#0c3249] text-white"
          trend={stats.medianMargin >= 70 ? 'up' : 'down'}
          trendValue={stats.medianMargin >= 70 ? 'No Alvo' : 'Abaixo'}
        />
        <StatCard 
          title="Contratos em Alerta" 
          value={stats.contractsAtRisk}
          subValue="Perda > 30%"
          icon={AlertCircle}
          color="bg-[#0c3249] text-white"
          onClick={() => stats.contractsAtRisk > 0 && setShowAtRiskModal(true)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-none border border-zinc-100 shadow-sm min-h-[450px] flex flex-col">
          <h3 className="text-xl font-bold mb-6 text-[#c11720]">Performance Financeira Consolidada</h3>
          <div className="flex-1 w-full flex items-center justify-center">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 40, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 14 }} dy={10} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#71717a', fontSize: 14 }} 
                    domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2 / 100) * 100]}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8f9fa' }}
                    contentStyle={{ borderRadius: '0', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '14px' }}
                  />
                  <Bar dataKey="value" radius={0} barSize={60}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                    <LabelList 
                      dataKey="value" 
                      position="top" 
                      formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)}
                      style={{ fontSize: '12px', fontWeight: 'bold', fill: '#71717a' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-8 rounded-none border border-zinc-100 shadow-sm flex flex-col min-h-[450px]">
          <h3 className="text-xl font-bold mb-2 text-[#c11720]">Distribuição de Receita Líquida</h3>
          <p className="text-sm text-zinc-500 mb-6">Mediana de perda aceitável: {stats.medianLoss.toFixed(1)}%</p>
          
          <div className="flex-1 flex items-center justify-center relative w-full">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
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
                    label={({ name, value }) => `${value.toFixed(1)}%`}
                  >
                    <Cell fill="#0c3249" />
                    <Cell fill="#c11720" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          
          <ul className="space-y-3 mt-4">
            <li className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-none bg-[#F2F2F2] border border-zinc-200" />
                <span className="text-zinc-600">Receita Bruta</span>
              </div>
              <span className="font-bold">100%</span>
            </li>
            <li className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-none bg-[#c11720]" />
                <span className="text-[#797575]">Perda Aceitável</span>
              </div>
              <span className="font-bold">{stats.medianLoss.toFixed(1)}%</span>
            </li>
            <li className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-none bg-[#0c3249]" />
                <span className="text-zinc-600">Receita Líquida</span>
              </div>
              <span className={`font-bold ${stats.medianMargin >= 75 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {stats.medianMargin.toFixed(1)}%
              </span>
            </li>
            <li className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-none bg-[#fffbeb] border border-zinc-200" />
                <span className="text-[#cec200]">Valor Parceiro</span>
              </div>
              <span className="font-bold">{stats.medianPartner.toFixed(1)}%</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Seção de Performance por Contrato */}
      <div className="bg-white p-8 rounded-none border border-zinc-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h3 className="text-xl font-bold text-[#c11720]">Performance por Contrato</h3>
            <p className="text-sm text-zinc-500">Comparativo financeiro individual de cada projeto ativo.</p>
          </div>
          <div className="flex bg-zinc-100 p-1 rounded-xl">
            <button 
              onClick={() => setPerformanceView('chart')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                performanceView === 'chart' ? "bg-white text-[#c11720] shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              Gráfico
            </button>
            <button 
              onClick={() => setPerformanceView('table')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                performanceView === 'table' ? "bg-white text-[#c11720] shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              Tabela
            </button>
          </div>
        </div>

        {performanceView === 'chart' ? (
          <div className="h-[450px] w-full">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart 
                    data={stats.contractStats.map((s: any) => ({
                      name: s.contract.nome,
                      bruto: s.contract.valor_bruto,
                      liquido: s.net,
                      parceiro: s.contract.tem_parceria ? s.contract.valor_parceiro : 0,
                      perda: s.loss
                    }))}
                    margin={{ top: 40, right: 30, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#71717a', fontSize: 11, fontWeight: 600 }} 
                      interval={0}
                    />
                    <YAxis 
                      yAxisId="left"
                      width={80}
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#71717a', fontSize: 12 }} 
                      tickFormatter={(value) => `R$ ${value}`}
                      domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2 / 100) * 100]}
                    />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#c11720', fontSize: 12 }} 
                    tickFormatter={(value) => `${value}%`}
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8f9fa' }}
                    contentStyle={{ borderRadius: '0', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px' }}
                    formatter={(value: number, name: string) => {
                      if (name === 'Perda Aceitável') return [`${value.toFixed(1)}%`, name];
                      return [new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value), name];
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="square" 
                    formatter={(value) => {
                      const colors: Record<string, string> = {
                        "Receita Bruta": "#52525b",
                        "Receita Líquida": "#52525b",
                        "Perda Aceitável": "#797575",
                        "Valor Parceiro": "#cec200"
                      };
                      return <span style={{ color: colors[value], fontWeight: 700, fontSize: '12px', marginLeft: '4px' }}>{value}</span>;
                    }}
                  />
                  <Bar yAxisId="left" dataKey="bruto" name="Receita Bruta" fill="#F2F2F2" barSize={40}>
                    <LabelList 
                      dataKey="bruto" 
                      position="top" 
                      formatter={(value: number) => `R$ ${value}`}
                      style={{ fontSize: '10px', fontWeight: 'bold', fill: '#71717a' }}
                    />
                  </Bar>
                  <Bar yAxisId="left" dataKey="liquido" name="Receita Líquida" fill="#0c3249" barSize={40}>
                    <LabelList 
                      dataKey="liquido" 
                      position="top" 
                      formatter={(value: number) => `R$ ${value}`}
                      style={{ fontSize: '10px', fontWeight: 'bold', fill: '#0c3249' }}
                    />
                  </Bar>
                  <Bar yAxisId="left" dataKey="parceiro" name="Valor Parceiro" fill="#fffbeb" barSize={40}>
                    <LabelList 
                      dataKey="parceiro" 
                      position="top" 
                      formatter={(value: number) => value > 0 ? `R$ ${value}` : ''}
                      style={{ fontSize: '10px', fontWeight: 'bold', fill: '#cec200' }}
                    />
                  </Bar>
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="perda" 
                    name="Perda Aceitável" 
                    stroke="#c11720" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#c11720', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6 }}
                    label={(props: any) => {
                      const { x, y, value } = props;
                      // Se o ponto estiver na parte superior do gráfico (y < 200), 
                      // posiciona o label abaixo do ponto para evitar colisão com o topo das barras
                      const isHigh = y < 200;
                      const rectY = isHigh ? y + 10 : y - 25;
                      const textY = isHigh ? y + 22 : y - 13;
                      
                      return (
                        <g>
                          <rect x={x - 20} y={rectY} width={40} height={16} fill="#c11720" rx={4} />
                          <text x={x} y={textY} textAnchor="middle" fill="#fff" fontSize="10px" fontWeight="bold">
                            {value.toFixed(1)}%
                          </text>
                        </g>
                      );
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="pb-4 text-xs font-bold text-[#0c3249] uppercase tracking-wider">Contrato</th>
                  <th className="pb-4 text-xs font-bold text-[#0c3249] uppercase tracking-wider">Receita Bruta</th>
                  <th className="pb-4 text-xs font-bold text-[#0c3249] uppercase tracking-wider">Receita Líquida</th>
                  <th className="pb-4 text-xs font-bold text-[#0c3249] uppercase tracking-wider">Valor Parceiro</th>
                  <th className="pb-4 text-xs font-bold text-[#0c3249] uppercase tracking-wider">Perda Aceitável</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {stats.contractStats.map((s: any) => (
                  <tr 
                    key={s.contract.id} 
                    className="hover:bg-zinc-50 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/contratos/${s.contract.id}`)}
                  >
                    <td className="py-4">
                      <p className="font-bold text-zinc-900 group-hover:text-[#c11720] transition-colors">{s.contract.nome}</p>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase">{s.contract.pacote}</p>
                    </td>
                    <td className="py-4 text-sm text-zinc-600">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.contract.valor_bruto)}
                    </td>
                    <td className="py-4">
                      <span className={`text-sm font-bold ${s.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.net)}
                      </span>
                    </td>
                    <td className="py-4 text-sm text-zinc-600">
                      {s.contract.tem_parceria 
                        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.contract.valor_parceiro)
                        : <span className="text-zinc-300">N/A</span>
                      }
                    </td>
                    <td className="py-4">
                      <span className={`text-sm font-bold ${s.loss <= 30 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {s.loss.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Contratos em Alerta */}
      {showAtRiskModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-none p-8 animate-slide-up shadow-2xl border border-zinc-200">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#c11720] flex items-center gap-2">
                  <AlertCircle size={24} />
                  Contratos em Alerta
                </h2>
                <p className="text-zinc-500 text-sm mt-1">Contratos com perda aceitável superior a 30%.</p>
              </div>
              <button 
                onClick={() => setShowAtRiskModal(false)}
                className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400 hover:text-zinc-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {stats.atRiskList.map((item: any) => (
                <div 
                  key={item.id} 
                  className="p-4 bg-zinc-50 border border-zinc-100 flex items-center justify-between hover:border-[#c11720]/30 transition-colors group cursor-pointer"
                  onClick={() => {
                    setShowAtRiskModal(false);
                    navigate(`/contratos/${item.id}`);
                  }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-zinc-900 group-hover:text-[#c11720] transition-colors">{item.nome}</p>
                      <span className="text-[10px] bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full font-bold uppercase">{item.pacote}</span>
                    </div>
                    <div className="flex gap-4 mt-1">
                      <p className="text-xs text-zinc-500">
                        Bruto: <span className="font-medium text-zinc-700">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.bruto)}</span>
                      </p>
                      <p className="text-xs text-zinc-500">
                        Líquido: <span className="font-medium text-zinc-700">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.net)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-rose-600">{item.loss.toFixed(1)}%</p>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Perda</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-end">
              <button 
                onClick={() => setShowAtRiskModal(false)}
                className="px-6 py-2 bg-zinc-900 text-white font-bold text-sm hover:bg-black transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
