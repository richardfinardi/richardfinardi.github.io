/**
 * 🎨 SISTEMA DE NOTIFICAÇÕES TOAST
 * Componente reutilizável para feedback visual em operações
 * Uso: showToast('Sucesso!', 'success'), showToast('Erro', 'error')
 */

class ToastManager {
    constructor() {
        this.toasts = [];
        this.maxToasts = 5;
        this.defaultDuration = 4000;
        this.initContainer();
    }

    initContainer() {
        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'fixed top-4 right-4 z-[9999] space-y-2 pointer-events-none max-w-sm';
            document.body.appendChild(container);
        }
    }

    show(message, type = 'info', duration = this.defaultDuration) {
        // Limitar toasts simultâneos
        if (this.toasts.length >= this.maxToasts) {
            this.toasts[0].remove();
            this.toasts.shift();
        }

        const toastId = `toast-${Date.now()}`;
        const container = document.getElementById('toast-container');
        
        // Definir cores e ícones por tipo
        const config = {
            success: {
                bg: 'bg-emerald-600',
                border: 'border-emerald-500',
                icon: '✅',
                textColor: 'text-white'
            },
            error: {
                bg: 'bg-red-600',
                border: 'border-red-500',
                icon: '❌',
                textColor: 'text-white'
            },
            warning: {
                bg: 'bg-amber-600',
                border: 'border-amber-500',
                icon: '⚠️',
                textColor: 'text-white'
            },
            info: {
                bg: 'bg-blue-600',
                border: 'border-blue-500',
                icon: 'ℹ️',
                textColor: 'text-white'
            }
        };

        const styles = config[type] || config.info;

        const toastHTML = `
            <div id="${toastId}" class="animate-slide-in-right pointer-events-auto ${styles.bg} ${styles.border} border rounded-lg p-4 shadow-lg flex items-start gap-3 min-w-[300px]">
                <span class="text-lg flex-shrink-0">${styles.icon}</span>
                <div class="flex-1 min-w-0">
                    <p class="${styles.textColor} text-sm font-semibold break-words">${message}</p>
                </div>
                <button onclick="document.getElementById('${toastId}').remove()" class="flex-shrink-0 ${styles.textColor} hover:opacity-80 text-lg leading-none">×</button>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', toastHTML);
        const toastEl = document.getElementById(toastId);
        this.toasts.push(toastEl);

        // Auto-remover após duração
        if (duration > 0) {
            setTimeout(() => {
                toastEl.classList.add('animate-slide-out-right');
                setTimeout(() => {
                    toastEl.remove();
                    this.toasts = this.toasts.filter(t => t !== toastEl);
                }, 300);
            }, duration);
        }

        return toastId;
    }

    success(message, duration = this.defaultDuration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = this.defaultDuration) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = this.defaultDuration) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = this.defaultDuration) {
        return this.show(message, 'info', duration);
    }
}

// Instância global
const toastManager = new ToastManager();

// Aliases globais para facilitar uso
function showToast(message, type = 'info', duration = 4000) {
    return toastManager.show(message, type, duration);
}

function showSuccess(message, duration = 4000) {
    return toastManager.success(message, duration);
}

function showError(message, duration = 4000) {
    return toastManager.error(message, duration);
}

function showWarning(message, duration = 4000) {
    return toastManager.warning(message, duration);
}

function showInfo(message, duration = 4000) {
    return toastManager.info(message, duration);
}
