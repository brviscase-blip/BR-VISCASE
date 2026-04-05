import { supabase } from '../supabase';
import { Contrato, DemandaContrato, DistribuicaoDemanda } from '../types';

export const inheritMonthData = async (fromMonth: string, toMonth: string) => {
  try {
    // Check if toMonth already has contracts
    const { data: toContracts, error: toContractsError } = await supabase
      .from('BR_Gestão_de_Contratos.contratos')
      .select('*')
      .eq('mes_ano', toMonth);

    if (toContractsError) throw toContractsError;
    
    if (toContracts && toContracts.length > 0) {
      return false; // Already has data, no need to inherit
    }

    // Get fromMonth contracts
    const { data: fromContracts, error: fromContractsError } = await supabase
      .from('BR_Gestão_de_Contratos.contratos')
      .select('*');

    if (fromContractsError) throw fromContractsError;
    
    const contractsToInherit = fromContracts?.filter(c => {
      return c.mes_ano === fromMonth || (!c.mes_ano && fromMonth === '2026-04');
    }) || [];

    if (contractsToInherit.length === 0) {
      return false; // Nothing to inherit
    }

    // For each contract, copy it, its demands, and its distributions
    for (const contractData of contractsToInherit) {
      const oldContractId = contractData.id;

      // Copy contract data, update mes_ano, reset payment statuses
      const newContractData = {
        ...contractData,
        mes_ano: toMonth,
        status_pagamento_1q: 'Pendente',
        status_pagamento_2q: 'Pendente',
        data_pagamento_1q: null,
        data_pagamento_2q: null
      };
      delete (newContractData as any).id;
      
      const { data: newContract, error: insertContractError } = await supabase
        .from('BR_Gestão_de_Contratos.contratos')
        .insert(newContractData)
        .select()
        .single();

      if (insertContractError) throw insertContractError;
      const newContractId = newContract.id;

      // Get demands for this contract
      const { data: demands, error: demandsError } = await supabase
        .from('BR_Gestão_de_Contratos.demandas')
        .select('*')
        .eq('contrato_id', oldContractId);
      
      if (demandsError) throw demandsError;
      
      for (const demandaData of demands || []) {
        const newDemandaData = {
          ...demandaData,
          contrato_id: newContractId,
          mes_ano: toMonth
        };
        delete (newDemandaData as any).id;
        
        const { error: insertDemandaError } = await supabase
          .from('BR_Gestão_de_Contratos.demandas')
          .insert(newDemandaData);
        if (insertDemandaError) throw insertDemandaError;
      }

      // Get distributions for this contract
      const { data: dists, error: distsError } = await supabase
        .from('BR_Gestão_de_Contratos.distribuicao_demandas')
        .select('*')
        .eq('contrato_id', oldContractId);
      
      if (distsError) throw distsError;
      
      for (const distData of dists || []) {
        const newDistData = {
          ...distData,
          contrato_id: newContractId,
          mes_ano: toMonth,
          quantidade_concluida: 0,
          quantidade_paga: 0
        };
        delete (newDistData as any).id;
        
        const { error: insertDistError } = await supabase
          .from('BR_Gestão_de_Contratos.distribuicao_demandas')
          .insert(newDistData);
        if (insertDistError) throw insertDistError;
      }
    }

    return true;
  } catch (error) {
    console.error("Error inheriting month data:", error);
    return false;
  }
};
