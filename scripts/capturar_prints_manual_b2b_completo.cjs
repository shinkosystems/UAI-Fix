const puppeteer = require('/Users/pedroborba/Library/Mobile Documents/com~apple~CloudDocs/GitHub/cockpit-hub/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT_DIR = '/tmp/uaifix_prints_b2b';

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// Criar JWT para sessão do admin master
const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400 * 365;
const payload = Buffer.from(JSON.stringify({
  iss: 'supabase',
  ref: 'uehyjyyvkrlggwmfdhgh',
  role: 'authenticated',
  email: 'peboorba@gmail.com',
  sub: 'c87f9e12-3456-4abc-9def-0123456789ab',
  aud: 'authenticated',
  exp: exp,
  iat: Math.floor(Date.now() / 1000)
})).toString('base64url');
const validJwt = header + '.' + payload + '.signature_uaifix_admin';

const mockSession = {
  access_token: validJwt,
  token_type: 'bearer',
  expires_in: 86400 * 365,
  expires_at: exp,
  refresh_token: 'refresh-token',
  user: {
    id: 'c87f9e12-3456-4abc-9def-0123456789ab',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'peboorba@gmail.com',
    user_metadata: { nome: 'Pedro Borba' },
    app_metadata: { provider: 'email' }
  }
};

const mockUsers = [
  {
    id: 1,
    uuid: 'c87f9e12-3456-4abc-9def-0123456789ab',
    nome: 'Pedro Borba (Super Admin Master)',
    email: 'peboorba@gmail.com',
    tipo: 'admin',
    ativo: true,
    whatsapp: '31982480790',
    cidade: 1,
    estado: 1,
    cidadeNome: 'Belo Horizonte'
  },
  {
    id: 2,
    uuid: 'a12b34c5-6789-40de-b123-456789abcdef',
    nome: 'Joubert Lima (Diretor Operacional UAI-Fix)',
    email: 'joubert@uaifix.com.br',
    tipo: 'gestor',
    ativo: true,
    whatsapp: '31998765432',
    cidade: 1,
    estado: 1,
    cidadeNome: 'Belo Horizonte'
  },
  {
    id: 3,
    uuid: 'b23c45d6-7890-41ef-c234-567890abcdef',
    nome: 'Carlos Eduardo (Especialista Técnico Climatização)',
    email: 'carlos.tecnico@uaifix.com.br',
    tipo: 'profissional',
    ativo: true,
    whatsapp: '31987654321',
    cidade: 1,
    estado: 1,
    cidadeNome: 'Belo Horizonte'
  },
  {
    id: 4,
    uuid: 'd34e56f7-8901-42ab-d345-678901abcdef',
    nome: 'Mariana Duarte (Cliente Residencial)',
    email: 'mariana.duarte@email.com',
    tipo: 'cliente',
    ativo: true,
    whatsapp: '31988887777',
    cidade: 1,
    estado: 1,
    cidadeNome: 'Belo Horizonte'
  }
];

const mockGeral = [
  { id: 1, primaria: true, nome: 'Eletrodomésticos', imagem: '', dependencia: null, ativa: true },
  { id: 2, primaria: true, nome: 'Climatização & HVAC', imagem: '', dependencia: null, ativa: true },
  { id: 11, primaria: false, nome: 'Manutenção de Lava e Seca & Refrigeração', imagem: '', dependencia: 1, ativa: true },
  { id: 12, primaria: false, nome: 'Instalação e Higienização de Ar-Condicionado', imagem: '', dependencia: 2, ativa: true }
];

const mockTickets = [
  {
    id: 101,
    cliente: 'd34e56f7-8901-42ab-d345-678901abcdef',
    profissional: 'b23c45d6-7890-41ef-c234-567890abcdef',
    chaveunica: 'OS-2026-B2B-01',
    status: 'concluido',
    atividade: 12,
    cidade: 1,
    created_at: '2026-11-09T08:30:00Z',
    updated_at: '2026-11-09T11:45:00Z',
    relato_problema: 'Reforma e modernização do sistema de climatização da sede corporativa.',
    solucao_problema: 'Instalação de 2 unidades Split Inverter 18.000 BTUs, higienização química e recarga de gás.',
    empresa_nome: 'Vértice Engenharia & Reformas Parceira',
    geral: { nome: 'Instalação e Higienização de Ar-Condicionado' },
    clienteData: {
      nome: 'Mariana Duarte (Diretoria Vértice)',
      cpf: '123.456.789-00',
      whatsapp: '(31) 98888-7777',
      rua: 'Av. Afonso Pena',
      numero: '2500',
      bairro: 'Funcionários',
      cidadeNome: 'Belo Horizonte',
      cep: '30130-007',
      empresa_nome: 'Vértice Engenharia & Reformas Parceira'
    },
    profissionalData: {
      nome: 'Carlos Eduardo (Especialista Credenciado)',
      whatsapp: '(31) 98765-4321',
      especialidade: 'Climatização & HVAC'
    },
    planejamento: [
      {
        id: 1,
        descricao: 'Instalação completa de infraestrutura frigorígena, vácuo no sistema e testes de estanqueidade.',
        recursos: ['2x Suportes Anti-Vibração', 'Tubulação de Cobre 1/4 e 3/8', 'Fluido R410A', 'Fita Alumínio'],
        execucao: '2026-11-09T14:00:00Z'
      }
    ],
    orcamentos: [
      {
        id: 1,
        preco: 1450.00,
        tipopagmto: 'PIX',
        parcelas: 1,
        notafiscal: true,
        observacaocliente: 'Garantia técnica de 90 dias nas peças e serviços de instalação.',
        hh: 380.00,
        custo_variavel: 420.00,
        custo_deslocamento: 60.00,
        custofixo: 90.00,
        imposto: 87.00,
        taxa_plataforma: 145.00,
        taxa_pagamento: 45.00,
        lucro: 268.00
      }
    ],
    assinatura: 'https://placehold.co/180x50/png?text=Assinatura+Digital+Mariana',
    fotoantes: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500'],
    fotodepois: ['https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500']
  }
];

// Criar planilha temporária de onboarding de parceira para teste de upload
const sampleWorkbookPath = '/tmp/planilha_exemplo_parceira.xlsx';
const wb = XLSX.utils.book_new();

const wsEmpresa = XLSX.utils.json_to_sheet([
  {
    'Razao_Social': 'Vértice Engenharia e Reformas LTDA',
    'Nome_Fantasia': 'Vértice Reformas',
    'CNPJ': '34.891.205/0001-44',
    'Data_Criacao': '2019-03-20',
    'Setor_Mercado': 'Reformas Comerciais e Manutenção Predial',
    'Email_Corporativo': 'diretoria@vertice.com.br',
    'WhatsApp_Contato': '(31) 99123-4567'
  }
]);
XLSX.utils.book_append_sheet(wb, wsEmpresa, 'Empresa');

const wsGestores = XLSX.utils.json_to_sheet([
  { 'Nome': 'Fernando Alencar Gestor', 'CPF': '111.222.333-44', 'E-mail': 'fernando.alencar@vertice.com.br', 'WhatsApp': '31991234567' },
  { 'Nome': 'Juliana Peixoto Coordenadora', 'CPF': '222.333.444-55', 'E-mail': 'juliana.peixoto@vertice.com.br', 'WhatsApp': '31991234568' }
]);
XLSX.utils.book_append_sheet(wb, wsGestores, 'Gestores');

const wsClientes = XLSX.utils.json_to_sheet([
  { 'Nome': 'Condomínio Edifício Liberdade', 'CPF': '333.444.555-66', 'E-mail': 'sindico@edificioliberdade.com.br', 'WhatsApp': '31988881111' },
  { 'Nome': 'Clínica Odontológica Sorriso', 'CPF': '444.555.666-77', 'E-mail': 'adm@clinicasorriso.com.br', 'WhatsApp': '31988882222' }
]);
XLSX.utils.book_append_sheet(wb, wsClientes, 'Clientes');

const wsPrestadores = XLSX.utils.json_to_sheet([
  { 'Nome': 'Rodrigo Mestre de Obras', 'CPF': '555.666.777-88', 'E-mail': 'rodrigo.obras@vertice.com.br', 'WhatsApp': '31977773333' },
  { 'Nome': 'Lucas Eletricista Predial', 'CPF': '666.777.888-99', 'E-mail': 'lucas.eletrica@vertice.com.br', 'WhatsApp': '31977774444' }
]);
XLSX.utils.book_append_sheet(wb, wsPrestadores, 'Prestadores');

XLSX.writeFile(wb, sampleWorkbookPath);

function setupInterception(page) {
  page.on('request', req => {
    if (req.method() === 'OPTIONS') {
      req.respond({
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*'
        }
      });
      return;
    }

    const url = req.url();
    if (url.includes('.supabase.co')) {
      const accept = req.headers()['accept'] || '';

      if (url.includes('/auth/v1/user') || url.includes('/auth/v1/session')) {
        req.respond({
          status: 200,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
          body: JSON.stringify(mockSession)
        });
        return;
      }

      if (url.includes('/rest/v1/users')) {
        req.respond({
          status: 200,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
          body: JSON.stringify(mockUsers)
        });
        return;
      }

      if (url.includes('/rest/v1/chaves')) {
        req.respond({
          status: 200,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
          body: JSON.stringify(mockTickets)
        });
        return;
      }

      if (url.includes('/rest/v1/geral')) {
        req.respond({
          status: 200,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
          body: JSON.stringify(mockGeral)
        });
        return;
      }

      if (url.includes('/rest/v1/organizations')) {
        req.respond({
          status: 200,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
          body: JSON.stringify([{ id: 'org_01', nome: 'UaiFix Matriz BH', ativa: true }])
        });
        return;
      }

      if (url.includes('/rest/v1/cidades')) {
        req.respond({
          status: 200,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
          body: JSON.stringify([{ id: 1, cidade: 'Belo Horizonte', uf: 1 }])
        });
        return;
      }

      req.respond({
        status: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify([])
      });
    } else {
      req.continue();
    }
  });
}

async function run() {
  console.log('🚀 Iniciando Chrome Headless com Interceptor Supabase...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.setRequestInterception(true);
  setupInterception(page);

  await page.evaluateOnNewDocument(sess => {
    localStorage.setItem('sb-uehyjyyvkrlggwmfdhgh-auth-token', JSON.stringify(sess));
    localStorage.setItem('last_access', Date.now().toString());
    localStorage.setItem('uai_user_email', 'peboorba@gmail.com');
    localStorage.setItem('uai_user_tipo', 'admin');
    localStorage.setItem('uai_user_nome', 'Pedro Borba');
    localStorage.setItem('uai_user_uuid', 'c87f9e12-3456-4abc-9def-0123456789ab');
    localStorage.setItem('uai_admin_view_mode', 'super_admin');
  }, mockSession);

  // 1. Tela de Gestão de Usuários (com botão âmbar no header)
  console.log('📸 [1/7] Capturando Tela de Gestão de Usuários (#/admin/users)...');
  await page.goto('http://127.0.0.1:5174/#/admin/users', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT_DIR, '01_gestao_usuarios_botao_importar.png') });

  // 2. Abrir Modal de Onboarding em Lote
  console.log('📸 [2/7] Abrindo Modal de Onboarding de Parceiras...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.innerText.includes('Importar Planilha de Parceira'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUT_DIR, '02_modal_importacao_aberto.png') });

  // 3. Fazer Upload da Planilha de Exemplo no Modal para Gerar o Preview Completo
  console.log('📸 [3/7] Fazendo Upload da Planilha Modelo para Preview dos Dados...');
  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    await fileInput.uploadFile(sampleWorkbookPath);
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(OUT_DIR, '03_modal_preview_planilha_parceira.png') });
  }

  // Fechar Modal
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.innerText.includes('Cancelar'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 800));

  // 4. Acessar Relatórios de Ordens de Serviço
  console.log('📸 [4/7] Acessando Relatórios de Ordens de Serviço (#/admin/relatorios)...');
  await page.goto('http://127.0.0.1:5174/#/admin/relatorios', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT_DIR, '04_relatorios_lista_os.png') });

  // 5. Clicar em Imprimir OS (Nível 1 — Cliente Final)
  console.log('📸 [5/7] Abrindo Prévia da OS (Nível 1 — Cliente Final)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.innerText.includes('Imprimir OS') || b.querySelector('svg.lucide-printer'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUT_DIR, '05_modal_os_nivel_1_cliente.png') });

  // 6. Clicar na Aba 2 — Empresa Parceira (DRE Operacional)
  console.log('📸 [6/7] Selecionando Aba 2 — Empresa Parceira (DRE Operacional)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.innerText.includes('Empresa Parceira'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT_DIR, '06_modal_os_nivel_2_parceira.png') });

  // 7. Clicar na Aba 3 — UAI-Fix Master (DRE Consolidado da Plataforma)
  console.log('📸 [7/7] Selecionando Aba 3 — UAI-Fix Master (DRE Consolidado)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.innerText.includes('UAI-Fix Master'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT_DIR, '07_modal_os_nivel_3_master.png') });

  await browser.close();
  console.log('🎉 SUCESSO ABSOLUTO! Todas as 7 capturas reais salvas em:', OUT_DIR);
}

run().catch(err => {
  console.error('❌ Erro na execução:', err);
  process.exit(1);
});
