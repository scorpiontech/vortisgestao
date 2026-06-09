#!/usr/bin/env python3
"""
Gera o Manual do Usuário do Vortis Gestão em PDF (A4).

Uso:
    python docs/gerar-manual-pdf.py [saida.pdf]

Padrão de saída: docs/manual-usuario.pdf
"""
import sys
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER

OUTPUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "manual-usuario.pdf"

PRIMARY = colors.HexColor("#1E3A8A")
ACCENT = colors.HexColor("#3B82F6")
MUTED = colors.HexColor("#64748B")
BG_LIGHT = colors.HexColor("#F1F5F9")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle("Cover", parent=styles["Title"], fontSize=42, leading=48,
                          textColor=PRIMARY, alignment=TA_CENTER, spaceAfter=20))
styles.add(ParagraphStyle("CoverSub", parent=styles["Normal"], fontSize=16, leading=22,
                          textColor=MUTED, alignment=TA_CENTER, spaceAfter=10))
styles.add(ParagraphStyle("H1", parent=styles["Heading1"], fontSize=22, leading=28,
                          textColor=PRIMARY, spaceBefore=18, spaceAfter=12))
styles.add(ParagraphStyle("H2", parent=styles["Heading2"], fontSize=15, leading=20,
                          textColor=ACCENT, spaceBefore=14, spaceAfter=8))
styles.add(ParagraphStyle("Body", parent=styles["BodyText"], fontSize=11, leading=16,
                          alignment=TA_LEFT, spaceAfter=8))
styles.add(ParagraphStyle("BulletItem", parent=styles["BodyText"], fontSize=11, leading=15,
                          leftIndent=18, bulletIndent=6, spaceAfter=4))
styles.add(ParagraphStyle("Note", parent=styles["BodyText"], fontSize=10, leading=14,
                          textColor=MUTED, leftIndent=10, spaceAfter=8))

def h1(text): return Paragraph(text, styles["H1"])
def h2(text): return Paragraph(text, styles["H2"])
def p(text): return Paragraph(text, styles["Body"])
def b(text): return Paragraph("• " + text, styles["Bullet"])
def note(text): return Paragraph("<i>" + text + "</i>", styles["Note"])

def callout(text):
    tbl = Table([[Paragraph(text, styles["Body"])]], colWidths=[16 * cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BG_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, ACCENT),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return tbl

def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(2 * cm, 1.2 * cm, "Vortis Gestão — Manual do Usuário")
    canvas.drawRightString(19 * cm, 1.2 * cm, f"Página {doc.page}")
    canvas.setStrokeColor(colors.HexColor("#E2E8F0"))
    canvas.line(2 * cm, 1.6 * cm, 19 * cm, 1.6 * cm)
    canvas.restoreState()

def main():
    doc = SimpleDocTemplate(
        str(OUTPUT), pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2.2 * cm,
        title="Manual do Usuário — Vortis Gestão",
        author="Vortis",
    )
    s = []

    # --- Capa ---
    s.append(Spacer(1, 6 * cm))
    s.append(Paragraph("Vortis Gestão", styles["Cover"]))
    s.append(Paragraph("Manual do Usuário", styles["CoverSub"]))
    s.append(Spacer(1, 0.5 * cm))
    s.append(Paragraph("ERP &amp; PDV para gestão de estoque, financeiro,<br/>vendas e ordens de serviço",
                       styles["CoverSub"]))
    s.append(Spacer(1, 5 * cm))
    s.append(Paragraph("Versão 1.0 · 2026", styles["Note"]))
    s.append(PageBreak())

    # --- Sumário ---
    s.append(h1("Sumário"))
    toc = [
        "1. Primeiros passos",
        "2. Painel inicial (Dashboard)",
        "3. Cadastros básicos",
        "4. Estoque",
        "5. PDV — Frente de caixa",
        "6. Caixa",
        "7. Financeiro",
        "8. Ordens de Serviço",
        "9. Clientes e Fornecedores",
        "10. Relatórios",
        "11. Usuários e permissões",
        "12. Configurações fiscais",
        "13. Dúvidas frequentes",
    ]
    for t in toc:
        s.append(Paragraph(t, styles["Body"]))
    s.append(PageBreak())

    # --- 1. Primeiros passos ---
    s.append(h1("1. Primeiros passos"))
    s.append(p("Acesse o sistema pelo endereço fornecido (por exemplo, "
               "<b>https://app.vortisgestao.com.br</b>) e faça login com e-mail e senha cadastrados."))
    s.append(p("No primeiro acesso, conclua o cadastro da empresa em <b>Configurações</b>: "
               "razão social, CNPJ, endereço e logotipo."))
    s.append(h2("Tipos de usuário"))
    s.append(b("<b>Master</b>: dono da conta, acesso total ao sistema."))
    s.append(b("<b>Vendedor</b>: cadastrado pelo Master, com acesso ao PDV, vendas, clientes e OS."))
    s.append(callout("<b>Importante:</b> apenas o Master pode abrir o caixa, configurar dados fiscais "
                     "e cadastrar novos usuários."))

    # --- 2. Dashboard ---
    s.append(h1("2. Painel inicial (Dashboard)"))
    s.append(p("Ao entrar no sistema você vê um resumo do seu negócio:"))
    for it in [
        "Receita total e despesas do período.",
        "Quantidade de produtos cadastrados.",
        "Produtos com estoque abaixo do mínimo.",
        "Ordens de serviço em andamento e a receber.",
        "Últimas movimentações financeiras.",
    ]:
        s.append(b(it))

    # --- 3. Cadastros ---
    s.append(h1("3. Cadastros básicos"))
    s.append(p("Antes de começar a vender, configure os cadastros auxiliares:"))
    s.append(b("<b>Categorias</b> — para agrupar produtos (ex.: Bebidas, Limpeza)."))
    s.append(b("<b>Unidades</b> — un, kg, m, cx, L, etc."))
    s.append(b("<b>Fornecedores</b> — com CPF/CNPJ validado e endereço completo."))
    s.append(p("Em campos de CNPJ, clique no ícone de <b>lupa</b> para preencher automaticamente "
               "nome e endereço a partir da Receita Federal. CEP também é preenchido automaticamente."))

    # --- 4. Estoque ---
    s.append(h1("4. Estoque"))
    s.append(h2("Cadastrar produto"))
    s.append(p("Informe: nome, SKU, código de barras, categoria, unidade, custo, preço, "
               "estoque atual e estoque mínimo."))
    s.append(h2("Importar NF-e"))
    s.append(p("Use o botão <b>Importar XML</b> para ler uma nota fiscal e criar ou atualizar "
               "produtos em lote, já vinculando o fornecedor."))
    s.append(callout("Produtos com estoque abaixo do mínimo aparecem no Dashboard em vermelho."))

    # --- 5. PDV ---
    s.append(h1("5. PDV — Frente de caixa"))
    s.append(p("Para vender:"))
    for i, step in enumerate([
        "Certifique-se de que há um <b>caixa aberto</b> (peça ao Master, se necessário).",
        "Acesse <b>PDV</b>.",
        "Adicione produtos lendo o código de barras ou digitando o nome.",
        "Ajuste quantidade, desconto ou acréscimo conforme o caso.",
        "Selecione o cliente (opcional).",
        "Escolha a forma de pagamento — cartão pode ser parcelado em até <b>12x</b>.",
        "Finalize a venda. O cupom de 80 mm é impresso com o nome da empresa emitente.",
    ], 1):
        s.append(Paragraph(f"<b>{i}.</b> {step}", styles["Bullet"]))

    # --- 6. Caixa ---
    s.append(h1("6. Caixa"))
    s.append(b("<b>Abertura</b> (somente Master): informe o valor inicial em dinheiro."))
    s.append(b("<b>Suprimento</b>: entrada extra de dinheiro durante o expediente."))
    s.append(b("<b>Sangria</b>: retirada de dinheiro do caixa."))
    s.append(b("<b>Fechamento</b> (Master ou Vendedor): o sistema mostra o valor esperado; informe o "
               "valor contado e a diferença é registrada automaticamente."))
    s.append(callout("Sem caixa aberto, vendas em dinheiro ficam bloqueadas."))

    # --- 7. Financeiro ---
    s.append(h1("7. Financeiro"))
    s.append(h2("Movimentações"))
    s.append(p("Lista todas as entradas e saídas, com filtros por período, categoria e forma de pagamento."))
    s.append(h2("Contas a Pagar"))
    s.append(p("Cadastre fornecedor, valor, vencimento, categoria e parcelas. Ao registrar o pagamento, "
               "a movimentação financeira é criada automaticamente."))
    s.append(h2("Contas a Receber"))
    s.append(p("Geradas automaticamente em vendas parceladas, ou cadastradas avulsas."))
    s.append(callout("<b>Atenção:</b> contas já pagas <b>não podem ser editadas ou excluídas</b>. "
                     "Para corrigir, registre um lançamento de ajuste."))

    # --- 8. OS ---
    s.append(h1("8. Ordens de Serviço"))
    s.append(p("Fluxo recomendado:"))
    for i, step in enumerate([
        "Criar a OS escolhendo o cliente e descrevendo o problema/serviço.",
        "Adicionar <b>serviços</b> (mão de obra) e <b>materiais</b> (que descontam do estoque ao salvar).",
        "Acompanhar status: aberta → em andamento → finalizada.",
        "Marcar como <b>paga</b> ao receber. Após pagamento a OS é travada.",
        "Imprimir em A4 — sai com cabeçalho da empresa emitente.",
    ], 1):
        s.append(Paragraph(f"<b>{i}.</b> {step}", styles["Bullet"]))

    # --- 9. Clientes ---
    s.append(h1("9. Clientes e Fornecedores"))
    s.append(b("Suporte a Pessoa Física (CPF) e Pessoa Jurídica (CNPJ)."))
    s.append(b("Máscara automática enquanto você digita, com validação dos dígitos verificadores."))
    s.append(b("Para CNPJ, o botão de lupa busca dados na Receita Federal."))
    s.append(b("CEP preenche bairro, cidade e UF automaticamente."))
    s.append(b("Em Clientes, o botão <b>Histórico</b> mostra todas as compras e KPIs do cliente."))

    # --- 10. Relatórios ---
    s.append(h1("10. Relatórios"))
    s.append(p("Disponíveis: vendas por período, ticket médio, top produtos, top clientes, "
               "fluxo de caixa e estoque. Todos os relatórios podem ser impressos em A4 com o "
               "cabeçalho da empresa."))

    # --- 11. Usuários ---
    s.append(h1("11. Usuários e permissões"))
    s.append(p("(Apenas Master) Em <b>Usuários</b>, convide vendedores informando e-mail e senha "
               "provisória. Marque como <b>inativo</b> para suspender o acesso sem apagar."))

    # --- 12. Fiscal ---
    s.append(h1("12. Configurações fiscais"))
    s.append(b("Upload do certificado <b>A1 (.pfx)</b> com a senha correspondente."))
    s.append(b("Escolha de ambiente: <b>Homologação</b> (testes) ou <b>Produção</b>."))
    s.append(b("Validação automática do certificado, com exibição da data de expiração."))

    # --- 13. FAQ ---
    s.append(h1("13. Dúvidas frequentes"))
    faqs = [
        ("Esqueci minha senha.",
         "Use o link <b>Esqueci a senha</b> na tela de login. Você recebe um e-mail com link para redefinir."),
        ("Por que não consigo abrir o caixa?",
         "Apenas o usuário <b>Master</b> pode abrir o caixa. Vendedor só fecha."),
        ("Por que não consigo editar uma conta paga?",
         "Contas pagas são bloqueadas por segurança e auditoria. Cadastre um ajuste se necessário."),
        ("O cupom imprimiu sem o nome da empresa.",
         "Preencha a <b>Razão Social</b> em Configurações da Empresa."),
        ("Apareceu o aviso 'fatura em aberto' e tudo travou.",
         "Sua mensalidade Vortis está vencida. Acesse <b>Cobranças</b> e quite a fatura para reativar."),
    ]
    for q, a in faqs:
        s.append(Paragraph(f"<b>{q}</b>", styles["Body"]))
        s.append(Paragraph(a, styles["Body"]))
        s.append(Spacer(1, 4))

    s.append(Spacer(1, 1 * cm))
    s.append(callout("Precisa de ajuda? Entre em contato com o suporte Vortis pelo "
                     "canal informado no momento da contratação."))

    doc.build(s, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"PDF gerado: {OUTPUT}")

if __name__ == "__main__":
    main()
