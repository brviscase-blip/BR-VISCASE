import { Timestamp } from 'firebase/firestore';

export type Pacote = 
  | "Starter Master Acessível"
  | "Nível Pro Acessível"
  | "Master Potencial"
  | "Nível Pro Potencial"
  | "Starter";

export type StatusContrato = "Ativo" | "Inativo" | "Encerrado";
export type StatusPagamento = "Pendente" | "Pago" | "Atrasado";
export type TipoDemanda = "Criativo" | "Carrossel" | "Gestão de Conteúdo" | "Captação" | "Vídeo";
export type TipoColaborador = "Equipe" | "Proprietário" | "Parceria";

export interface Contrato {
  id: string;
  nome: string;
  pacote: Pacote;
  valor_bruto: number; // Valor da Agência (ex: 850)
  valor_total_cliente?: number; // Valor Total pago pelo cliente (ex: 1250)
  tem_parceria?: boolean;
  parceiro_id?: string;
  valor_parceiro?: number;
  status: StatusContrato;
  data_pagamento_1q: string;
  data_pagamento_2q: string;
  status_pagamento_1q: StatusPagamento;
  status_pagamento_2q: StatusPagamento;
  valor_pagamento_1q?: number;
  valor_pagamento_2q?: number;
  uid: string;
  created_at?: Timestamp;
}

export interface DemandaContrato {
  id: string;
  contrato_id: string;
  tipo_demanda: TipoDemanda;
  quantidade_total: number;
}

export interface Colaborador {
  id: string;
  nome: string;
  tipo: TipoColaborador;
  salario_fixo: number;
  uid?: string;
}

export interface DistribuicaoDemanda {
  id: string;
  contrato_id: string;
  colaborador_id: string;
  tipo_demanda: TipoDemanda;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  quantidade_concluida?: number;
  quantidade_paga?: number;
}

export const PRECOS_DEMANDAS: Record<TipoDemanda, number> = {
  "Criativo": 12.00,
  "Carrossel": 17.00,
  "Gestão de Conteúdo": 150.00,
  "Captação": 50.00,
  "Vídeo": 40.00
};
