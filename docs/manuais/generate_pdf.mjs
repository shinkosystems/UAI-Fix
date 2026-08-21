import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const manuals = [
  {
    html: 'Manual_Cliente_UaiFix.html',
    pdf: 'Manual_Cliente_UaiFix.pdf',
    title: 'Manual do Cliente — UAI-Fix'
  },
  {
    html: 'Manual_Profissional_UaiFix.html',
    pdf: 'Manual_Profissional_UaiFix.pdf',
    title: 'Manual do Profissional — UAI-Fix'
  },
  {
    html: 'Manual_Gestor_UaiFix.html',
    pdf: 'Manual_Gestor_UaiFix.pdf',
    title: 'Manual do Gestor & Administrador — UAI-Fix'
  }
];

async function generatePDFs() {
  console.log('🚀 Iniciando renderização dos Manuais UAI-Fix em PDF com Playwright...');
  const browser = await chromium.launch({
    headless: true
  });

  for (const item of manuals) {
    const htmlPath = path.join(__dirname, item.html);
    const pdfPath = path.join(__dirname, item.pdf);

    if (!fs.existsSync(htmlPath)) {
      console.error(`❌ Arquivo não encontrado: ${htmlPath}`);
      continue;
    }

    console.log(`📄 Gerando: ${item.title} -> ${item.pdf}...`);
    const page = await browser.newPage();
    
    // Carrega o arquivo HTML local
    await page.goto(`file://${htmlPath}`, {
      waitUntil: 'networkidle'
    });

    // Aguarda carregamento de fontes
    await page.evaluateHandle('document.fonts.ready');

    // Gera o PDF no formato A4
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '15mm',
        bottom: '15mm',
        left: '12mm',
        right: '12mm'
      }
    });

    const stats = fs.statSync(pdfPath);
    console.log(`✅ Gerado com sucesso: ${item.pdf} (${(stats.size / 1024).toFixed(1)} KB)`);
    await page.close();
  }

  await browser.close();
  console.log('🎉 Todos os manuais em PDF foram compilados com sucesso!');
}

generatePDFs().catch((err) => {
  console.error('❌ Erro na geração dos PDFs:', err);
  process.exit(1);
});
