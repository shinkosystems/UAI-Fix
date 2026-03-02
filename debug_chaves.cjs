
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uehyjyyvkrlggwmfdhgh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlaHlqeXl2a3JsZ2d3bWZkaGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0MDEzNzUsImV4cCI6MjA1Nzk3NzM3NX0.3CKTTryjia-5nXQYk1jJxPYryDmF1hTKpHrJkVKqRJY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkPros() {
    const { data: pros } = await supabase.from('users').select('uuid, nome');
    const { data: concludedOrders } = await supabase.from('chaves').select('profissional').eq('status', 'concluido');
    const { data: rats } = await supabase.from('avaliacoes').select('profissional, nota');
    const { data: allEvaluations } = await supabase.from('avaliacoes').select('nota');

    const globalMeanC = allEvaluations.length > 0
        ? allEvaluations.reduce((acc, curr) => acc + (curr.nota || 0), 0) / allEvaluations.length
        : 0;

    const m = 5;
    const counts = {};
    concludedOrders.forEach(o => { if (o.profissional) counts[o.profissional] = (counts[o.profissional] || 0) + 1; });

    const stats = pros.map(p => {
        const count = counts[p.uuid] || 0;
        const pRats = rats.filter(r => r.profissional === p.uuid);
        const v = pRats.length;
        const R = v > 0 ? pRats.reduce((a, b) => a + b.nota, 0) / v : 0;
        const weightedRating = v > 0 ? (v / (v + m)) * R + (m / (v + m)) * globalMeanC : 0;
        const rankingScore = weightedRating + (count * 0.1);
        return { ...p, count, rating: R, v, weightedRating, rankingScore };
    });

    console.log(`Global Mean C: ${globalMeanC}`);

    console.log('--- RANKING BY CONCLUDED ORDERS (chaves table) ---');
    stats.sort((a, b) => b.rankingScore - a.rankingScore).forEach(p => {
        if (p.count > 0 || p.v > 0) {
            console.log(`${p.rankingScore.toFixed(2)} Score | ${p.count} concluded | ${p.rating.toFixed(1)} (${p.v} rats) | ${p.nome}`);
        }
    });
}

checkPros();
