#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gerar_manual_b2b_pdf.py — Manual Operacional Passo a Passo com Telas Reais
Recursos: Onboarding em Lote de Parceiras & Precificação em 3 Níveis de OS
Liderança: Pedro Borba · Shinkō Systems
Governança: Regra 10 (Arial TTF 'ō' Zero-Tofu) · Regra 12 (Prints Reais de Produção)
"""

import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Image, PageBreak
)
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Registro de Fontes TrueType Unicode
font_dir = '/System/Library/Fonts/Supplemental'
try:
    if os.path.exists(os.path.join(font_dir, 'Arial.ttf')):
        pdfmetrics.registerFont(TTFont('Arial', os.path.join(font_dir, 'Arial.ttf')))
        pdfmetrics.registerFont(TTFont('Arial-Bold', os.path.join(font_dir, 'Arial Bold.ttf')))
        pdfmetrics.registerFont(TTFont('Arial-Italic', os.path.join(font_dir, 'Arial Italic.ttf')))
        FONT_NORM = 'Arial'
        FONT_BOLD = 'Arial-Bold'
        FONT_ITAL = 'Arial-Italic'
    else:
        FONT_NORM = 'Helvetica'
        FONT_BOLD = 'Helvetica-Bold'
        FONT_ITAL = 'Helvetica-Oblique'
except Exception:
    FONT_NORM = 'Helvetica'
    FONT_BOLD = 'Helvetica-Bold'
    FONT_ITAL = 'Helvetica-Oblique'

# Paleta UaiFix + Shinkō Systems
UAIFIX_BLUE = colors.HexColor('#007AFF')
UAIFIX_DARK = colors.HexColor('#0051A8')
UAIFIX_LIGHT_BLUE = colors.HexColor('#EBF5FF')

SHINKO_AMBER = colors.HexColor('#F59E0B')
SHINKO_DARK = colors.HexColor('#0F172A')
SHINKO_AMBER_LIGHT = colors.HexColor('#FEF3C7')

TEAL_PARTNER = colors.HexColor('#0D9488')
TEAL_LIGHT = colors.HexColor('#F0FDFA')

TEXT_DARK = colors.HexColor('#0F172A')
TEXT_MUTED = colors.HexColor('#475569')
BORDER_COLOR = colors.HexColor('#CBD5E1')
BG_CARD = colors.HexColor('#F8FAFC')
BG_ALT = colors.HexColor('#F1F5F9')

PRINTS_DIR = "/tmp/uaifix_prints_b2b"

def create_header(canvas, doc):
    canvas.saveState()
    # Barra superior sutil
    canvas.setFillColor(UAIFIX_BLUE)
    canvas.rect(1.5*cm, 28.5*cm, 18*cm, 2.5, fill=1, stroke=0)
    
    canvas.setFont(FONT_BOLD, 7.5)
    canvas.setFillColor(UAIFIX_DARK)
    canvas.drawString(1.5*cm, 28.7*cm, "UAI FIX SOLUÇÕES DIGITAIS • MANUAL OPERACIONAL B2B")
    
    canvas.setFont(FONT_NORM, 7.5)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawRightString(19.5*cm, 28.7*cm, "Shinkō Systems • Plataforma Multi-Tenant")
    
    # Rodapé
    canvas.setStrokeColor(BORDER_COLOR)
    canvas.setLineWidth(0.5)
    canvas.line(1.5*cm, 1.2*cm, 19.5*cm, 1.2*cm)
    
    canvas.setFont(FONT_NORM, 7)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(1.5*cm, 0.85*cm, "Manual Prático de Operação • Onboarding em Lote & Precificação Trinitária • Confidencial")
    canvas.drawRightString(19.5*cm, 0.85*cm, f"Página {doc.page}")
    canvas.restoreState()

def gerar_manual():
    dest_dirs = [
        "/Users/pedroborba/Library/Mobile Documents/com~apple~CloudDocs/Shinkō/Relatórios/UaiFix",
        "/Users/pedroborba/Library/Mobile Documents/com~apple~CloudDocs/GitHub/UAI-Fix/docs/manuais"
    ]
    for d in dest_dirs:
        os.makedirs(d, exist_ok=True)

    timestamp = "2026-11-09-1730"
    filename = f"{timestamp} - MANUAL - Onboarding em Lote e Precificacao Trinitaria UaiFix.pdf"
    pdf_path = os.path.join(dest_dirs[0], filename)

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        rightMargin=1.5*cm,
        leftMargin=1.5*cm,
        topMargin=1.4*cm,
        bottomMargin=1.4*cm
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName=FONT_BOLD,
        fontSize=15,
        leading=19,
        textColor=SHINKO_DARK,
        spaceAfter=2
    )

    subtitle_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontName=FONT_NORM,
        fontSize=8.5,
        leading=12,
        textColor=TEXT_MUTED,
        spaceAfter=8
    )

    h1_style = ParagraphStyle(
        'H1',
        parent=styles['Heading2'],
        fontName=FONT_BOLD,
        fontSize=11,
        leading=15,
        textColor=UAIFIX_DARK,
        spaceBefore=6,
        spaceAfter=4
    )

    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Heading3'],
        fontName=FONT_BOLD,
        fontSize=9.5,
        leading=13,
        textColor=SHINKO_AMBER,
        spaceBefore=4,
        spaceAfter=2
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName=FONT_NORM,
        fontSize=8,
        leading=11.5,
        textColor=TEXT_DARK
    )

    callout_style = ParagraphStyle(
        'Callout',
        parent=styles['Normal'],
        fontName=FONT_BOLD,
        fontSize=8,
        leading=11.5,
        textColor=UAIFIX_DARK
    )

    story = []

    # ==========================================
    # PÁGINA 1: CAPA EXECUTIVA & VISÃO GERAL
    # ==========================================
    story.append(Paragraph("MANUAL DE OPERAÇÃO: ONDE CLICAR EM CADA RECURSO", title_style))
    story.append(Paragraph("Guia Prático Passo a Passo das Novas Funcionalidades B2B com Telas Reais de Produção", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=UAIFIX_BLUE, spaceAfter=8))

    # Tabela de Metadados Executivos
    meta_data = [
        [
            Paragraph("<b>Produto:</b> UAI-Fix Soluções Digitais", body_style),
            Paragraph("<b>Governança:</b> Shinkō Systems", body_style),
            Paragraph("<b>Autor:</b> Pedro Borba (Chief Architect)", body_style)
        ],
        [
            Paragraph("<b>Liderança Cliente:</b> Joubert Lima, Telmo Mateus, Caio Monteiro", body_style),
            Paragraph("<b>Versão:</b> 2.1 Multi-Tenant B2B", body_style),
            Paragraph("<b>Data:</b> 09/11/2026", body_style)
        ]
    ]
    t_meta = Table(meta_data, colWidths=[6.2*cm, 5.8*cm, 6.0*cm])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_CARD),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 8))

    # Apresentação
    story.append(Paragraph(
        "Este manual tem como objetivo orientar a diretoria e os gestores operacionais da UAI-Fix na utilização das "
        "<b>duas novas ferramentas centrais de escala B2B</b> implantadas na plataforma: o <b>Onboarding em Lote de Empresas Parceiras</b> "
        "(reformas, construtoras e facilities) e o <b>Motor de Precificação Trinitário por Ordem de Serviço</b>. "
        "Abaixo, cada fluxo é demonstrado com o passo a passo exato de cliques e capturas em alta resolução.",
        body_style
    ))
    story.append(Spacer(1, 8))

    # Resumo dos 2 Módulos
    resumo_data = [
        [
            Paragraph("<b>Módulo 1: Onboarding em Lote via Planilha</b>", h2_style),
            Paragraph("<b>Módulo 2: Precificação Trinitária da OS (3 Níveis)</b>", h2_style)
        ],
        [
            Paragraph(
                "• <b>O que faz:</b> Cadastra em 1 clique a Empresa Parceira, seus Gestores operacionais, sua carteira de Clientes e os Prestadores técnicos credenciados.<br/>"
                "• <b>Onde acessar:</b> Menu Admin &gt; Gestão de Equipes / Usuários (<code>#/admin/users</code>).<br/>"
                "• <b>Como funciona:</b> Lê arquivos Excel (com 4 abas ou folha única), valida CPFs e WhatsApps, exibe preview e grava tudo vinculado no banco.",
                body_style
            ),
            Paragraph(
                "• <b>O que faz:</b> Segrega a mesma Ordem de Serviço em 3 visões financeiras com sigilo comercial rígido (Cliente, Parceira e Master).<br/>"
                "• <b>Onde acessar:</b> Menu Admin &gt; Relatórios (<code>#/admin/relatorios</code>) &gt; Botão Imprimir OS.<br/>"
                "• <b>Como funciona:</b> Switcher de 1 toque alternando entre Comprovante do Cliente, DRE Operacional da Parceira e DRE Master com take-rate.",
                body_style
            )
        ]
    ]
    t_resumo = Table(resumo_data, colWidths=[9.0*cm, 9.0*cm])
    t_resumo.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), UAIFIX_LIGHT_BLUE),
        ('BACKGROUND', (1,0), (1,-1), SHINKO_AMBER_LIGHT),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_resumo)
    story.append(Spacer(1, 10))

    # Guia Rápido de Atalhos
    story.append(Paragraph("<b>Mapa Direto de Rotas e Telas:</b>", h1_style))
    rotas_data = [
        [Paragraph("<b>Ação Desejada</b>", callout_style), Paragraph("<b>Rota na Plataforma</b>", callout_style), Paragraph("<b>Botão / Elemento Chave</b>", callout_style)],
        [Paragraph("Importar Planilha de Nova Parceira", body_style), Paragraph("<code>appuaifix.vercel.app/#/admin/users</code>", body_style), Paragraph("Botão Âmbar <code>[ 📄 Importar Planilha de Parceira ]</code>", body_style)],
        [Paragraph("Baixar Template de Onboarding (.xlsx)", body_style), Paragraph("Modal de Importação de Parceira", body_style), Paragraph("Botão <code>[ ⬇️ Baixar Modelo (.xlsx) ]</code> no topo do modal", body_style)],
        [Paragraph("Emitir OS com DRE da Parceira", body_style), Paragraph("<code>appuaifix.vercel.app/#/admin/relatorios</code>", body_style), Paragraph("Aba <code>[ 🏢 2. Empresa Parceira ]</code> na prévia da OS", body_style)],
        [Paragraph("Emitir Auditoria Master UAI-Fix", body_style), Paragraph("<code>appuaifix.vercel.app/#/admin/relatorios</code>", body_style), Paragraph("Aba <code>[ 👑 3. UAI-Fix Master ]</code> na prévia da OS", body_style)],
    ]
    t_rotas = Table(rotas_data, colWidths=[6.0*cm, 6.2*cm, 5.8*cm])
    t_rotas.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BG_ALT),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_rotas)

    # ==========================================
    # PÁGINA 2: MÓDULO 1 — ONBOARDING EM LOTE (PASSO A PASSO 1 & 2)
    # ==========================================
    story.append(PageBreak())
    story.append(Paragraph("MÓDULO 1: ONBOARDING EM LOTE DE EMPRESAS PARCEIRAS", h1_style))
    story.append(Paragraph("Passo 1: Acesso ao Painel & Acionamento da Ferramenta de Importação", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceAfter=6))

    img1_path = os.path.join(PRINTS_DIR, "01_gestao_usuarios_botao_importar.png")
    if os.path.exists(img1_path):
        story.append(Image(img1_path, width=18*cm, height=9.8*cm))
        story.append(Spacer(1, 4))

    callouts_p1 = [
        [
            Paragraph("<b>ONDE CLICAR NO PASSO 1:</b>", callout_style),
            Paragraph(
                "<b>1. Menu Lateral:</b> Clique em <b>Gestão de Equipes / Usuários</b> (rota <code>#/admin/users</code>).<br/>"
                "<b>2. Botão de Ação:</b> No cabeçalho superior direito, clique no botão em gradiente âmbar <b><code>[ 📄 Importar Planilha de Parceira ]</code></b>.<br/>"
                "<b>3. Multi-Tenant Automático:</b> A tela detecta a organização ativa e prepara o ambiente para o vínculo em lote.",
                body_style
            )
        ]
    ]
    t_cp1 = Table(callouts_p1, colWidths=[4.5*cm, 13.5*cm])
    t_cp1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), SHINKO_AMBER_LIGHT),
        ('BOX', (0,0), (-1,-1), 0.5, SHINKO_AMBER),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_cp1)
    story.append(Spacer(1, 8))

    story.append(Paragraph("Passo 2: Modal de Upload e Download do Modelo Oficial", h2_style))
    img2_path = os.path.join(PRINTS_DIR, "02_modal_importacao_aberto.png")
    if os.path.exists(img2_path):
        story.append(Image(img2_path, width=18*cm, height=8.2*cm))
        story.append(Spacer(1, 4))

    callouts_p2 = [
        [
            Paragraph("<b>ONDE CLICAR NO PASSO 2:</b>", callout_style),
            Paragraph(
                "<b>• Para Enviar a uma Nova Empresa:</b> Clique em <b><code>[ ⬇️ Baixar Modelo (.xlsx) ]</code></b> para salvar a planilha oficial de 4 abas.<br/>"
                "<b>• Para Subir a Planilha Preenchida:</b> Clique sobre a área tracejada (Dropzone) ou arraste o arquivo <code>.xlsx</code> ou <code>.csv</code>.",
                body_style
            )
        ]
    ]
    t_cp2 = Table(callouts_p2, colWidths=[4.5*cm, 13.5*cm])
    t_cp2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_CARD),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_cp2)

    # ==========================================
    # PÁGINA 3: MÓDULO 1 — PRÉVIA INTELIGENTE & CONFIRMAÇÃO
    # ==========================================
    story.append(PageBreak())
    story.append(Paragraph("MÓDULO 1: PRÉVIA DOS DADOS & CONFIRMAÇÃO DA INGESTÃO", h1_style))
    story.append(Paragraph("Passo 3: Conferência dos Contadores, Identificação da Empresa e Gravação no Supabase", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceAfter=6))

    img3_path = os.path.join(PRINTS_DIR, "03_modal_preview_planilha_parceira.png")
    if os.path.exists(img3_path):
        story.append(Image(img3_path, width=18*cm, height=11.5*cm))
        story.append(Spacer(1, 6))

    checklist_p3 = [
        [Paragraph("<b>Elemento Visual da Tela</b>", callout_style), Paragraph("<b>Como o Sistema Age e Onde Clicar</b>", callout_style)],
        [
            Paragraph("<b>Card Preto / Dourado (Empresa):</b>", body_style),
            Paragraph("Identifica automaticamente Razão Social, CNPJ, Data de Fundação e Setor de Mercado. A empresa é provisionada na tabela <code>empresas_parceiras</code>.", body_style)
        ],
        [
            Paragraph("<b>Contadores de Papéis:</b>", body_style),
            Paragraph("Exibe o total validado de <b>Gestores</b> (roxo), <b>Clientes</b> (azul) e <b>Prestadores</b> (verde-água). Linhas com e-mail inválido vão para 'Pendentes'.", body_style)
        ],
        [
            Paragraph("<b>Filtros da Tabela:</b>", body_style),
            Paragraph("<b>Clique nas abas</b> <code>[Gestores]</code>, <code>[Clientes]</code> ou <code>[Prestadores]</code> para inspecionar os cadastros antes de gravar.", body_style)
        ],
        [
            Paragraph("<b>Botão de Gravação Final:</b>", body_style),
            Paragraph("<b>Clique em <code>[ Confirmar & Ingerir X Cadastros ]</code></b> no rodapé direito. Os registros sobem imediatamente com UUID e a lista de usuários é atualizada.", body_style)
        ]
    ]
    t_cp3 = Table(checklist_p3, colWidths=[5.5*cm, 12.5*cm])
    t_cp3.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BG_ALT),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_cp3)

    # ==========================================
    # PÁGINA 4: MÓDULO 2 — PRECIFICAÇÃO & VISÃO CLIENTE
    # ==========================================
    story.append(PageBreak())
    story.append(Paragraph("MÓDULO 2: PRECIFICAÇÃO EM 3 NÍVEIS & RELATÓRIOS DA OS", h1_style))
    story.append(Paragraph("Passo 1 & 2: Localização da OS e Emissão do Comprovante do Cliente Final", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceAfter=6))

    img4_path = os.path.join(PRINTS_DIR, "04_relatorios_lista_os.png")
    if os.path.exists(img4_path):
        story.append(Image(img4_path, width=18*cm, height=8.2*cm))
        story.append(Spacer(1, 4))

    callouts_p4 = [
        [
            Paragraph("<b>ONDE CLICAR:</b>", callout_style),
            Paragraph(
                "<b>1. Acesso aos Relatórios:</b> Acesse <code>#/admin/relatorios</code> no menu.<br/>"
                "<b>2. Botão Imprimir OS:</b> Na tabela de ordens de serviço, clique no botão azul <b><code>[ 🖨️ Imprimir OS ]</code></b> do chamado desejado.",
                body_style
            )
        ]
    ]
    t_cp4 = Table(callouts_p4, colWidths=[3.5*cm, 14.5*cm])
    t_cp4.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), UAIFIX_LIGHT_BLUE),
        ('BOX', (0,0), (-1,-1), 0.5, UAIFIX_BLUE),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_cp4)
    story.append(Spacer(1, 6))

    story.append(Paragraph("Nível 1: Visão Cliente Final (Sigilo Comercial Total)", h2_style))
    img5_path = os.path.join(PRINTS_DIR, "05_modal_os_nivel_1_cliente.png")
    if os.path.exists(img5_path):
        story.append(Image(img5_path, width=18*cm, height=9.0*cm))
        story.append(Spacer(1, 4))

    desc_c1 = [
        [
            Paragraph("<b>CARACTERÍSTICAS DA VISÃO 1 (CLIENTE):</b>", callout_style),
            Paragraph(
                "• <b>O que o cliente vê:</b> Identificação das partes, escopo técnico do serviço, fotos antes/depois, termo de garantia legal de 90 dias (CDC) e o <b>valor final total faturado</b>.<br/>"
                "• <b>Sigilo Comercial Absoluto:</b> Custos internos de mão de obra (HH), insumos a preço de custo, margens de lucro e taxas da UAI-Fix ficam <b>100% ocultos</b>.",
                body_style
            )
        ]
    ]
    t_dc1 = Table(desc_c1, colWidths=[5.5*cm, 12.5*cm])
    t_dc1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_CARD),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_dc1)

    # ==========================================
    # PÁGINA 5: MÓDULO 2 — VISÃO PARCEIRA & VISÃO MASTER
    # ==========================================
    story.append(PageBreak())
    story.append(Paragraph("MÓDULO 2: VISÃO EMPRESA PARCEIRA & VISÃO UAI-FIX MASTER", h1_style))
    story.append(Paragraph("Passos 3 & 4: DRE Operacional da Empreiteira vs DRE Consolidado da Governança", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceAfter=6))

    story.append(Paragraph("Nível 2: Visão Empresa Parceira (DRE Operacional & Margem)", h2_style))
    img6_path = os.path.join(PRINTS_DIR, "06_modal_os_nivel_2_parceira.png")
    if os.path.exists(img6_path):
        story.append(Image(img6_path, width=18*cm, height=8.4*cm))
        story.append(Spacer(1, 4))

    desc_c2 = [
        [
            Paragraph("<b>ONDE CLICAR & O QUE MOSTRA (NÍVEL 2 - PARCEIRA):</b>", callout_style),
            Paragraph(
                "• <b>Onde clicar:</b> No topo do modal, clique na aba <b><code>[ 🏢 2. Empresa Parceira ]</code></b>.<br/>"
                "• <b>DRE Operacional Detalhado:</b> Faturamento bruto da OS, dedução de custos diretos (mão de obra HH dos técnicos, insumos/peças e deslocamento), custo fixo/overhead, impostos da parceira e a taxa da plataforma UAI-Fix.<br/>"
                "• <b>Resultado Líquido:</b> Exibe a margem de lucro líquido da parceira em R$ e a <b>rentabilidade percentual</b> sobre o valor total.",
                body_style
            )
        ]
    ]
    t_dc2 = Table(desc_c2, colWidths=[6.0*cm, 12.0*cm])
    t_dc2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), TEAL_LIGHT),
        ('BOX', (0,0), (-1,-1), 0.5, TEAL_PARTNER),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_dc2)
    story.append(Spacer(1, 6))

    story.append(Paragraph("Nível 3: Visão UAI-Fix Master (Auditoria 360° & Take-Rate)", h2_style))
    img7_path = os.path.join(PRINTS_DIR, "07_modal_os_nivel_3_master.png")
    if os.path.exists(img7_path):
        story.append(Image(img7_path, width=18*cm, height=8.4*cm))
        story.append(Spacer(1, 4))

    desc_c3 = [
        [
            Paragraph("<b>ONDE CLICAR & O QUE MOSTRA (NÍVEL 3 - MASTER):</b>", callout_style),
            Paragraph(
                "• <b>Onde clicar:</b> No topo do modal, clique na aba <b><code>[ 👑 3. UAI-Fix Master ]</code></b>.<br/>"
                "• <b>DRE Consolidado da Plataforma:</b> Receita bruta total do cliente, repasse líquido e margem da parceira, taxa bruta UAI-Fix (take-rate %), dedução de tarifas do gateway de pagamento e a <b>Margem de Contribuição Líquida da UAI-Fix</b>.<br/>"
                "• <b>Exportação em 1 Toque:</b> No rodapé, clique em <b><code>[ 📥 Baixar PDF ]</code></b> ou <b><code>[ 🖨️ Imprimir OS ]</code></b> para emitir o documento oficial A4.",
                body_style
            )
        ]
    ]
    t_dc3 = Table(desc_c3, colWidths=[6.0*cm, 12.0*cm])
    t_dc3.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), SHINKO_AMBER_LIGHT),
        ('BOX', (0,0), (-1,-1), 0.5, SHINKO_AMBER),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_dc3)

    # Compilar Documento
    doc.build(story, onFirstPage=create_header, onLaterPages=create_header)

    # Copiar também para a pasta de espelho do iCloud
    alt_dest = "/Users/pedroborba/Library/Mobile Documents/com~apple~CloudDocs/Shinko/Relatorios/UaiFix"
    os.makedirs(alt_dest, exist_ok=True)
    import shutil
    shutil.copy2(pdf_path, os.path.join(alt_dest, filename))
    shutil.copy2(pdf_path, os.path.join(dest_dirs[1], "Manual_B2B_Onboarding_e_Precificacao_UaiFix.pdf"))

    print(f"✅ Manual B2B com prints reais gerado com sucesso!")
    print(f"📄 Arquivo Primário: {pdf_path}")
    print(f"📄 Espelho iCloud: {os.path.join(alt_dest, filename)}")
    print(f"📄 Espelho Docs: {os.path.join(dest_dirs[1], 'Manual_B2B_Onboarding_e_Precificacao_UaiFix.pdf')}")

if __name__ == '__main__':
    gerar_manual()
