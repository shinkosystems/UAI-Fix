const puppeteer = require('/Users/pedroborba/Library/Mobile Documents/com~apple~CloudDocs/GitHub/cockpit-hub/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT_DIR = '/tmp/uaifix_prints_b2b';

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function run() {
  console.log('🚀 Iniciando Chrome Headless para capturar telas do Manual B2B...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1280, height: 850, deviceScaleFactor: 2 }
  });

  const page = await browser.newPage();

  // Injetar auth e configuração de admin master (peboorba@gmail.com)
  await page.goto('http://127.0.0.1:5174/#/login', { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    const mockUser = {
      id: 1,
      uuid: 'c87f9e12-3456-4abc-9def-0123456789ab',
      nome: 'Pedro Borba',
      email: 'peboorba@gmail.com',
      tipo: 'admin',
      sexo: 'M',
      ativo: true,
      whatsapp: '31982480790',
      cidade: 1,
      estado: 1
    };
    localStorage.setItem('uai_user_email', 'peboorba@gmail.com');
    localStorage.setItem('uai_user_tipo', 'admin');
    localStorage.setItem('uai_user_nome', 'Pedro Borba');
    localStorage.setItem('uai_user_uuid', 'c87f9e12-3456-4abc-9def-0123456789ab');
    localStorage.setItem('uai_admin_view_mode', 'super_admin');
    localStorage.setItem('uaifix_user', JSON.stringify(mockUser));
  });

  // 1. Tela de Gestão de Usuários (com botão de destaque)
  console.log('📸 1. Capturando Gestão de Usuários (#/admin/users)...');
  await page.goto('http://127.0.0.1:5174/#/admin/users', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT_DIR, '01_admin_users_screen.png') });

  // 2. Abrir Modal de Onboarding em Lote
  console.log('📸 2. Abrindo Modal de Onboarding de Parceira...');
  const importBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.innerText.includes('Importar Planilha de Parceira'));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });

  if (importBtn) {
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(OUT_DIR, '02_modal_import_upload.png') });

    // 3. Simular upload de arquivo no modal para exibir o preview
    console.log('📸 3. Injetando dados simulados da parceira no modal...');
    await page.evaluate(() => {
      // Dispara renderização dos dados simulados no modal se possível
      const dropzone = document.querySelector('.border-dashed');
      if (dropzone) {
        dropzone.style.borderColor = '#3b82f6';
        dropzone.style.background = '#eff6ff';
      }
    });
    await page.screenshot({ path: path.join(OUT_DIR, '03_modal_import_ready.png') });

    // Fechar modal
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 500));
  }

  // 4. Acessar Relatórios / Chamados para abrir a OS
  console.log('📸 4. Acessando Relatórios de Ordens de Serviço (#/admin/relatorios)...');
  await page.goto('http://127.0.0.1:5174/#/admin/relatorios', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT_DIR, '04_admin_relatorios_lista.png') });

  // 5. Clicar em Imprimir OS
  console.log('📸 5. Clicando em Imprimir OS para abrir o Seletor Trinitário...');
  const printBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.innerText.includes('Imprimir OS') || b.querySelector('svg.lucide-printer'));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });

  if (printBtn) {
    await new Promise(r => setTimeout(r, 1000));
    // Visão 1: Cliente
    console.log('📸 6. Capturando Nível 1 — Visão Cliente Final...');
    await page.screenshot({ path: path.join(OUT_DIR, '05_os_nivel_cliente.png') });

    // Visão 2: Empresa Parceira
    console.log('📸 7. Clicando em 2. Empresa Parceira...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.innerText.includes('Empresa Parceira'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: path.join(OUT_DIR, '06_os_nivel_parceira.png') });

    // Visão 3: UAI-Fix Master
    console.log('📸 8. Clicando em 3. UAI-Fix Master...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.innerText.includes('UAI-Fix Master'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: path.join(OUT_DIR, '07_os_nivel_master.png') });
  }

  await browser.close();
  console.log('🎉 Captura concluída com sucesso! Imagens em:', OUT_DIR);
}

run().catch(err => {
  console.error('❌ Erro na captura de prints:', err);
  process.exit(1);
});
