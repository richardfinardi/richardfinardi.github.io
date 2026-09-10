/**
 * 📄 SISTEMA DE PAGINAÇÃO DE TABELAS
 * Gerencia paginação, renderização e navegação de dados em tabelas grandes
 * Uso: const paginator = new Paginator('tbl-body-id', 25); paginator.render();
 */

class Paginator {
    constructor(tbodyId, itemsPerPage = 25) {
        this.tbodyId = tbodyId;
        this.itemsPerPage = itemsPerPage;
        this.currentPage = 1;
        this.allRows = [];
        this.filteredRows = [];
        this.totalPages = 1;
        this.loadAllRows();
    }

    loadAllRows() {
        const tbody = document.getElementById(this.tbodyId);
        if (!tbody) {
            console.warn(`Tbody com ID "${this.tbodyId}" não encontrado`);
            return;
        }
        // Armazenar todas as linhas (inclui as ocultas por filtro)
        this.allRows = Array.from(tbody.querySelectorAll('tr'));
        this.filteredRows = [...this.allRows];
        this.calculateTotalPages();
    }

    calculateTotalPages() {
        this.totalPages = Math.max(1, Math.ceil(this.filteredRows.length / this.itemsPerPage));
        if (this.currentPage > this.totalPages) {
            this.currentPage = this.totalPages;
        }
    }

    render(pageNum = this.currentPage) {
        this.currentPage = Math.max(1, Math.min(pageNum, this.totalPages));
        const tbody = document.getElementById(this.tbodyId);
        
        if (!tbody) return;

        // Calcular índices
        const startIdx = (this.currentPage - 1) * this.itemsPerPage;
        const endIdx = startIdx + this.itemsPerPage;
        const pageRows = this.filteredRows.slice(startIdx, endIdx);

        // Limpar tbody
        tbody.innerHTML = '';

        // Renderizar linhas da página
        if (pageRows.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `<td colspan="100%" class="p-4 text-center text-custom-muted">Nenhum registro encontrado</td>`;
            tbody.appendChild(emptyRow);
        } else {
            pageRows.forEach(row => {
                tbody.appendChild(row.cloneNode(true));
            });
        }

        // Atualizar controles de paginação
        this.updateControls();
    }

    updateControls() {
        const controlsId = `${this.tbodyId}-controls`;
        let controls = document.getElementById(controlsId);

        if (!controls) {
            // Criar controles se não existirem
            const tbody = document.getElementById(this.tbodyId);
            if (!tbody) return;

            const parent = tbody.closest('table')?.parentElement;
            if (!parent) return;

            controls = document.createElement('div');
            controls.id = controlsId;
            controls.className = 'mt-4 flex flex-col md:flex-row justify-between items-center gap-4 p-3 bg-custom-bg rounded-lg border border-custom';
            parent.appendChild(controls);
        }

        // Calcular informações
        const totalItems = this.filteredRows.length;
        const startItem = totalItems === 0 ? 0 : (this.currentPage - 1) * this.itemsPerPage + 1;
        const endItem = Math.min(this.currentPage * this.itemsPerPage, totalItems);

        controls.innerHTML = `
            <div class="text-xs md:text-sm text-custom-muted">
                Mostrando <strong>${startItem}</strong> a <strong>${endItem}</strong> de <strong>${totalItems}</strong> registros
            </div>
            
            <div class="flex items-center gap-2">
                <button onclick="window.paginators['${this.tbodyId}'].previousPage()" 
                        class="px-3 py-1 bg-custom-card border border-custom rounded text-xs font-bold hover:bg-brand-primary/20 transition ${this.currentPage === 1 ? 'opacity-40 cursor-not-allowed' : ''}"
                        ${this.currentPage === 1 ? 'disabled' : ''}>
                    ← Anterior
                </button>
                
                <div class="text-xs md:text-sm text-custom-muted">
                    Página <strong>${this.currentPage}</strong> de <strong>${this.totalPages}</strong>
                </div>
                
                <button onclick="window.paginators['${this.tbodyId}'].nextPage()"
                        class="px-3 py-1 bg-custom-card border border-custom rounded text-xs font-bold hover:bg-brand-primary/20 transition ${this.currentPage === this.totalPages ? 'opacity-40 cursor-not-allowed' : ''}"
                        ${this.currentPage === this.totalPages ? 'disabled' : ''}>
                    Próxima →
                </button>
            </div>

            <div class="flex items-center gap-2">
                <label class="text-xs text-custom-muted">Ir para página:</label>
                <input type="number" min="1" max="${this.totalPages}" value="${this.currentPage}"
                       onchange="window.paginators['${this.tbodyId}'].render(parseInt(this.value))"
                       class="w-16 px-2 py-1 bg-custom-card border border-custom rounded text-xs text-custom-muted focus:border-brand-primary outline-none">
            </div>
        `;
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.render(this.currentPage + 1);
        }
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.render(this.currentPage - 1);
        }
    }

    goToPage(pageNum) {
        this.render(pageNum);
    }

    applyFilter(filterFunction) {
        // Filtrar linhas baseado em função customizada
        this.filteredRows = this.allRows.filter(filterFunction);
        this.calculateTotalPages();
        this.render(1);
    }

    filterByText(query) {
        // Filtrar por texto simples
        const q = query.toLowerCase().trim();
        this.filteredRows = this.allRows.filter(row => 
            row.innerText.toLowerCase().includes(q)
        );
        this.calculateTotalPages();
        this.render(1);
    }

    reset() {
        // Resetar filtro e voltar à primeira página
        this.filteredRows = [...this.allRows];
        this.calculateTotalPages();
        this.render(1);
    }

    search(query) {
        // Alias para filterByText
        this.filterByText(query);
    }
}

// Armazenar instâncias globalmente
if (!window.paginators) {
    window.paginators = {};
}

// Função utilitária para iniciar paginação em uma tabela
function initPaginator(tbodyId, itemsPerPage = 25) {
    if (!window.paginators[tbodyId]) {
        window.paginators[tbodyId] = new Paginator(tbodyId, itemsPerPage);
    }
    window.paginators[tbodyId].render();
    return window.paginators[tbodyId];
}

// Função para limpar todos os paginadores
function clearAllPaginators() {
    Object.keys(window.paginators).forEach(key => {
        const controlsId = `${key}-controls`;
        const controls = document.getElementById(controlsId);
        if (controls) controls.remove();
    });
    window.paginators = {};
}
