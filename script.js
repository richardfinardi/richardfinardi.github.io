const API_URL = "https://script.google.com/macros/s/AKfycbwLQ07C51AHB64HS7PJ7vfD99CKuZy-ubfewbXgN4e15enkfCUU6EzhafHU_zZXAPKL/exec";

let usuarioLogado = null;
let empresaLogadaNome = "---";
let listaClientesAdmin = [];
let listaPeriodos = [];
let periodoAtivoObj = null;

let listaInvestimentos = [];
let listaCC = [];
let listaRecursos = [];
let listaBeneficios = [];
let listaFuncionarios = [];
let listaPlanoContas = [];
let tabelaPadroes = [];
let chartCCInstance = null;
let dadosCSVImportacao = [];
let entidadeGradeAtiva = "";
let sidebarExpandida = true;

// TEMA CLARO E ESCURO
function alternarTema() {
    const html = document.documentElement;
    const appLogo = document.getElementById('app-logo');
    const loginLogo = document.getElementById('login-app-logo');
    const themeBtnIcon = document.getElementById('theme-btn-icon');

    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        localStorage.setItem('themeRF', 'light');
        if(themeBtnIcon) themeBtnIcon.innerText = '☀️';
        if(appLogo) appLogo.src = 'LOGO_APLICACAO_FUNDO_BRANCO.png';
        if(loginLogo) loginLogo.src = 'LOGO_APLICACAO_FUNDO_BRANCO.png';
    } else {
        html.classList.add('dark');
        localStorage.setItem('themeRF', 'dark');
        if(themeBtnIcon) themeBtnIcon.innerText = '🌙';
        if(appLogo) appLogo.src = 'LOGO_APLICACAO_FUNDO_PRETO.png';
        if(loginLogo) loginLogo.src = 'LOGO_APLICACAO_FUNDO_PRETO.png';
    }
}

function carregarTemaSalvo() {
    const theme = localStorage.getItem('themeRF') || 'dark';
    const html = document.documentElement;
    const appLogo = document.getElementById('app-logo');
    const loginLogo = document.getElementById('login-app-logo');
    const themeBtnIcon = document.getElementById('theme-btn-icon');

    if (theme === 'light') {
        html.classList.remove('dark');
        if(themeBtnIcon) themeBtnIcon.innerText = '☀️';
        if(appLogo) appLogo.src = 'LOGO_APLICACAO_FUNDO_BRANCO.png';
        if(loginLogo) loginLogo.src = 'LOGO_APLICACAO_FUNDO_BRANCO.png';
    } else {
        html.classList.add('dark');
        if(themeBtnIcon) themeBtnIcon.innerText = '🌙';
        if(appLogo) appLogo.src = 'LOGO_APLICACAO_FUNDO_PRETO.png';
        if(loginLogo) loginLogo.src = 'LOGO_APLICACAO_FUNDO_PRETO.png';
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar-menu');
    const icon = document.getElementById('sidebar-toggle-icon');
    const texts = document.querySelectorAll('.sidebar-text');

    sidebarExpandida = !sidebarExpandida;

    if (sidebarExpandida) {
        sidebar.classList.remove('w-16');
        sidebar.classList.add('w-64');
        if(icon) icon.innerText = '◀';
        texts.forEach(el => el.classList.remove('hidden'));
    } else {
        sidebar.classList.remove('w-64');
        sidebar.classList.add('w-16');
        if(icon) icon.innerText = '▶';
        texts.forEach(el => el.classList.add('hidden'));
    }
}

function toggleFormulariosAccordion(idWrapper) {
    const wrap = document.getElementById(idWrapper);
    const btnText = document.getElementById(`${idWrapper}-btn-text`);
    if(!wrap) return;

    if (wrap.classList.contains('hidden')) {
        wrap.classList.remove('hidden');
        if(btnText) btnText.innerText = '▲ Fechar Formulário';
    } else {
        wrap.classList.add('hidden');
        if(btnText) btnText.innerText = '+ Cadastrar Novo';
    }
}

function abrirFormularioAccordion(idWrapper) {
    const wrap = document.getElementById(idWrapper);
    const btnText = document.getElementById(`${idWrapper}-btn-text`);
    if(wrap) {
        wrap.classList.remove('hidden');
        if(btnText) btnText.innerText = '▲ Fechar Formulário';
    }
}

function filtrarTabelaGenerica(tbodyId, termo) {
    const tbody = document.getElementById(tbodyId);
    if(!tbody) return;
    const rows = tbody.querySelectorAll('tr');
    const termoClean = String(termo || "").toLowerCase().trim();

    rows.forEach(tr => {
        const txt = tr.innerText.toLowerCase();
        if(!termoClean || txt.includes(termoClean)) {
            tr.style.display = '';
        } else {
            tr.style.display = 'none';
        }
    });
}

let direcaoOrdenacao = {};
function ordenarTabelaGenerica(tbodyId, colIndex, isNumeric = false) {
    const tbody = document.getElementById(tbodyId);
    if(!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));

    direcaoOrdenacao[colIndex] = !direcaoOrdenacao[colIndex];
    const ascendente = direcaoOrdenacao[colIndex];

    rows.sort((a, b) => {
        const cellA = a.children[colIndex] ? a.children[colIndex].innerText.trim() : '';
        const cellB = b.children[colIndex] ? b.children[colIndex].innerText.trim() : '';

        if (isNumeric) {
            const valA = parseMoedaBR(cellA);
            const valB = parseMoedaBR(cellB);
            return ascendente ? valA - valB : valB - valA;
        } else {
            return ascendente ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
        }
    });

    tbody.innerHTML = '';
    rows.forEach(r => tbody.appendChild(r));
}

function setSyncStatus(isSyncing, msg = "Conectado") {
    const indicator = document.getElementById('sync-indicator');
    const syncText = document.getElementById('sync-text');
    if(!indicator) return;

    indicator.classList.remove('hidden', 'flex');
    indicator.classList.add('flex');

    if (isSyncing) {
        indicator.className = "flex items-center gap-1.5 bg-amber-950/60 border border-amber-800 text-amber-300 px-2.5 py-1 rounded-full text-xs font-bold animate-pulse-fast";
        syncText.innerText = "🔄 Sincronizando...";
    } else {
        indicator.className = "flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-800 text-emerald-400 px-2.5 py-1 rounded-full text-xs font-bold";
        syncText.innerText = "🟢 " + msg;
    }
}

function deslogar() {
    localStorage.removeItem('usuarioLogadoRF');
    location.reload();
}

function formatarMoedaBR(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseMoedaBR(str) {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    let limpo = str.toString().replace(/[^\d,-]/g, '').replace(',', '.');
    return parseFloat(limpo) || 0;
}

function aplicarMascarasMonetarias() {
    document.querySelectorAll('.mask-money').forEach(input => {
        input.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '');
            if(!v) { e.target.value = ''; return; }
            v = (parseFloat(v) / 100).toFixed(2);
            e.target.value = Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        });
    });
}

function formatarNomePeriodoLimpo(p) {
    if (!p) return "";
    let nomeRaw = String(p.TPERIODO_NOME || "");
    return `${nomeRaw.toUpperCase()} [${p.TPERIODO_STATUS ? p.TPERIODO_STATUS.toUpperCase() : 'ABERTO'}]`;
}

function atualizarTagsPeriodoHeader() {
    const tagStr = periodoAtivoObj ? formatarNomePeriodoLimpo(periodoAtivoObj) : "---";
    document.querySelectorAll('.display-periodo-tag').forEach(el => el.innerText = tagStr);
    document.querySelectorAll('.display-empresa-nome').forEach(el => el.innerText = empresaLogadaNome.toUpperCase());
}

// FAZER LOGIN
async function fazerLogin() {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value.trim();
    const btn = document.getElementById('btn-login');

    if (!email || !pass) return alert("Por favor, informe e-mail e senha.");

    try {
        btn.innerText = "Verificando...";
        btn.disabled = true;
        setSyncStatus(true);

        const response = await fetch(`${API_URL}?action=TUSUARIO`);
        const usuarios = await response.json();

        const user = usuarios.find(u => 
            String(u.TUSUARIO_EMAIL).toLowerCase() === email.toLowerCase() &&
            String(u.TUSUARIO_SENHA) === pass &&
            String(u.TUSUARIO_ATIVO).toUpperCase() === 'SIM'
        );

        if (!user) {
            alert("Acesso negado: E-mail/Senha incorretos ou usuário inativo.");
            btn.innerText = "Entrar no Sistema";
            btn.disabled = false;
            setSyncStatus(false, "Erro de Login");
            return;
        }

        usuarioLogado = user;
        localStorage.setItem('usuarioLogadoRF', JSON.stringify(user));
        await buscarNomeEmpresa();
        iniciarSessao();

    } catch (err) {
        console.error(err);
        alert("Erro de conexão ao validar o acesso.");
        btn.innerText = "Entrar no Sistema";
        btn.disabled = false;
        setSyncStatus(false, "Erro de Conexão");
    }
}

async function buscarNomeEmpresa() {
    try {
        const res = await fetch(`${API_URL}?action=TCLIENTE`);
        const clientes = await res.json();
        const cli = clientes.find(c => String(c.TCLIENTE_ID) === String(usuarioLogado.TCLIENTE_ID));
        if (cli) empresaLogadaNome = cli.TCLIENTE_NOME;
    } catch (e) { empresaLogadaNome = usuarioLogado.TCLIENTE_ID; }
}

async function iniciarSessao() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-content').classList.remove('hidden');
    document.getElementById('main-content').classList.add('flex');
    document.getElementById('user-menu').classList.remove('hidden');
    document.getElementById('wrapper-periodo-global').classList.remove('hidden');
    document.getElementById('user-display-name').innerText = usuarioLogado.TUSUARIO_NOME;

    // CHECAGEM DE ADMINISTRADOR (EXIBE A GUIA ADMIN APENAS SE FOR TUSUARIO_ADM === 'SIM')
    const isAdm = String(usuarioLogado.TUSUARIO_ADM).toUpperCase() === 'SIM' || String(usuarioLogado.TUSUARIO_ADM).toUpperCase() === 'TRUE';
    
    const badge = document.getElementById('role-badge');
    if (badge) badge.classList.remove('hidden');

    const navBtnAdm = document.getElementById('nav-btn-adm');
    if (navBtnAdm) {
        if (isAdm) {
            if (badge) badge.innerText = "ADMINISTRADOR";
            navBtnAdm.classList.remove('hidden');
        } else {
            if (badge) badge.innerText = "PORTAL CLIENTE";
            navBtnAdm.classList.add('hidden');
        }
    }

    await carregarPeriodosDoCliente();
    await carregarPadroes();
    carregarTudoDoPeriodo();
    
    alternarAbaCliente('res');
}

async function carregarPadroes() {
    try {
        setSyncStatus(true);
        const response = await fetch(`${API_URL}?action=PADROES`);
        tabelaPadroes = await response.json();
        setSyncStatus(false);
    } catch(e) { console.error("Erro ao carregar padrões", e); setSyncStatus(false, "Erro Padrões"); }
}

async function carregarPeriodosDoCliente() {
    const select = document.getElementById('global-periodo-select');
    const selectCompare = document.getElementById('res-compare-select');
    if(select) select.innerHTML = '<option value="">Carregando...</option>';

    try {
        setSyncStatus(true);
        const res = await fetch(`${API_URL}?action=TPERIODO`);
        const data = await res.json();

        listaPeriodos = data.filter(p => String(p.TCLIENTE_ID) === String(usuarioLogado.TCLIENTE_ID));

        if(select) select.innerHTML = '';
        if(selectCompare) selectCompare.innerHTML = '<option value="">Sem Comparativo (Apenas Ativo)</option>';

        listaPeriodos.forEach(p => {
            const optText = formatarNomePeriodoLimpo(p);
            if(select) select.innerHTML += `<option value="${p.TPERIODO_ID}">${optText}</option>`;
            if(selectCompare) selectCompare.innerHTML += `<option value="${p.TPERIODO_ID}">${optText}</option>`;
        });

        const atual = listaPeriodos.find(p => String(p.TPERIODO_ATUAL).toUpperCase() === 'SIM') || listaPeriodos[0];
        if(select) select.value = atual.TPERIODO_ID;
        periodoAtivoObj = atual;

        atualizarTagsPeriodoHeader();
        setSyncStatus(false);

    } catch (e) { 
        console.error("Erro em carregarPeriodosDoCliente:", e);
        setSyncStatus(false, "Erro API"); 
    }
}

function trocarPeriodoAtivo() {
    const id = document.getElementById('global-periodo-select').value;
    if(!id) return;

    periodoAtivoObj = listaPeriodos.find(p => String(p.TPERIODO_ID) === String(id));
    if(!periodoAtivoObj) return;

    atualizarTagsPeriodoHeader();
    carregarTudoDoPeriodo();
}

function carregarTudoDoPeriodo() {
    carregarInvestimentos();
    carregarCentrosDeCusto();
    carregarRecursos();
    carregarBeneficios();
    carregarFuncionarios();
    carregarPlanoContas();
    gerarAnalisesEResultados();
}

function alternarAbaCliente(aba) {
    const idsSeçoes = ['section-resultados', 'section-config-periodo', 'section-centro-custo', 'section-recursos', 'section-beneficios', 'section-funcionarios', 'section-plano-contas', 'section-admin'];
    idsSeçoes.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });

    const classInactive = "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs md:text-sm font-bold text-theme-muted hover:bg-brand-primary/10 hover:text-brand-primary transition";
    const classActive = "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs md:text-sm font-bold bg-brand-primary text-white transition";

    document.querySelectorAll('#sidebar-menu nav button').forEach(btn => btn.className = classInactive);

    const mapaAbaSection = {
        'res': 'section-resultados',
        'cfg': 'section-config-periodo',
        'cc': 'section-centro-custo',
        'rec': 'section-recursos',
        'ben': 'section-beneficios',
        'func': 'section-funcionarios',
        'plc': 'section-plano-contas',
        'adm': 'section-admin'
    };

    const btnTarget = document.getElementById(`nav-btn-${aba}`);
    const secTarget = document.getElementById(mapaAbaSection[aba]);

    if(btnTarget) btnTarget.className = classActive;
    if(secTarget) secTarget.classList.remove('hidden');

    if (aba === 'res') gerarAnalisesEResultados();
}

// CÁLCULOS DRE E RESULTADOS
async function gerarAnalisesEResultados() {
    if (!periodoAtivoObj) return;

    const periodDisplay = document.getElementById('dre-period-display');
    if(periodDisplay) periodDisplay.innerText = formatarNomePeriodoLimpo(periodoAtivoObj);

    const fatBruto = parseFloat(periodoAtivoObj.TPERIODO_FATURAMENTO) || 0;
    const aliqImpostos = parseFloat(periodoAtivoObj.TPERIODO_ALIQUOTA) || 0;
    const retSocios = parseFloat(periodoAtivoObj.TPERIODO_RETIRADA) || 0;

    let cVariavel = 0, dVariavel = 0;
    listaPlanoContas.forEach(p => {
        const crit = String(p.TPLANO_CONTA_CRITERIO || "").toUpperCase();
        const val = parseFloat(p.TPLANO_CONTA_VALOR) || 0;
        if (crit.includes('CUSTO VARIÁVEL') || crit.includes('CUSTO VARIAVEL')) cVariavel += val;
        else if (crit.includes('DESPESA VARIÁVEL') || crit.includes('DESPESA VARIAVEL')) dVariavel += val;
    });

    let sobraMaoObra = 0;
    listaFuncionarios.forEach(f => { sobraMaoObra += (parseFloat(f.TFUNCIONARIO_VALOR_RATEIO) || 0); });

    let cFixoFabril = 0, dFichaAdmin = 0;
    listaCC.forEach(c => {
        const fx = parseFloat(c.TECENTRO_CUSTO_CUSTO_FIXO_DIRETO || c.TCENTRO_CUSTO_CUSTO_FIXO_DIRETO) || 0;
        const dep = parseFloat(c.TCENTRO_CUSTO_CUSTO_MENSAL) || 0;
        const func = parseFloat(c.TCENTRO_CUSTO_CUSTO_FUNCIONARIO) || 0;
        const plc = parseFloat(c.TCENTRO_CUSTO_CUSTO_PLANO_CONTAS) || 0;
        const prd = parseFloat(c.TCENTRO_CUSTO_PREDIO) || 0;
        const cBruto = fx + dep + func + plc + prd;

        const tipoCC = String(c.TCENTRO_CUSTO_TIPO || "").toUpperCase();
        if (tipoCC.includes('PRODUTIVO')) cFixoFabril += cBruto;
        else dFichaAdmin += cBruto;
    });

    const impostosDeducoes = (fatBruto * (aliqImpostos / 100)) + dVariavel;
    const recLiquida = fatBruto - impostosDeducoes;
    const margemContrib = recLiquida - cVariavel;
    const resFabril = margemContrib - cFixoFabril;
    const resLiquido = resFabril - dFichaAdmin - sobraMaoObra - retSocios;

    const containerDRE = document.getElementById('container-dre-rows');
    if(containerDRE) {
        containerDRE.innerHTML = '';

        const montarLinhaDRE = (label, keyLinha, valAtivo, tipoEstilo = 'normal') => {
            const pctA = fatBruto > 0 ? ((valAtivo / fatBruto) * 100).toFixed(1) + "%" : "0.0%";
            let bgStyle = 'py-2 border-b border-brand-border/30 pl-3 text-theme-muted hover:bg-brand-primary/10 cursor-pointer transition';
            let textClass = 'text-theme-main font-bold';

            if (tipoEstilo === 'receita') {
                bgStyle = 'bg-emerald-950/30 border-l-4 border-emerald-500 p-2.5 rounded-r-md font-bold text-emerald-300 shadow-sm hover:bg-emerald-900/40 cursor-pointer transition';
                textClass = 'text-emerald-300 text-sm font-extrabold';
            } else if (tipoEstilo === 'resultado_final') {
                const isPositivo = valAtivo >= 0;
                bgStyle = isPositivo 
                    ? 'bg-gradient-to-r from-emerald-950/80 to-emerald-900/40 border-2 border-emerald-500 p-3.5 rounded-xl font-extrabold text-emerald-400 shadow-xl hover:from-emerald-900/90 cursor-pointer transition' 
                    : 'bg-gradient-to-r from-red-950/80 to-red-900/40 border-2 border-red-500 p-3.5 rounded-xl font-extrabold text-red-400 shadow-xl hover:from-red-900/90 cursor-pointer transition';
                textClass = isPositivo ? 'text-emerald-400 text-lg font-black' : 'text-red-400 text-lg font-black';
            }

            containerDRE.innerHTML += `
                <div onclick="abrirDrilldownDRE('${keyLinha}', '${label}')" class="flex justify-between items-center ${bgStyle}">
                    <span>${label}</span>
                    <div class="space-x-2 text-right">
                        <span class="${textClass}">${formatarMoedaBR(valAtivo)}</span>
                        <span class="text-[11px] font-mono text-theme-muted">(${pctA})</span>
                    </div>
                </div>
            `;
        };

        montarLinhaDRE("(+) RECEITA BRUTA ESPERADA", 'fatBruto', fatBruto, 'receita');
        montarLinhaDRE("(-) Impostos sobre Vendas & Deduções Variáveis", 'impostosDeducoes', impostosDeducoes, 'deducao');
        montarLinhaDRE("(=) RECEITA LÍQUIDA", 'recLiquida', recLiquida, 'receita');
        montarLinhaDRE("(-) Custos Variáveis de Produção (CPV)", 'cVariavel', cVariavel, 'deducao');
        montarLinhaDRE("(=) MARGEM DE CONTRIBUIÇÃO BRUTA", 'margemContrib', margemContrib, 'margem');
        montarLinhaDRE("(-) Custos Fixos Industriais (Fábrica)", 'cFixoFabril', cFixoFabril, 'custo_fabril');
        montarLinhaDRE("(=) RESULTADO BRUTO INDUSTRIAL", 'resFabril', resFabril, 'res_fabril');
        montarLinhaDRE("(-) Despesas Fixas Operacionais (Admin/Vendas)", 'dFichaAdmin', dFichaAdmin, 'deducao');
        montarLinhaDRE("(-) Perdas / Sobra de Mão de Obra Não Alocada", 'sobraMaoObra', sobraMaoObra, 'deducao');
        montarLinhaDRE("(-) Retiradas dos Sócios & Pró-Labore", 'retSocios', retSocios, 'deducao');
        montarLinhaDRE("(=) RESULTADO LÍQUIDO FINAL", 'resLiquido', resLiquido, 'resultado_final');
    }

    let totalMaquinas = 0; listaRecursos.forEach(r => totalMaquinas += (parseFloat(r.TRECURSO_VALOR)||0));
    let totalInvest = 0; listaInvestimentos.forEach(i => totalInvest += (parseFloat(i.TINVESTIMENTO_VALOR)||0));
    const investimentoTotal = (parseFloat(periodoAtivoObj.TPERIODO_PREDIO)||0) + totalMaquinas + totalInvest;

    const elInv = document.getElementById('res-card-investimento-total');
    if(elInv) elInv.innerText = formatarMoedaBR(investimentoTotal);
    
    setSyncStatus(false);
}

function abrirDrilldownDRE(keyLinha, labelLinha) {
    const modal = document.getElementById('modal-drilldown-dre');
    const container = document.getElementById('modal-dre-content');
    if(!modal || !container) return;

    document.getElementById('modal-dre-title').innerText = labelLinha;
    let itemsHtml = '';
    let totalVal = 0;

    if (keyLinha === 'fatBruto') {
        const val = parseFloat(periodoAtivoObj.TPERIODO_FATURAMENTO) || 0;
        totalVal = val;
        itemsHtml = `<div class="flex justify-between bg-input-bg p-3 rounded border border-brand-border text-xs"><span class="font-bold text-theme-main">FATURAMENTO MÉDIO MENSAL ESTIMADO</span><span class="text-emerald-400 font-bold">${formatarMoedaBR(val)}</span></div>`;
    }

    container.innerHTML = itemsHtml || '<p class="text-xs text-theme-muted text-center py-2">Detalhamento dos itens da linha.</p>';
    document.getElementById('modal-dre-total-val').innerText = formatarMoedaBR(totalVal);
    modal.classList.remove('hidden');
}

function fecharModalDRE() {
    const modal = document.getElementById('modal-drilldown-dre');
    if (modal) modal.classList.add('hidden');
}

// CARREGADORES
async function carregarInvestimentos() {}
async function carregarCentrosDeCusto() {}
async function carregarRecursos() {}
async function carregarBeneficios() {}
async function carregarFuncionarios() {}
async function carregarPlanoContas() {}

window.addEventListener('DOMContentLoaded', () => {
    carregarTemaSalvo();
    aplicarMascarasMonetarias();
    const savedUser = localStorage.getItem('usuarioLogadoRF');
    if (savedUser) {
        try {
            usuarioLogado = JSON.parse(savedUser);
            buscarNomeEmpresa().then(() => { iniciarSessao(); });
        } catch(e) { localStorage.removeItem('usuarioLogadoRF'); }
    }
});
