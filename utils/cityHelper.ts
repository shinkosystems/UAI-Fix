import { supabase } from '../supabaseClient';
import { City } from '../types';

/**
 * Busca uma cidade na tabela 'cidades' pelo nome e código UF.
 * Se a cidade não for encontrada, ela é automaticamente cadastrada (Auto-provisioning)
 * na tabela 'cidades' do Supabase e a nova entidade com seu ID é retornada.
 */
export async function getOrProvisionCity(cityName: string, ufCode?: string): Promise<City | null> {
    if (!cityName || !cityName.trim()) return null;

    const rawCity = cityName.trim();
    const normalizedCity = rawCity.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    try {
        let estadoId: number | null = null;

        // 1. Tenta identificar a UF se o código de estado for informado (ex: "MG", "SP")
        if (ufCode && ufCode.trim()) {
            const cleanUf = ufCode.trim().toUpperCase();
            const { data: estadoData } = await supabase
                .from('estados')
                .select('id')
                .ilike('uf', cleanUf)
                .maybeSingle();

            if (estadoData) {
                estadoId = estadoData.id;
            } else {
                // Se o estado não existir, cadastra dinamicamente
                const { data: newEstado } = await supabase
                    .from('estados')
                    .insert({ uf: cleanUf })
                    .select('id')
                    .single();
                if (newEstado) estadoId = newEstado.id;
            }
        }

        // 2. Tenta buscar a cidade existente no banco
        let query = supabase.from('cidades').select('*');
        if (estadoId) {
            query = query.eq('uf', estadoId);
        }

        const { data: exactCities } = await query.ilike('cidade', rawCity).limit(5);

        if (exactCities && exactCities.length > 0) {
            const exactMatch = exactCities.find(c =>
                c.cidade.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normalizedCity
            );
            if (exactMatch) return exactMatch;
            return exactCities[0];
        }

        // 3. Tenta busca aproximada (fuzzy/ilike parcial)
        const firstWord = rawCity.split(' ')[0];
        if (firstWord && firstWord.length > 3) {
            let fuzzyQuery = supabase.from('cidades').select('*');
            if (estadoId) fuzzyQuery = fuzzyQuery.eq('uf', estadoId);

            const { data: fuzzyCities } = await fuzzyQuery.ilike('cidade', `%${firstWord}%`).limit(1);
            if (fuzzyCities && fuzzyCities.length > 0) {
                return fuzzyCities[0];
            }
        }

        // 4. AUTO-PROVISIONING: A cidade não existe no banco, insere automaticamente!
        // Se estadoId ainda não for conhecido, tenta buscar Minas Gerais (uf: 'MG') ou fallback id 1
        if (!estadoId) {
            const { data: fallbackEstado } = await supabase
                .from('estados')
                .select('id')
                .limit(1)
                .single();
            estadoId = fallbackEstado?.id || 1;
        }

        const { data: insertedCity, error: insertError } = await supabase
            .from('cidades')
            .insert({
                cidade: rawCity,
                uf: estadoId
            })
            .select('*')
            .single();

        if (insertError) {
            console.error('Erro ao auto-provisionar cidade:', insertError);
            return null;
        }

        return insertedCity;
    } catch (err) {
        console.error('Erro em getOrProvisionCity:', err);
        return null;
    }
}
