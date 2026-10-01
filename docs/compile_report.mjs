import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const htmlPath = path.join(__dirname, 'RELATORIO_EVOLUCAO_MULTI_TENANT_E_GOVERNANCA_UAIFIX.html');
const desktopPdfPath = '/Users/pedroborba/Desktop/RELATORIO_EVOLUCAO_MULTI_TENANT_E_GOVERNANCA_UAIFIX.pdf';
const projectPdfPath = path.join(__dirname, 'RELATORIO_EVOLUCAO_MULTI_TENANT_E_GOVERNANCA_UAIFIX.pdf');
const cockpitPdfPath = '/Users/pedroborba/.gemini/antigravity/scratch/cockpit-hub/docs/dossie/RELATORIO_EVOLUCAO_MULTI_TENANT_E_GOVERNANCA_UAIFIX.pdf';

async function generatePDF() {
  console.log('🚀 Iniciando geração do Relatório Executivo em PDF...');
  
  if (!fs.existsSync(htmlPath)) {
    console.error(`❌ Arquivo HTML não encontrado: ${htmlPath}`);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log(`📄 Carregando HTML: ${htmlPath}`);
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
  await page.evaluateHandle('document.fonts.ready');

  console.log(`💾 Compilando PDF A4 na Mesa: ${desktopPdfPath}`);
  await page.pdf({
    path: desktopPdfPath,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: {
      top: '12mm',
      bottom: '12mm',
      left: '12mm',
      right: '12mm'
    }
  });

  // Copia também para o diretório de docs do projeto e do cockpit
  fs.copyFileSync(desktopPdfPath, projectPdfPath);
  if (fs.existsSync(path.dirname(cockpitPdfPath))) {
    fs.copyFileSync(desktopPdfPath, cockpitPdfPath);
  }

  const stats = fs.statSync(desktopPdfPath);
  console.log(`✅ PDF gerado com sucesso na Mesa: ${desktopPdfPath} (${(stats.size / 1024).toFixed(1)} KB)`);

  await browser.close();
}

generatePDF().catch(err => {
  console.error('❌ Erro na compilação do PDF:', err);
  process.exit(1);
});
