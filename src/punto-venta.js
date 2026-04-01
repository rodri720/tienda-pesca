// punto-venta.js - Versión completa con Caja, Margen, Historial de Gastos y Proveedores
// CORREGIDO: Edición de productos (ya no crea uno nuevo al editar)
// AGREGADO: Campo stock_apertura persistente en base de datos
// AGREGADO: Guardado de cierres en base de datos y botón de historial de cierres
// AGREGADO: Historial de Caja independiente (30 días)
// MODIFICADO: Cierre de caja ya no descuenta saldo (mantiene acumulado)
// MODIFICADO: Nueva categoría "Aporte capital (ingreso)" en gastos que se registra como ingreso en caja
// NUEVO: Ingresos y retiros manuales de caja con botones independientes

class PuntoVentaApp {
    constructor() {
        this.productoActual = null;
        this.carrito = [];
        this.metodoPagoSeleccionado = 'efectivo';
        
        // Cargar comisiones desde localStorage o usar valores por defecto
        this.comisiones = this.cargarComisiones();
        
        window.app = this;
        
        this.init();
    }

    // Cargar comisiones guardadas o valores por defecto
    cargarComisiones() {
        const guardadas = localStorage.getItem('comisiones');
        if (guardadas) {
            return JSON.parse(guardadas);
        }
        // Valores por defecto
        return {
            'debito': 4.59,
            'credito': 7.9,
            'mercadopago': 2.0,
            'efectivo': 0,
            'qr': 0,
            'transferencia': 0
        };
    }

    // Guardar comisiones en localStorage
    guardarComisiones() {
        localStorage.setItem('comisiones', JSON.stringify(this.comisiones));
    }

    init() {
        this.cargarDatos();
        this.setupEventListeners();
        this.actualizarResumenGastos();
        this.actualizarCarrito();
        this.actualizarSaldoCaja();
        this.inicializarCajaDiaria();   // Inicializa registro diario para historial de caja
        this.actualizarHistorialCajaDiario(); // Verifica si cambió el día y guarda el día anterior
        
        setTimeout(() => {
            const skuInput = document.getElementById('sku-input');
            if (skuInput) skuInput.focus();
        }, 500);
    }

    cargarDatos() {
        try {
            const carritoGuardado = localStorage.getItem('carrito');
            if (carritoGuardado) {
                this.carrito = JSON.parse(carritoGuardado);
            }
            
            const ultimoCierre = localStorage.getItem('ultimoCierre');
            const hoy = new Date().toDateString();
            
            if (ultimoCierre !== hoy) {
                localStorage.removeItem('carrito');
                localStorage.removeItem('ventasDelDia');
                localStorage.removeItem('gastosDelDia');
                localStorage.setItem('ultimoCierre', hoy);
            }
            
            // Inicializar caja si no existe
            if (!localStorage.getItem('caja')) {
                const cajaInicial = {
                    saldo: 0,
                    movimientos: []
                };
                localStorage.setItem('caja', JSON.stringify(cajaInicial));
            }

            if (!localStorage.getItem('ventasHistoricas')) {
                localStorage.setItem('ventasHistoricas', JSON.stringify([]));
            }
            
            // Inicializar proveedores si no existe
            if (!localStorage.getItem('proveedores')) {
                localStorage.setItem('proveedores', JSON.stringify([]));
            }

            if (!localStorage.getItem('ventasHistoricas')) {
                localStorage.setItem('ventasHistoricas', JSON.stringify([]));
            }
            
            // Inicializar pagos a proveedores si no existe
            if (!localStorage.getItem('pagosProveedores')) {
                localStorage.setItem('pagosProveedores', JSON.stringify([]));
            }
            
            // Inicializar historial de caja si no existe
            if (!localStorage.getItem('historialCaja')) {
                localStorage.setItem('historialCaja', JSON.stringify([]));
            }
            
        } catch (error) {
            // Silenciar error
        }
    }

    setupEventListeners() {
        const skuInput = document.getElementById('sku-input');
        if (skuInput) {
            skuInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const sku = skuInput.value.trim();
                    if (sku) this.buscarProducto(sku);
                }
            });
        }

        const btnListaPrecios = document.getElementById('btn-lista-precios');
        if (btnListaPrecios) {
            btnListaPrecios.addEventListener('click', (e) => {
                e.preventDefault();
                this.abrirListaPrecios();
            });
        }

        const btnRegistrarGasto = document.getElementById('btn-registrar-gasto');
        if (btnRegistrarGasto) {
            btnRegistrarGasto.addEventListener('click', (e) => {
                e.preventDefault();
                this.abrirModalGasto();
            });
        }

        const btnLimpiar = document.getElementById('btn-limpiar');
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', (e) => {
                e.preventDefault();
                this.limpiarBusqueda();
            });
        }

        const btnDashboard = document.getElementById('btn-dashboard');
        if (btnDashboard) {
            btnDashboard.addEventListener('click', (e) => {
                e.preventDefault();
                this.irAlDashboard();
            });
        }

        const btnCierreCaja = document.getElementById('btn-cierre-caja');
        if (btnCierreCaja) {
            btnCierreCaja.addEventListener('click', (e) => {
                e.preventDefault();
                this.abrirCierreCaja();
            });
        }

        const btnDevolucion = document.getElementById('btn-devolucion');
        if (btnDevolucion) {
            btnDevolucion.addEventListener('click', (e) => {
                e.preventDefault();
                this.abrirModalDevolucion();
            });
        }

        const btnImprimirGastos = document.getElementById('btn-imprimir-gastos');
        if (btnImprimirGastos) {
            btnImprimirGastos.addEventListener('click', (e) => {
                e.preventDefault();
                this.imprimirReporteGastos();
            });
        }

        // Delegación de eventos para el botón SALDO CAJA (funciona incluso si el DOM cambia)
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('#btn-saldo-caja');
            if (btn) {
                e.preventDefault();
                this.mostrarSaldoCaja();
            }
        });

        const btnHistorialGastos = document.getElementById('btn-historial-gastos');
        if (btnHistorialGastos) {
            btnHistorialGastos.addEventListener('click', (e) => {
                e.preventDefault();
                this.mostrarHistorialGastos();
            });
        }

        const btnProveedores = document.getElementById('btn-proveedores');
        if (btnProveedores) {
            btnProveedores.addEventListener('click', (e) => {
                e.preventDefault();
                this.mostrarListaProveedores();
            });
        }

        const btnNuevoProducto = document.getElementById('btn-nuevo-producto');
        if (btnNuevoProducto) {
            btnNuevoProducto.addEventListener('click', (e) => {
                e.preventDefault();
                this.abrirModalNuevoProducto();
            });
        }

        // Botón para historial de cierres
        const btnHistorialCierres = document.getElementById('btn-historial-cierres');
        if (btnHistorialCierres) {
            btnHistorialCierres.addEventListener('click', (e) => {
                e.preventDefault();
                this.mostrarHistorialCierres();
            });
        } else {
            // Si no existe en el HTML, se puede crear dinámicamente pero mejor que esté en el HTML
            console.warn("No se encontró el botón btn-historial-cierres");
        }

        // Botón para historial de caja (nuevo)
        const btnHistorialCaja = document.getElementById('btn-historial-caja');
        if (btnHistorialCaja) {
            btnHistorialCaja.addEventListener('click', (e) => {
                e.preventDefault();
                this.mostrarHistorialCaja();
            });
        } else {
            console.warn("No se encontró el botón btn-historial-caja");
        }

        // ========== NUEVO: Botones de ingreso y retiro manual de caja ==========
        const btnIngreso = document.getElementById('btn-ingreso-caja');
        if (btnIngreso) {
            btnIngreso.addEventListener('click', (e) => {
                e.preventDefault();
                this.abrirModalIngreso();
            });
        }

        const btnRetiro = document.getElementById('btn-retiro-caja');
        if (btnRetiro) {
            btnRetiro.addEventListener('click', (e) => {
                e.preventDefault();
                this.abrirModalRetiro();
            });
        }
        // ========================================================================

        document.addEventListener('DOMContentLoaded', () => {
            const btnDevolucion = document.getElementById('btn-devolucion');
            if (btnDevolucion) {
                btnDevolucion.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.abrirModalDevolucion();
                });
            }

            if (app && typeof app.limpiarCierresAntiguos === 'function') {
                app.limpiarCierresAntiguos();
            }
        });

        const btnConfigComisiones = document.getElementById('btn-config-comisiones');
        if (btnConfigComisiones) {
            btnConfigComisiones.addEventListener('click', (e) => {
                e.preventDefault();
                this.abrirConfiguracionComisiones();
            });
        }

        this.setupButton('btn-vaciar-carrito', () => this.vaciarCarrito());
        this.setupButton('btn-imprimir-cierre', () => this.imprimirCierreCaja());
        this.setupButton('btn-registrar-cierre', () => this.registrarCierreCaja());

        const formGasto = document.getElementById('form-gasto');
        if (formGasto) {
            formGasto.addEventListener('submit', (e) => this.guardarGasto(e));
        }
        document.addEventListener('click', (e) => {
            if (e.target.id === 'btn-finalizar-venta' || e.target.closest('#btn-finalizar-venta')) {
                this.finalizarVenta();
            }
        });

       
        // Delegación de eventos para botones de cerrar modal
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-cerrar-modal') || e.target.closest('.btn-cerrar-modal')) {
                const btn = e.target.closest('.btn-cerrar-modal');
                const modalId = btn.dataset.modal;
                if (modalId) {
                    this.cerrarModal(modalId);
                    const modal = document.getElementById(modalId);
                    if (modal && modalId.startsWith('modal-') && !modalId.includes('gasto') && !modalId.includes('proveedores')) {
                        modal.remove();
                    }
                    setTimeout(() => {
                        const skuInput = document.getElementById('sku-input');
                        if (skuInput) skuInput.focus();
                    }, 100);
                }
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.cerrarTodosModales();
                setTimeout(() => {
                    const skuInput = document.getElementById('sku-input');
                    if (skuInput) skuInput.focus();
                }, 100);
            }
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                    setTimeout(() => {
                        const skuInput = document.getElementById('sku-input');
                        if (skuInput) skuInput.focus();
                    }, 100);
                }
            });
        });
    }

    setupButton(id, callback) {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', callback);
        }
    }

    verificarStockMinimo() {
        const productos = JSON.parse(localStorage.getItem('productos')) || [];
        const productosBajoStock = productos.filter(p => p.stock <= (p.stock_minimo || 5));
        
        if (productosBajoStock.length > 0) {
            let mensaje = '⚠️ PRODUCTOS CON STOCK BAJO:\n\n';
            productosBajoStock.forEach(p => {
                mensaje += `• ${p.nombre} (SKU: ${p.sku}): ${p.stock} unidades (mínimo ${p.stock_minimo || 5})\n`;
            });
            alert(mensaje);
        }
    }

    // ==================== CONFIGURACIÓN DE COMISIONES ====================
    abrirConfiguracionComisiones() {
        let modal = document.getElementById('modal-config-comisiones');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-config-comisiones';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3><i class="fas fa-sliders-h"></i> Configurar Comisiones</h3>
                    <button class="btn-cerrar-modal" data-modal="modal-config-comisiones" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="form-config-comisiones" style="padding: 20px;">
                    <div class="form-group">
                        <label>Débito (%)</label>
                        <input type="number" id="comision-debito" class="form-control" step="0.01" min="0" value="${this.comisiones.debito}">
                    </div>
                    <div class="form-group">
                        <label>Crédito (%)</label>
                        <input type="number" id="comision-credito" class="form-control" step="0.01" min="0" value="${this.comisiones.credito}">
                    </div>
                    <div class="form-group">
                        <label>Mercado Pago (%)</label>
                        <input type="number" id="comision-mercadopago" class="form-control" step="0.01" min="0" value="${this.comisiones.mercadopago}">
                    </div>
                    <div class="form-group">
                        <label>Efectivo (%)</label>
                        <input type="number" id="comision-efectivo" class="form-control" step="0.01" min="0" value="${this.comisiones.efectivo}">
                    </div>
                    <div class="form-group">
                        <label>QR (%)</label>
                        <input type="number" id="comision-qr" class="form-control" step="0.01" min="0" value="${this.comisiones.qr}">
                    </div>
                    <div class="form-group">
                        <label>Transferencia (%)</label>
                        <input type="number" id="comision-transferencia" class="form-control" step="0.01" min="0" value="${this.comisiones.transferencia}">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary btn-cerrar-modal" data-modal="modal-config-comisiones">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        `;

        this.abrirModal('modal-config-comisiones');

        const form = document.getElementById('form-config-comisiones');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.comisiones = {
                debito: parseFloat(document.getElementById('comision-debito').value) || 0,
                credito: parseFloat(document.getElementById('comision-credito').value) || 0,
                mercadopago: parseFloat(document.getElementById('comision-mercadopago').value) || 0,
                efectivo: parseFloat(document.getElementById('comision-efectivo').value) || 0,
                qr: parseFloat(document.getElementById('comision-qr').value) || 0,
                transferencia: parseFloat(document.getElementById('comision-transferencia').value) || 0
            };
            this.guardarComisiones();
            this.cerrarModal('modal-config-comisiones');
            this.mostrarNotificacion('✅ Comisiones actualizadas');
        });
    }

    // ==================== FUNCIONES DE CAJA (SALDO) ====================
    actualizarSaldoCaja() {
        const caja = JSON.parse(localStorage.getItem('caja')) || { saldo: 0, movimientos: [] };
        const saldoElement = document.getElementById('saldo-caja');
        if (saldoElement) {
            saldoElement.textContent = `$${caja.saldo.toFixed(2)}`;
        }
    }

    agregarIngreso(monto, concepto, metodo, referencia = '') {
        const caja = JSON.parse(localStorage.getItem('caja')) || { saldo: 0, movimientos: [] };
        caja.saldo += monto;
        caja.movimientos.push({
            tipo: 'ingreso',
            monto: monto,
            concepto: concepto,
            metodo: metodo,
            referencia: referencia,
            fecha: new Date().toISOString()
        });
        localStorage.setItem('caja', JSON.stringify(caja));
        this.actualizarSaldoCaja();
        // Actualizar el registro diario de caja
        this.actualizarCajaDiaria(monto, 'ingreso', concepto);
    }

    agregarEgreso(monto, concepto, metodo, referencia = '') {
        const caja = JSON.parse(localStorage.getItem('caja')) || { saldo: 0, movimientos: [] };
        caja.saldo -= monto;
        caja.movimientos.push({
            tipo: 'egreso',
            monto: monto,
            concepto: concepto,
            metodo: metodo,
            referencia: referencia,
            fecha: new Date().toISOString()
        });
        localStorage.setItem('caja', JSON.stringify(caja));
        this.actualizarSaldoCaja();
        // Actualizar el registro diario de caja
        this.actualizarCajaDiaria(monto, 'egreso', concepto);
    }

    // ========== NUEVO: MÉTODOS PARA INGRESO Y RETIRO MANUAL ==========
    abrirModalIngreso() {
        let modal = document.getElementById('modal-ingreso-caja');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-ingreso-caja';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-arrow-down"></i> Ingreso de Caja</h3>
                    <button class="btn-cerrar-modal" data-modal="modal-ingreso-caja" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="form-ingreso-caja">
                    <div class="form-group">
                        <label>Monto *</label>
                        <input type="number" id="ingreso-monto" class="form-control" step="0.01" min="0.01" required>
                    </div>
                    <div class="form-group">
                        <label>Método de pago *</label>
                        <select id="ingreso-metodo" class="form-control" required>
                            <option value="efectivo">Efectivo</option>
                            <option value="debito">Débito</option>
                            <option value="credito">Crédito</option>
                            <option value="transferencia">Transferencia</option>
                            <option value="qr">QR</option>
                            <option value="mercadopago">Mercado Pago</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Concepto / Descripción *</label>
                        <input type="text" id="ingreso-concepto" class="form-control" placeholder="Ej: Aporte de capital, Depósito, etc." required>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary btn-cerrar-modal" data-modal="modal-ingreso-caja">Cancelar</button>
                        <button type="submit" class="btn btn-success">Registrar Ingreso</button>
                    </div>
                </form>
            </div>
        `;

        this.abrirModal('modal-ingreso-caja');

        const form = document.getElementById('form-ingreso-caja');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const monto = parseFloat(document.getElementById('ingreso-monto').value);
            const metodo = document.getElementById('ingreso-metodo').value;
            const concepto = document.getElementById('ingreso-concepto').value.trim();

            if (!monto || monto <= 0) {
                this.mostrarError('Ingrese un monto válido');
                return;
            }
            if (!concepto) {
                this.mostrarError('Ingrese un concepto');
                return;
            }

            this.agregarIngreso(monto, concepto, metodo, 'ingreso_manual');
            this.cerrarModal('modal-ingreso-caja');
            this.mostrarNotificacion(`✅ Ingreso de $${monto.toFixed(2)} registrado`);
        });
    }

    abrirModalRetiro() {
        let modal = document.getElementById('modal-retiro-caja');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-retiro-caja';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-arrow-up"></i> Retiro de Caja</h3>
                    <button class="btn-cerrar-modal" data-modal="modal-retiro-caja" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="form-retiro-caja">
                    <div class="form-group">
                        <label>Monto *</label>
                        <input type="number" id="retiro-monto" class="form-control" step="0.01" min="0.01" required>
                    </div>
                    <div class="form-group">
                        <label>Método de pago *</label>
                        <select id="retiro-metodo" class="form-control" required>
                            <option value="efectivo">Efectivo</option>
                            <option value="debito">Débito</option>
                            <option value="credito">Crédito</option>
                            <option value="transferencia">Transferencia</option>
                            <option value="qr">QR</option>
                            <option value="mercadopago">Mercado Pago</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Concepto / Descripción *</label>
                        <input type="text" id="retiro-concepto" class="form-control" placeholder="Ej: Retiro del dueño, Pago personal, etc." required>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary btn-cerrar-modal" data-modal="modal-retiro-caja">Cancelar</button>
                        <button type="submit" class="btn btn-danger">Registrar Retiro</button>
                    </div>
                </form>
            </div>
        `;

        this.abrirModal('modal-retiro-caja');

        const form = document.getElementById('form-retiro-caja');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const monto = parseFloat(document.getElementById('retiro-monto').value);
            const metodo = document.getElementById('retiro-metodo').value;
            const concepto = document.getElementById('retiro-concepto').value.trim();

            if (!monto || monto <= 0) {
                this.mostrarError('Ingrese un monto válido');
                return;
            }
            if (!concepto) {
                this.mostrarError('Ingrese un concepto');
                return;
            }

            // Verificar saldo suficiente
            const caja = JSON.parse(localStorage.getItem('caja')) || { saldo: 0 };
            if (monto > caja.saldo) {
                this.mostrarError(`Saldo insuficiente. Disponible: $${caja.saldo.toFixed(2)}`);
                return;
            }

            this.agregarEgreso(monto, concepto, metodo, 'retiro_manual');
            this.cerrarModal('modal-retiro-caja');
            this.mostrarNotificacion(`✅ Retiro de $${monto.toFixed(2)} registrado`);
        });
    }
    // ===============================================================

    mostrarSaldoCaja() {
        // Crear un modal para ingresar la clave
        const modalClave = document.createElement('div');
        modalClave.className = 'modal';
        modalClave.id = 'modal-clave-caja';
        modalClave.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h3><i class="fas fa-lock"></i> Ingrese clave</h3>
                    <button class="btn-cerrar-modal" data-modal="modal-clave-caja" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding: 20px;">
                    <input type="password" id="clave-caja-input" class="form-control" placeholder="Clave" style="margin-bottom: 20px;">
                    <div class="form-actions">
                        <button class="btn btn-secondary btn-cerrar-modal" data-modal="modal-clave-caja">Cancelar</button>
                        <button class="btn btn-primary" id="btn-verificar-clave">Verificar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalClave);
        this.abrirModal('modal-clave-caja');

        const btnVerificar = document.getElementById('btn-verificar-clave');
        if (btnVerificar) {
            btnVerificar.addEventListener('click', () => {
                const clave = document.getElementById('clave-caja-input').value;
                if (clave === 'naty') {
                    this.cerrarModal('modal-clave-caja');
                    const modal = document.getElementById('modal-clave-caja');
                    if (modal) modal.remove();
                    this.mostrarSaldoCajaInterno();
                } else {
                    alert('❌ Clave incorrecta');
                }
            });
        }

        const inputClave = document.getElementById('clave-caja-input');
        if (inputClave) {
            inputClave.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    document.getElementById('btn-verificar-clave').click();
                }
            });
        }
    }

    mostrarSaldoCajaInterno() {
        const caja = JSON.parse(localStorage.getItem('caja')) || { saldo: 0, movimientos: [] };

        const saldoPorMetodo = {};
        caja.movimientos.forEach(mov => {
            if (!saldoPorMetodo[mov.metodo]) {
                saldoPorMetodo[mov.metodo] = 0;
            }
            if (mov.tipo === 'ingreso') {
                saldoPorMetodo[mov.metodo] += mov.monto;
            } else {
                saldoPorMetodo[mov.metodo] -= mov.monto;
            }
        });

        const metodos = ['efectivo', 'debito', 'credito', 'qr', 'transferencia', 'mercadopago'];

        let modal = document.getElementById('modal-saldo-caja');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-saldo-caja';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        const actualizarCajaYRefrescar = (nuevaCaja) => {
            localStorage.setItem('caja', JSON.stringify(nuevaCaja));
            this.mostrarSaldoCajaInterno();
        };

        const eliminarMovimiento = (movimientoAEliminar) => {
            if (!confirm(`¿Eliminar este movimiento?\n${movimientoAEliminar.tipo} - $${movimientoAEliminar.monto} (${movimientoAEliminar.metodo})`)) return;

            const nuevosMovimientos = caja.movimientos.filter(mov =>
                !(mov.tipo === movimientoAEliminar.tipo &&
                  mov.monto === movimientoAEliminar.monto &&
                  mov.metodo === movimientoAEliminar.metodo &&
                  mov.fecha === movimientoAEliminar.fecha &&
                  mov.descripcion === movimientoAEliminar.descripcion)
            );

            const nuevoSaldo = nuevosMovimientos.reduce((total, mov) => {
                return mov.tipo === 'ingreso' ? total + mov.monto : total - mov.monto;
            }, 0);

            actualizarCajaYRefrescar({ saldo: nuevoSaldo, movimientos: nuevosMovimientos });
        };

        const reiniciarCaja = () => {
            if (confirm('¿Está seguro de reiniciar la caja? Se eliminarán TODOS los movimientos.')) {
                actualizarCajaYRefrescar({ saldo: 0, movimientos: [] });
            }
        };

        const movimientosOrdenados = [...caja.movimientos].reverse();

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3><i class="fas fa-wallet"></i> Saldo en Caja</h3>
                    <button class="btn-cerrar-modal" data-modal="modal-saldo-caja" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding: 20px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <div style="font-size: 0.9rem; color: #718096;">DISPONIBLE TOTAL</div>
                        <div style="font-size: 3rem; font-weight: 700; color: var(--primary);">$${caja.saldo.toFixed(2)}</div>
                    </div>

                    <h4 style="margin: 20px 0 10px;">Desglose por método de pago</h4>
                    <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 25px;">
                        ${metodos.map(metodo => {
                            const monto = saldoPorMetodo[metodo] || 0;
                            if (monto === 0) return '';
                            return `
                                <div style="display: flex; justify-content: space-between; padding: 12px 15px; border-bottom: 1px solid #e2e8f0;">
                                    <span style="font-weight: 600; text-transform: capitalize;">${metodo}</span>
                                    <span style="font-weight: 700; color: ${monto >= 0 ? '#48bb78' : '#f56565'};">$${monto.toFixed(2)}</span>
                                </div>
                            `;
                        }).join('')}
                        ${Object.keys(saldoPorMetodo).length === 0 ? '<p style="text-align: center; padding: 20px;">No hay movimientos registrados</p>' : ''}
                    </div>

                    <h4 style="margin: 20px 0 10px;">Movimientos recientes</h4>
                    <div id="lista-movimientos-caja" style="max-height: 300px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
                        ${movimientosOrdenados.length === 0 ? '<p style="text-align: center; padding: 20px;">No hay movimientos</p>' : ''}
                        ${movimientosOrdenados.map(mov => {
                            const movData = encodeURIComponent(JSON.stringify(mov));
                            return `
                                <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 8px; position: relative; background: #f9f9f9;">
                                    <div style="position: absolute; top: 8px; right: 8px; display: flex; gap: 8px;">
                                        <button class="btn-detalle-movimiento" data-movimiento="${movData}" style="background: none; border: none; color: #3182ce; cursor: pointer; font-size: 1rem;" title="Ver detalles">
                                            <i class="fas fa-info-circle"></i>
                                        </button>
                                        <button class="btn-eliminar-movimiento" data-movimiento="${movData}" style="background: none; border: none; color: #f56565; cursor: pointer; font-size: 1rem;" title="Eliminar movimiento">
                                            <i class="fas fa-trash-alt"></i>
                                        </button>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <div>
                                            <strong style="color: ${mov.tipo === 'ingreso' ? '#48bb78' : '#f56565'}; text-transform: uppercase;">${mov.tipo}</strong>
                                            <span style="margin-left: 10px; font-weight: 600;">$${mov.monto.toFixed(2)}</span>
                                            <span style="margin-left: 10px; font-size: 0.9rem; color: #718096;">${mov.metodo}</span>
                                            ${mov.concepto ? `<div style="font-size: 0.85rem; color: #4a5568;">${mov.concepto}</div>` : ''}
                                        </div>
                                        <div style="font-size: 0.8rem; color: #a0aec0;">
                                            ${new Date(mov.fecha).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                <div class="form-actions" style="padding: 20px; display: flex; gap: 10px; justify-content: space-between;">
                    <button class="btn btn-danger" id="btn-reiniciar-caja" style="background-color: #e53e3e; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
                        <i class="fas fa-trash-alt"></i> Reiniciar caja
                    </button>
                    <button class="btn btn-secondary btn-cerrar-modal" data-modal="modal-saldo-caja" style="background-color: #718096; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
                        Cerrar
                    </button>
                </div>
            </div>
        `;

        const btnReiniciar = document.getElementById('btn-reiniciar-caja');
        if (btnReiniciar) {
            btnReiniciar.addEventListener('click', reiniciarCaja);
        }

        const listaMovimientos = document.getElementById('lista-movimientos-caja');
        if (listaMovimientos) {
            listaMovimientos.addEventListener('click', (e) => {
                const btnEliminar = e.target.closest('.btn-eliminar-movimiento');
                if (btnEliminar) {
                    const movData = btnEliminar.getAttribute('data-movimiento');
                    if (movData) {
                        try {
                            const movimiento = JSON.parse(decodeURIComponent(movData));
                            eliminarMovimiento(movimiento);
                        } catch (error) {}
                    }
                }

                const btnDetalle = e.target.closest('.btn-detalle-movimiento');
                if (btnDetalle) {
                    const movData = btnDetalle.getAttribute('data-movimiento');
                    if (movData) {
                        try {
                            const movimiento = JSON.parse(decodeURIComponent(movData));
                            this.mostrarDetalleMovimiento(movimiento);
                        } catch (error) {}
                    }
                }
            });
        }

        this.abrirModal('modal-saldo-caja');
    }

    // ==================== FUNCIÓN PARA MOSTRAR DETALLE DE MOVIMIENTO ====================
    mostrarDetalleMovimiento(movimiento) {
        const { tipo, referencia, monto, metodo, concepto, fecha } = movimiento;

        if (tipo === 'ingreso' && referencia) {
            // Buscar la venta por ID
            const ventasDelDia = JSON.parse(localStorage.getItem('ventasDelDia')) || [];
            const ventasHistoricas = JSON.parse(localStorage.getItem('ventasHistoricas')) || [];
            const venta = [...ventasDelDia, ...ventasHistoricas].find(v => v.id.toString() === referencia);

            if (venta) {
                this.mostrarDetalleVenta(venta);
            } else {
                alert('No se encontró la venta correspondiente.');
            }
        } 
        else if (tipo === 'egreso' && referencia) {
            // Buscar el gasto por ID
            const gastosDelDia = JSON.parse(localStorage.getItem('gastosDelDia')) || [];
            const gastosHistoricos = JSON.parse(localStorage.getItem('gastosHistoricos')) || [];
            const gasto = [...gastosDelDia, ...gastosHistoricos].find(g => g.id.toString() === referencia);

            if (gasto) {
                this.mostrarDetalleGasto(gasto);
            } else {
                alert('No se encontró el gasto correspondiente.');
            }
        } 
        else {
            // Movimiento sin referencia (ej: ajuste manual de caja)
            alert(`Movimiento: ${concepto}\nMonto: $${monto.toFixed(2)}\nMétodo: ${metodo}\nFecha: ${new Date(fecha).toLocaleString()}`);
        }
    }


    mostrarDetalleVenta(venta) {
        const fecha = new Date(venta.fecha);
        const fechaStr = fecha.toLocaleString('es-ES');

        let html = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3><i class="fas fa-receipt"></i> Detalle de Venta #${venta.id}</h3>
                    <button class="btn-cerrar-modal" data-modal="modal-detalle-venta" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding: 20px;">
                    <div><strong>Fecha:</strong> ${fechaStr}</div>
                    <div><strong>Método de pago:</strong> ${venta.metodo_pago.toUpperCase()}</div>
                    <div><strong>Total pagado:</strong> $${venta.total.toFixed(2)}</div>
                    ${venta.descuento_aplicado ? `<div><strong>Descuento:</strong> -$${venta.descuento_aplicado.toFixed(2)}</div>` : ''}
                    ${venta.recargo_aplicado ? `<div><strong>Recargo:</strong> +$${venta.recargo_aplicado.toFixed(2)}</div>` : ''}
                    ${venta.comision_monto ? `<div><strong>Comisión (${venta.comision_porcentaje}%):</strong> -$${venta.comision_monto.toFixed(2)}</div>` : ''}
                    ${venta.total_neto ? `<div><strong>Neto recibido:</strong> $${venta.total_neto.toFixed(2)}</div>` : ''}
                    ${venta.monto_recibido ? `<div><strong>Recibido:</strong> $${venta.monto_recibido.toFixed(2)}</div>` : ''}
                    ${venta.vuelto ? `<div><strong>Vuelto:</strong> $${venta.vuelto.toFixed(2)}</div>` : ''}

                    <h4 style="margin-top: 20px;">Productos</h4>
                    <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead style="background: #f8fafc;">
                                <tr><th style="padding: 8px; text-align: left;">Producto</th><th style="padding: 8px; text-align: center;">Cant.</th><th style="padding: 8px; text-align: right;">Precio</th><th style="padding: 8px; text-align: right;">Subtotal</th>  </thead>
                            <tbody>
        `;

        venta.productos.forEach(prod => {
            html += `
                <tr style="border-top: 1px solid #e2e8f0;">
                    <td style="padding: 8px;">${prod.nombre}</td>
                    <td style="padding: 8px; text-align: center;">${prod.cantidad}</td>
                    <td style="padding: 8px; text-align: right;">$${prod.precio.toFixed(2)}</td>
                    <td style="padding: 8px; text-align: right;">$${prod.subtotal.toFixed(2)}</td>
                </tr>
            `;
        });

        html += `
                            </tbody>
                        </table>
                    </div>
                    <div class="form-actions" style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                        <button class="btn btn-secondary btn-cerrar-modal" data-modal="modal-detalle-venta">Cerrar</button>
                        <button class="btn btn-primary" id="imprimir-ticket-detalle" onclick="app.imprimirTicket(${JSON.stringify(venta).replace(/"/g, '&quot;')})">
                            <i class="fas fa-print"></i> Imprimir Ticket
                        </button>
                    </div>
                </div>
            </div>
        `;

        let modal = document.getElementById('modal-detalle-venta');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-detalle-venta';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }
        modal.innerHTML = html;
        this.abrirModal('modal-detalle-venta');
    }
    mostrarDetalleGasto(gasto) {
        const fecha = new Date(gasto.fecha);
        const fechaStr = fecha.toLocaleString('es-ES');

        let html = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3><i class="fas fa-receipt"></i> Detalle de Gasto #${gasto.id}</h3>
                    <button class="btn-cerrar-modal" data-modal="modal-detalle-gasto" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding: 20px;">
                    <div><strong>Fecha:</strong> ${fechaStr}</div>
                    <div><strong>Descripción:</strong> ${gasto.descripcion}</div>
                    <div><strong>Categoría:</strong> ${gasto.categoria}</div>
                    <div><strong>Método de pago:</strong> ${gasto.metodo_pago}</div>
                    <div><strong>Monto:</strong> <span style="color:#e53e3e;">-$${gasto.monto.toFixed(2)}</span></div>
                    ${gasto.proveedor ? `<div><strong>Proveedor:</strong> ${gasto.proveedor}</div>` : ''}
                    ${gasto.comprobante ? `<div><strong>Comprobante:</strong> ${gasto.comprobante}</div>` : ''}
                    ${gasto.observaciones ? `<div><strong>Observaciones:</strong> ${gasto.observaciones}</div>` : ''}
                    <div class="form-actions" style="margin-top: 20px;">
                        <button class="btn btn-secondary btn-cerrar-modal" data-modal="modal-detalle-gasto">Cerrar</button>
                    </div>
                </div>
            </div>
        `;

        let modal = document.getElementById('modal-detalle-gasto');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-detalle-gasto';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }
        modal.innerHTML = html;
        this.abrirModal('modal-detalle-gasto');
    }

    // ==================== NUEVO: HISTORIAL DE CAJA (DIARIO) ====================
    inicializarCajaDiaria() {
        // Estructura para llevar el resumen del día actual
        let cajaDiaria = localStorage.getItem('cajaDiaria');
        if (!cajaDiaria) {
            const hoy = new Date().toISOString().split('T')[0];
            const caja = JSON.parse(localStorage.getItem('caja')) || { saldo: 0 };
            const nuevoDia = {
                fecha: hoy,
                saldoInicial: caja.saldo,
                totalIngresos: 0,
                totalEgresos: 0,
                saldoFinal: caja.saldo,
                movimientos: []
            };
            localStorage.setItem('cajaDiaria', JSON.stringify(nuevoDia));
        }
    }

    actualizarCajaDiaria(monto, tipo, concepto) {
        let cajaDiaria = JSON.parse(localStorage.getItem('cajaDiaria'));
        const hoy = new Date().toISOString().split('T')[0];
        
        // Si la fecha guardada es diferente a hoy, finalizar el día anterior y empezar uno nuevo
        if (cajaDiaria.fecha !== hoy) {
            this.guardarDiaEnHistorial(cajaDiaria);
            const caja = JSON.parse(localStorage.getItem('caja')) || { saldo: 0 };
            cajaDiaria = {
                fecha: hoy,
                saldoInicial: caja.saldo,
                totalIngresos: 0,
                totalEgresos: 0,
                saldoFinal: caja.saldo,
                movimientos: []
            };
        }
        
        // Actualizar totales y movimientos
        if (tipo === 'ingreso') {
            cajaDiaria.totalIngresos += monto;
        } else {
            cajaDiaria.totalEgresos += monto;
        }
        cajaDiaria.saldoFinal = (cajaDiaria.saldoInicial + cajaDiaria.totalIngresos) - cajaDiaria.totalEgresos;
        cajaDiaria.movimientos.push({
            tipo: tipo,
            monto: monto,
            concepto: concepto,
            fecha: new Date().toISOString()
        });
        
        localStorage.setItem('cajaDiaria', JSON.stringify(cajaDiaria));
    }

    guardarDiaEnHistorial(dia) {
        const historial = JSON.parse(localStorage.getItem('historialCaja')) || [];
        historial.push(dia);
        // Mantener solo últimos 30 días
        while (historial.length > 30) historial.shift();
        localStorage.setItem('historialCaja', JSON.stringify(historial));
    }

    actualizarHistorialCajaDiario() {
        // Llamado al iniciar: si el día cambió, guarda el anterior
        let cajaDiaria = JSON.parse(localStorage.getItem('cajaDiaria'));
        const hoy = new Date().toISOString().split('T')[0];
        if (cajaDiaria && cajaDiaria.fecha !== hoy) {
            this.guardarDiaEnHistorial(cajaDiaria);
            // Reiniciar con el día actual
            const caja = JSON.parse(localStorage.getItem('caja')) || { saldo: 0 };
            const nuevoDia = {
                fecha: hoy,
                saldoInicial: caja.saldo,
                totalIngresos: 0,
                totalEgresos: 0,
                saldoFinal: caja.saldo,
                movimientos: []
            };
            localStorage.setItem('cajaDiaria', JSON.stringify(nuevoDia));
        } else if (!cajaDiaria) {
            this.inicializarCajaDiaria();
        }
    }

    // ==================== NUEVO: HISTORIAL DE CAJA (ahora muestra los resúmenes diarios) ====================
    async mostrarHistorialCaja() {
        let cierres = [];
        if (window.api && window.api.getCierres) {
            try {
                cierres = await window.api.getCierres(100);
            } catch (error) {
                console.error("Error al obtener cierres de BD:", error);
            }
        }
        if (cierres.length === 0) {
            cierres = JSON.parse(localStorage.getItem('cierresHistoricos')) || [];
        }

        if (cierres.length === 0) {
            alert('No hay cierres de caja registrados.');
            return;
        }

        // Ordenar de más reciente a más antiguo
        cierres.reverse();

        let modal = document.getElementById('modal-historial-caja');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-historial-caja';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        let html = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h3><i class="fas fa-history"></i> Historial de Caja (Cierres)</h3>
                    <button class="btn-cerrar-modal" data-modal="modal-historial-caja" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding: 20px; max-height: 600px; overflow-y: auto;">
        `;

        for (const cierre of cierres) {
            const fecha = new Date(cierre.fecha).toLocaleDateString('es-ES');
            html += `
                <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 25px; background: white;">
                    <h4 style="margin: 0 0 10px;">${fecha} (ID: ${cierre.id})</h4>
                    <div style="display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; margin-bottom: 15px;">
                        <div><strong>Ventas:</strong> $${cierre.totalVentas.toFixed(2)} (${cierre.cantidadVentas} ventas)</div>
                        <div><strong>Comisiones:</strong> -$${cierre.totalComisiones.toFixed(2)}</div>
                        <div><strong>Gastos:</strong> -$${cierre.totalGastos.toFixed(2)}</div>
                        <div><strong>Neto depositado:</strong> $${cierre.netoDepositar.toFixed(2)}</div>
                    </div>
                    <h5>Ventas por método</h5>
                    <div style="margin-bottom: 15px;">
            `;
            if (cierre.ventasPorMetodo && Object.keys(cierre.ventasPorMetodo).length > 0) {
                for (const [metodo, datos] of Object.entries(cierre.ventasPorMetodo)) {
                    html += `<div><strong>${metodo.toUpperCase()}</strong>: $${datos.total.toFixed(2)} (${datos.cantidad} ventas)</div>`;
                }
            } else {
                html += '<div>No hay datos</div>';
            }
            html += `
                    </div>
                    <button class="btn btn-sm btn-info" onclick="app.verVentasDelDia('${new Date(cierre.fecha).toISOString().split('T')[0]}')">
                        <i class="fas fa-eye"></i> Ver ventas de ese día
                    </button>
                </div>
            `;
        }

        html += `
                </div>
                <div class="form-actions" style="padding: 20px;">
                    <button class="btn btn-secondary btn-cerrar-modal" data-modal="modal-historial-caja">Cerrar</button>
                </div>
            </div>
        `;

        modal.innerHTML = html;
        this.abrirModal('modal-historial-caja');
    }

    // Función auxiliar para mostrar las ventas de un día específico (usada en el historial de caja)
    verVentasDelDia(fechaISO) {
        const ventasHistoricas = JSON.parse(localStorage.getItem('ventasHistoricas')) || [];
        const ventasDelDia = ventasHistoricas.filter(v => new Date(v.fecha).toISOString().split('T')[0] === fechaISO);
        if (ventasDelDia.length === 0) {
            alert('No hay ventas registradas para ese día.');
            return;
        }

        let modal = document.getElementById('modal-ventas-dia');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-ventas-dia';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        let html = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>Ventas del ${new Date(fechaISO).toLocaleDateString('es-ES')}</h3>
                    <button class="btn-cerrar-modal" data-modal="modal-ventas-dia" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding: 20px; max-height: 500px; overflow-y: auto;">
        `;

        ventasDelDia.forEach(venta => {
            html += `
                <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
                    <div><strong>Venta #${venta.id}</strong> - ${new Date(venta.fecha).toLocaleTimeString()}</div>
                    <div>Total: $${venta.total.toFixed(2)} (${venta.metodo_pago})</div>
                    <div>Productos: ${venta.productos.map(p => `${p.cantidad} x ${p.nombre}`).join(', ')}</div>
                    <button class="btn btn-sm btn-primary" onclick="app.mostrarDetalleVenta(${JSON.stringify(venta).replace(/"/g, '&quot;')})">Ver detalle</button>
                </div>
            `;
        });

        html += `
                </div>
                <div class="form-actions" style="padding: 20px;">
                    <button class="btn btn-secondary btn-cerrar-modal" data-modal="modal-ventas-dia">Cerrar</button>
                </div>
            </div>
        `;

        modal.innerHTML = html;
        this.abrirModal('modal-ventas-dia');
    }

    // ==================== FUNCIONES DE PROVEEDORES Y PAGOS ====================
    agregarProveedor(nombre, telefono, email, direccion) {
        const proveedores = JSON.parse(localStorage.getItem('proveedores')) || [];
        const nuevo = {
            id: Date.now(),
            nombre: nombre,
            telefono: telefono || '',
            email: email || '',
            direccion: direccion || '',
            fecha: new Date().toISOString()
        };
        proveedores.push(nuevo);
        localStorage.setItem('proveedores', JSON.stringify(proveedores));
        return nuevo;
    }

    obtenerProveedores() {
        return JSON.parse(localStorage.getItem('proveedores')) || [];
    }

    mostrarListaProveedores() {
        const proveedores = this.obtenerProveedores();
        
        let modal = document.getElementById('modal-proveedores');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-proveedores';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h3><i class="fas fa-truck"></i> Proveedores</h3>
                    <button class="btn-cerrar-modal" data-modal="modal-proveedores" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding: 20px;">
                    <button class="btn btn-primary" onclick="app.abrirAgregarProveedor()" style="margin-bottom: 15px;">
                        <i class="fas fa-plus"></i> Nuevo Proveedor
                    </button>
                    
                    <div style="max-height: 400px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                        ${proveedores.length === 0 ? '<p style="text-align: center; padding: 20px;">No hay proveedores registrados</p>' : ''}
                        ${proveedores.map(prov => `
                            <div style="padding: 15px; border-bottom: 1px solid #e2e8f0;">
                                <div style="display: flex; justify-content: space-between;">
                                    <div>
                                        <strong>${prov.nombre}</strong><br>
                                        <span style="font-size: 0.9rem;">📞 ${prov.telefono || '-'}</span><br>
                                        <span style="font-size: 0.9rem;">✉️ ${prov.email || '-'}</span><br>
                                        <span style="font-size: 0.9rem;">📍 ${prov.direccion || '-'}</span>
                                    </div>
                                    <div style="display: flex; flex-direction: column; gap: 5px;">
                                        <button class="btn btn-sm btn-success" onclick="app.abrirRegistrarPagoProveedor(${prov.id}, '${prov.nombre}')">
                                            <i class="fas fa-money-bill-wave"></i> Registrar pago
                                        </button>
                                        <button class="btn btn-sm btn-info" onclick="app.mostrarHistorialPagosProveedor(${prov.id})">
                                            <i class="fas fa-history"></i> Ver pagos
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="form-actions" style="padding: 20px;">
                    <button class="btn btn-secondary btn-cerrar-modal" data-modal="modal-proveedores">Cerrar</button>
                </div>
            </div>
        `;

        this.abrirModal('modal-proveedores');
    }

    abrirAgregarProveedor() {
        this.cerrarModal('modal-proveedores');
        
        let modal = document.getElementById('modal-agregar-proveedor');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-agregar-proveedor';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-plus-circle"></i> Nuevo Proveedor</h3>
                    <button class="btn-cerrar-modal" data-modal="modal-agregar-proveedor" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="form-proveedor">
                    <div class="form-group">
                        <label>Nombre *</label>
                        <input type="text" id="prov-nombre" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Teléfono</label>
                        <input type="text" id="prov-telefono" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="prov-email" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Dirección</label>
                        <input type="text" id="prov-direccion" class="form-control">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary btn-cerrar-modal" data-modal="modal-agregar-proveedor">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        `;

        this.abrirModal('modal-agregar-proveedor');

        const form = document.getElementById('form-proveedor');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const nombre = document.getElementById('prov-nombre').value.trim();
            if (!nombre) {
                alert('El nombre es obligatorio');
                return;
            }
            const telefono = document.getElementById('prov-telefono').value.trim();
            const email = document.getElementById('prov-email').value.trim();
            const direccion = document.getElementById('prov-direccion').value.trim();
            
            this.agregarProveedor(nombre, telefono, email, direccion);
            this.cerrarModal('modal-agregar-proveedor');
            this.mostrarNotificacion('✅ Proveedor agregado');
            setTimeout(() => this.mostrarListaProveedores(), 300);
        });
    }

    // Funciones para pagos a proveedores
    abrirRegistrarPagoProveedor(proveedorId, proveedorNombre) {
        this.cerrarModal('modal-proveedores');
        
        let modal = document.getElementById('modal-registrar-pago-proveedor');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-registrar-pago-proveedor';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-money-bill-wave"></i> Registrar Pago a Proveedor</h3>
                    <button class="btn-cerrar-modal" data-modal="modal-registrar-pago-proveedor" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="form-pago-proveedor">
                    <input type="hidden" id="pago-proveedor-id" value="${proveedorId}">
                    <div class="form-group">
                        <label>Proveedor</label>
                        <input type="text" class="form-control" value="${proveedorNombre}" readonly>
                    </div>
                    <div class="form-group">
                        <label>Monto *</label>
                        <input type="number" id="pago-monto" class="form-control" step="0.01" min="0.01" required>
                    </div>
                    <div class="form-group">
                        <label>Método de pago *</label>
                        <select id="pago-metodo" class="form-control" required>
                            <option value="efectivo">Efectivo</option>
                            <option value="debito">Débito</option>
                            <option value="credito">Crédito</option>
                            <option value="transferencia">Transferencia</option>
                            <option value="qr">QR</option>
                            <option value="mercadopago">Mercado Pago</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Concepto / Descripción</label>
                        <input type="text" id="pago-concepto" class="form-control" placeholder="Ej: Pago factura #123">
                    </div>
                    <div class="form-group">
                        <label>Fecha (opcional)</label>
                        <input type="date" id="pago-fecha" class="form-control" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary btn-cerrar-modal" data-modal="modal-registrar-pago-proveedor">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar Pago</button>
                    </div>
                </form>
            </div>
        `;

        this.abrirModal('modal-registrar-pago-proveedor');

        const form = document.getElementById('form-pago-proveedor');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.guardarPagoProveedor();
        });
    }

    guardarPagoProveedor() {
        const proveedorId = parseInt(document.getElementById('pago-proveedor-id').value);
        const monto = parseFloat(document.getElementById('pago-monto').value);
        const metodo = document.getElementById('pago-metodo').value;
        const concepto = document.getElementById('pago-concepto').value.trim() || 'Pago a proveedor';
        const fechaInput = document.getElementById('pago-fecha').value;
        const fecha = fechaInput ? new Date(fechaInput).toISOString() : new Date().toISOString();

        if (!monto || monto <= 0) {
            alert('Ingrese un monto válido');
            return;
        }

        const proveedores = this.obtenerProveedores();
        const proveedor = proveedores.find(p => p.id === proveedorId);
        if (!proveedor) {
            alert('Proveedor no encontrado');
            return;
        }

        const pago = {
            id: Date.now(),
            proveedorId: proveedorId,
            proveedorNombre: proveedor.nombre,
            monto: monto,
            metodo: metodo,
            concepto: concepto,
            fecha: fecha
        };

        const pagos = JSON.parse(localStorage.getItem('pagosProveedores')) || [];
        pagos.push(pago);
        localStorage.setItem('pagosProveedores', JSON.stringify(pagos));

        this.agregarEgreso(monto, `Pago a proveedor: ${proveedor.nombre} - ${concepto}`, metodo, `Pago #${pago.id}`);

        this.cerrarModal('modal-registrar-pago-proveedor');
        this.mostrarNotificacion('✅ Pago registrado correctamente');
        setTimeout(() => this.mostrarListaProveedores(), 300);
    }

    mostrarHistorialPagosProveedor(proveedorId) {
        const proveedores = this.obtenerProveedores();
        const proveedor = proveedores.find(p => p.id === proveedorId);
        if (!proveedor) return;

        const pagos = JSON.parse(localStorage.getItem('pagosProveedores')) || [];
        const pagosProveedor = pagos.filter(p => p.proveedorId === proveedorId).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        const totalPagado = pagosProveedor.reduce((sum, p) => sum + p.monto, 0);

        let modal = document.getElementById('modal-historial-pagos-proveedor');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-historial-pagos-proveedor';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3><i class="fas fa-history"></i> Pagos a ${proveedor.nombre}</h3>
                    <button class="btn-cerrar-modal" data-modal="modal-historial-pagos-proveedor" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding: 20px;">
                    <div style="background: #48bb78; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span>Total pagado:</span>
                            <span style="font-size: 1.5rem; font-weight: 700;">$${totalPagado.toFixed(2)}</span>
                        </div>
                        <div style="margin-top: 5px;">Cantidad de pagos: ${pagosProveedor.length}</div>
                    </div>
                    
                    <div style="max-height: 400px; overflow-y: auto;">
                        ${pagosProveedor.length === 0 ? '<p style="text-align: center; padding: 20px;">No hay pagos registrados para este proveedor</p>' : ''}
                        ${pagosProveedor.map(p => `
                            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
                                <div style="display: flex; justify-content: space-between;">
                                    <div>
                                        <strong>${p.concepto}</strong>
                                        <div style="font-size: 0.85rem;">Método: ${p.metodo}</div>
                                    </div>
                                    <div style="font-weight: 700; color: #f56565;">-$${p.monto.toFixed(2)}</div>
                                </div>
                                <div style="font-size: 0.8rem; color: #a0aec0; margin-top: 5px;">
                                    ${new Date(p.fecha).toLocaleString()}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="form-actions" style="padding: 20px;">
                    <button class="btn btn-secondary btn-cerrar-modal" data-modal="modal-historial-pagos-proveedor">Cerrar</button>
                </div>
            </div>
        `;

        this.abrirModal('modal-historial-pagos-proveedor');
    }

    // ==================== HISTORIAL DE GASTOS ====================
    mostrarHistorialGastos() {
        const gastosHoy = JSON.parse(localStorage.getItem('gastosDelDia')) || [];
        const gastosHistoricos = JSON.parse(localStorage.getItem('gastosHistoricos')) || [];
        const gastos = [...gastosHistoricos, ...gastosHoy].reverse();

        let modal = document.getElementById('modal-historial-gastos');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-historial-gastos';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        const total = gastos.reduce((sum, g) => sum + g.monto, 0);

        const reiniciarGastos = () => {
            if (confirm('¿Está seguro de reiniciar el historial de gastos? Se eliminarán todos los registros.')) {
                localStorage.setItem('gastosDelDia', JSON.stringify([]));
                localStorage.setItem('gastosHistoricos', JSON.stringify([]));
                this.mostrarHistorialGastos();
            }
        };

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3><i class="fas fa-history"></i> Historial de Gastos</h3>
                    <button class="btn-cerrar-modal" data-modal="modal-historial-gastos" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding: 20px;">
                    <div style="background: #f56565; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span>Total mostrado:</span>
                            <span style="font-size: 1.3rem; font-weight: 700;">$${total.toFixed(2)}</span>
                        </div>
                    </div>
                    
                    <div id="lista-gastos" style="max-height: 400px; overflow-y: auto;">
                        ${gastos.length === 0 ? '<p style="text-align: center; padding: 20px;">No hay gastos registrados</p>' : ''}
                        ${gastos.map(gasto => {
                            const gastoData = encodeURIComponent(JSON.stringify(gasto));
                            return `
                                <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 10px; position: relative;">
                                    <button class="btn-eliminar-gasto" data-gasto="${gastoData}" style="position: absolute; top: 10px; right: 10px; background: none; border: none; color: #f56565; cursor: pointer; font-size: 1.1rem;" title="Eliminar gasto">
                                        <i class="fas fa-trash-alt"></i>
                                    </button>
                                    <div>
                                        <strong>${gasto.descripcion}</strong>
                                        <div style="font-size: 0.85rem; color: #718096;">${gasto.categoria} • ${gasto.metodo_pago}</div>
                                        ${gasto.proveedor ? `<div style="font-size: 0.85rem;">Proveedor: ${gasto.proveedor}</div>` : ''}
                                    </div>
                                    <div style="font-weight: 700; color: #f56565; margin-top: 5px;">-$${gasto.monto.toFixed(2)}</div>
                                    <div style="font-size: 0.8rem; color: #a0aec0; margin-top: 5px;">
                                        ${new Date(gasto.fecha).toLocaleString()}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                <div class="form-actions" style="padding: 20px; display: flex; gap: 10px; justify-content: space-between;">
                    <button class="btn btn-danger" id="btn-reiniciar-gastos" style="background-color: #e53e3e; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
                        <i class="fas fa-trash-alt"></i> Reiniciar historial
                    </button>
                    <button class="btn btn-secondary btn-cerrar-modal" data-modal="modal-historial-gastos" style="background-color: #718096; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
                        Cerrar
                    </button>
                </div>
            </div>
        `;

        const listaGastos = document.getElementById('lista-gastos');
        if (listaGastos) {
            listaGastos.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn-eliminar-gasto');
                if (!btn) return;

                const gastoData = btn.getAttribute('data-gasto');
                if (!gastoData) return;

                try {
                    const gasto = JSON.parse(decodeURIComponent(gastoData));
                    if (confirm(`¿Eliminar el gasto "${gasto.descripcion}" por $${gasto.monto.toFixed(2)}?`)) {
                        let eliminado = false;
                        const sonIguales = (a, b) => {
                            return a.descripcion === b.descripcion &&
                                   a.monto === b.monto &&
                                   a.fecha === b.fecha &&
                                   a.categoria === b.categoria &&
                                   a.metodo_pago === b.metodo_pago &&
                                   (a.proveedor || '') === (b.proveedor || '');
                        };

                        const indexHoy = gastosHoy.findIndex(g => sonIguales(g, gasto));
                        if (indexHoy !== -1) {
                            gastosHoy.splice(indexHoy, 1);
                            localStorage.setItem('gastosDelDia', JSON.stringify(gastosHoy));
                            eliminado = true;
                        }

                        if (!eliminado) {
                            const indexHist = gastosHistoricos.findIndex(g => sonIguales(g, gasto));
                            if (indexHist !== -1) {
                                gastosHistoricos.splice(indexHist, 1);
                                localStorage.setItem('gastosHistoricos', JSON.stringify(gastosHistoricos));
                                eliminado = true;
                            }
                        }

                        if (eliminado) {
                            this.mostrarHistorialGastos();
                        } else {
                            alert('No se pudo encontrar el gasto para eliminar.');
                        }
                    }
                } catch (error) {
                    alert('Error al procesar la eliminación.');
                }
            });
        }

        const btnReiniciar = document.getElementById('btn-reiniciar-gastos');
        if (btnReiniciar) {
            btnReiniciar.addEventListener('click', reiniciarGastos);
        }

        this.abrirModal('modal-historial-gastos');
    }

    // ==================== MODAL NUEVO PRODUCTO (y EDICIÓN) ====================
    async abrirModalNuevoProducto(productoParaEditar = null) {
        let modal = document.getElementById('modal-nuevo-producto');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-nuevo-producto';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        const categorias = await this.obtenerCategorias();
        const categoriasOptions = categorias.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');

        const esEdicion = productoParaEditar !== null;
        const titulo = esEdicion ? 'Editar Producto' : 'Nuevo Producto';
        const botonGuardar = esEdicion ? 'Actualizar' : 'Guardar Producto';

        const idValue = esEdicion ? productoParaEditar.id : '';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3><i class="fas fa-${esEdicion ? 'edit' : 'plus-circle'}"></i> ${titulo}</h3>
                    <button class="btn-cerrar-modal" data-modal="modal-nuevo-producto" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="form-nuevo-producto">
                    ${esEdicion ? `<input type="hidden" id="prod-id" value="${idValue}">` : ''}
                    <div class="form-group">
                        <label>Nombre *</label>
                        <input type="text" id="prod-nombre" class="form-control" required value="${esEdicion ? (productoParaEditar.nombre || '') : ''}">
                    </div>
                    <div class="form-group">
                        <label>SKU (opcional)</label>
                        <input type="text" id="prod-sku" class="form-control" placeholder="Dejar vacío para auto-generar" value="${esEdicion ? (productoParaEditar.sku || '') : ''}">
                    </div>
                    <div class="form-group">
                        <label>Categoría *</label>
                        <select id="prod-categoria" class="form-control" required>
                            <option value="">Seleccionar</option>
                            ${categoriasOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Marca</label>
                        <input type="text" id="prod-marca" class="form-control" value="${esEdicion ? (productoParaEditar.marca || '') : ''}">
                    </div>
                    <div class="form-group">
                        <label>Descripción</label>
                        <textarea id="prod-descripcion" class="form-control" rows="2">${esEdicion ? (productoParaEditar.descripcion || '') : ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Precio de costo ($) *</label>
                        <input type="number" id="prod-costo" class="form-control" min="0" step="0.01" required value="${esEdicion ? (productoParaEditar.costo || 0) : ''}">
                    </div>
                    <div class="form-group">
                        <label>Margen de ganancia (%) *</label>
                        <input type="number" id="prod-margen" class="form-control" min="0" step="0.1" value="${esEdicion ? (productoParaEditar.margen || 80) : 80}" required>
                    </div>
                    <div class="form-group">
                        <label>Precio de venta sugerido</label>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <input type="number" id="prod-precio" class="form-control" min="0" step="0.01" readonly style="background: #f0f0f0;" value="${esEdicion ? (productoParaEditar.precio || 0) : ''}">
                            <button type="button" class="btn btn-outline" onclick="app.calcularPrecioVenta()">Calcular</button>
                        </div>
                        <small style="color: #718096;">Se calcula automáticamente al cambiar costo o margen</small>
                    </div>
                    <div class="form-group">
                        <label>Stock inicial</label>
                        <input type="number" id="prod-stock" class="form-control" min="0" value="${esEdicion ? (productoParaEditar.stock || 0) : 0}">
                    </div>
                    <div class="form-group">
                        <label>Stock al abrir</label>
                        <input type="number" id="prod-stock-apertura" class="form-control" min="0" value="${esEdicion ? (productoParaEditar.stock_apertura !== undefined ? productoParaEditar.stock_apertura : 0) : 0}">
                        <small style="color: #718096;">Cantidad con la que se inició el negocio</small>
                    </div>
                    <div class="form-group">
                        <label>Stock mínimo</label>
                        <input type="number" id="prod-stock-minimo" class="form-control" min="0" value="${esEdicion ? (productoParaEditar.stock_minimo || 5) : 5}">
                    </div>
                    <div class="form-group">
                        <label>Proveedor</label>
                        <input type="text" id="prod-proveedor" class="form-control" list="lista-proveedores" value="${esEdicion ? (productoParaEditar.proveedor || '') : ''}">
                        <datalist id="lista-proveedores">
                            ${this.obtenerProveedores().map(p => `<option value="${p.nombre}">`).join('')}
                        </datalist>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary btn-cerrar-modal" data-modal="modal-nuevo-producto">Cancelar</button>
                        <button type="submit" class="btn btn-primary">${botonGuardar}</button>
                    </div>
                </form>
            </div>
        `;

        if (esEdicion && productoParaEditar.categoria) {
            setTimeout(() => {
                const selectCategoria = document.getElementById('prod-categoria');
                if (selectCategoria) {
                    for (let option of selectCategoria.options) {
                        if (option.value === productoParaEditar.categoria) {
                            option.selected = true;
                            break;
                        }
                    }
                }
            }, 100);
        }

        this.abrirModal('modal-nuevo-producto');

        setTimeout(() => {
            const nombreInput = document.getElementById('prod-nombre');
            if (nombreInput) nombreInput.focus();
        }, 200);

        const costoInput = document.getElementById('prod-costo');
        const margenInput = document.getElementById('prod-margen');
        const precioInput = document.getElementById('prod-precio');

        const calcular = () => {
            const costo = parseFloat(costoInput.value) || 0;
            const margen = parseFloat(margenInput.value) || 0;
            const precio = costo * (1 + margen / 100);
            precioInput.value = precio.toFixed(2);
        };

        costoInput.addEventListener('input', calcular);
        margenInput.addEventListener('input', calcular);
        calcular();

        const form = document.getElementById('form-nuevo-producto');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const producto = {
                nombre: document.getElementById('prod-nombre').value,
                sku: document.getElementById('prod-sku').value.trim() || this.generarSku(),
                categoria: document.getElementById('prod-categoria').value,
                marca: document.getElementById('prod-marca').value,
                descripcion: document.getElementById('prod-descripcion').value,
                costo: parseFloat(document.getElementById('prod-costo').value) || 0,
                precio: parseFloat(document.getElementById('prod-precio').value) || 0,
                stock: parseInt(document.getElementById('prod-stock').value) || 0,
                stock_apertura: parseInt(document.getElementById('prod-stock-apertura').value) || 0,
                stock_minimo: parseInt(document.getElementById('prod-stock-minimo').value) || 5,
                proveedor: document.getElementById('prod-proveedor').value,
                margen: parseFloat(document.getElementById('prod-margen').value) || 0
            };

            if (esEdicion) {
                const idInput = document.getElementById('prod-id');
                if (idInput) {
                    producto.id = idInput.value;
                }
            }

            if (!producto.nombre || !producto.categoria) {
                alert('Complete los campos obligatorios');
                return;
            }

            if (esEdicion) {
                await this.actualizarProducto(producto);
            } else {
                await this.crearProducto(producto);
            }
        });
    }

    async crearProducto(producto) {
        if (window.api && window.api.createProduct) {
            try {
                await window.api.createProduct(producto);
                this.mostrarNotificacion('✅ Producto creado');
                this.cerrarModal('modal-nuevo-producto');
            } catch (error) {
                alert('Error al crear producto: ' + error.message);
            }
        } else {
            const productos = JSON.parse(localStorage.getItem('productos')) || [];
            producto.id = Date.now();
            productos.push(producto);
            localStorage.setItem('productos', JSON.stringify(productos));
            this.mostrarNotificacion('✅ Producto guardado en localStorage');
            this.cerrarModal('modal-nuevo-producto');
        }
    }

    async actualizarProducto(producto) {
        if (window.api && window.api.updateProduct) {
            try {
                const { id, ...productoData } = producto;
                await window.api.updateProduct(id, productoData);
                this.mostrarNotificacion('✅ Producto actualizado');
                this.cerrarModal('modal-nuevo-producto');
            } catch (error) {
                alert('Error al actualizar producto: ' + error.message);
            }
        } else {
            const productos = JSON.parse(localStorage.getItem('productos')) || [];
            const index = productos.findIndex(p => String(p.id) === String(producto.id));
            if (index !== -1) {
                productos[index] = producto;
                localStorage.setItem('productos', JSON.stringify(productos));
                this.mostrarNotificacion('✅ Producto actualizado en localStorage');
                this.cerrarModal('modal-nuevo-producto');
            } else {
                alert('Producto no encontrado. Verifique que el ID exista.');
            }
        }
    }

    async obtenerCategorias() {
        if (window.api && window.api.getCategories) {
            try {
                return await window.api.getCategories();
            } catch (error) {
                return [];
            }
        }
        return [];
    }

    calcularPrecioVenta() {
        const costo = parseFloat(document.getElementById('prod-costo')?.value) || 0;
        const margen = parseFloat(document.getElementById('prod-margen')?.value) || 0;
        const precio = costo * (1 + margen / 100);
        const precioInput = document.getElementById('prod-precio');
        if (precioInput) precioInput.value = precio.toFixed(2);
    }

    generarSku() {
        return 'PROD-' + Date.now().toString().slice(-6);
    }

    // ==================== FUNCIONES DE GASTOS ====================
    guardarGasto(e) {
        e.preventDefault();
        
        const tipo = document.getElementById('gasto-tipo')?.value;
        const categoria = document.getElementById('gasto-categoria')?.value;
        const descripcion = document.getElementById('gasto-descripcion')?.value;
        const monto = parseFloat(document.getElementById('gasto-monto')?.value || 0);
        const metodo_pago = document.getElementById('gasto-metodo')?.value;
        const proveedor = document.getElementById('gasto-proveedor')?.value || '';
        const comprobante = document.getElementById('gasto-comprobante')?.value || '';
        const observaciones = document.getElementById('gasto-observaciones')?.value || '';

        if (!tipo || !categoria || !descripcion || !monto || monto <= 0 || !metodo_pago) {
            this.mostrarError('Complete todos los campos obligatorios');
            return;
        }

        const gasto = {
            id: Date.now(),
            tipo,
            categoria: categoria.trim(),
            descripcion: descripcion.trim(),
            monto: monto,
            metodo_pago,
            proveedor: proveedor.trim(),
            comprobante: comprobante.trim(),
            observaciones: observaciones.trim(),
            usuario: 'punto_venta',
            fecha: new Date().toISOString()
        };

        try {
            const gastosDelDia = JSON.parse(localStorage.getItem('gastosDelDia')) || [];
            gastosDelDia.push(gasto);
            localStorage.setItem('gastosDelDia', JSON.stringify(gastosDelDia));
            
            // Si la categoría es "Aporte capital (ingreso)", registrar como ingreso en lugar de egreso
            if (categoria === "Aporte capital (ingreso)") {
                this.agregarIngreso(monto, `Aporte de capital: ${descripcion}`, metodo_pago, comprobante);
            } else {
                this.agregarEgreso(monto, descripcion, metodo_pago, comprobante);
            }
            
            this.actualizarResumenGastos();
            this.resetearFormularioGasto();
            this.cerrarModal('modal-gasto');
            
            this.mostrarNotificacion('✅ Gasto registrado correctamente');
            
            setTimeout(() => {
                const skuInput = document.getElementById('sku-input');
                if (skuInput) skuInput.focus();
            }, 200);
            
        } catch (error) {
            this.mostrarError('Error al guardar el gasto');
        }
    }

    resetearFormularioGasto() {
        const form = document.getElementById('form-gasto');
        if (form) {
            form.reset();
            const inputs = form.querySelectorAll('input[type="text"], input[type="number"], textarea');
            inputs.forEach(input => {
                input.value = '';
            });
            const campos = form.querySelectorAll('input, select, textarea');
            campos.forEach(campo => {
                campo.removeAttribute('disabled');
                campo.removeAttribute('readonly');
                campo.style.pointerEvents = 'auto';
                campo.style.backgroundColor = 'white';
            });
        }
        
        const tipoSelect = document.getElementById('gasto-tipo');
        if (tipoSelect) tipoSelect.value = '';
        
        const metodoSelect = document.getElementById('gasto-metodo');
        if (metodoSelect) metodoSelect.value = 'efectivo';
    }

    abrirModalGasto() {
        const modal = document.getElementById('modal-gasto');
        if (!modal) {
            this.mostrarError('Error: Modal de gasto no encontrado');
            return;
        }
        
        const campos = modal.querySelectorAll('input, select, textarea');
        campos.forEach(campo => {
            campo.removeAttribute('disabled');
            campo.removeAttribute('readonly');
            campo.style.pointerEvents = 'auto';
            campo.style.backgroundColor = 'white';
        });
        
        // Asegurar que la categoría "Aporte capital (ingreso)" esté presente
        const selectCategoria = document.getElementById('gasto-categoria');
        if (selectCategoria) {
            // Verificar si la opción ya existe
            let existeAporte = false;
            for (let i = 0; i < selectCategoria.options.length; i++) {
                if (selectCategoria.options[i].value === "Aporte capital (ingreso)") {
                    existeAporte = true;
                    break;
                }
            }
            if (!existeAporte) {
                // Crear la opción y agregarla
                const option = document.createElement('option');
                option.value = "Aporte capital (ingreso)";
                option.textContent = "Aporte capital (ingreso)";
                // Insertar antes de "Otros" o al final
                const othersOption = Array.from(selectCategoria.options).find(opt => opt.value === "Otros");
                if (othersOption) {
                    selectCategoria.insertBefore(option, othersOption);
                } else {
                    selectCategoria.appendChild(option);
                }
            }
        }
        
        this.abrirModal('modal-gasto');
        
        setTimeout(() => {
            const descripcion = document.getElementById('gasto-descripcion');
            if (descripcion) {
                descripcion.focus();
            }
        }, 300);
    }

    actualizarResumenGastos(gastosDelDia = null) {
        if (!gastosDelDia) {
            gastosDelDia = JSON.parse(localStorage.getItem('gastosDelDia')) || [];
        }
        
        const totalGastos = gastosDelDia.reduce((sum, gasto) => sum + gasto.monto, 0);
        const ultimoGasto = gastosDelDia.length > 0 ? gastosDelDia[gastosDelDia.length - 1] : null;
        
        const totalElement = document.getElementById('total-gastos-hoy');
        if (totalElement) {
            totalElement.textContent = `$${totalGastos.toFixed(2)}`;
        }
        
        const ultimoElement = document.getElementById('ultimo-gasto');
        if (ultimoElement) {
            if (ultimoGasto) {
                ultimoElement.innerHTML = `Último: ${ultimoGasto.descripcion} - $${ultimoGasto.monto.toFixed(2)}`;
            } else {
                ultimoElement.textContent = 'No hay gastos registrados hoy';
            }
        }
    }

    imprimirReporteGastos() {
        const gastosDelDia = JSON.parse(localStorage.getItem('gastosDelDia')) || [];
        
        if (gastosDelDia.length === 0) {
            this.mostrarError('No hay gastos para imprimir');
            return;
        }
        
        const totalGastos = gastosDelDia.reduce((sum, gasto) => sum + gasto.monto, 0);
        
        const gastosPorCategoria = {};
        gastosDelDia.forEach(gasto => {
            if (!gastosPorCategoria[gasto.categoria]) {
                gastosPorCategoria[gasto.categoria] = {
                    total: 0,
                    cantidad: 0
                };
            }
            gastosPorCategoria[gasto.categoria].total += gasto.monto;
            gastosPorCategoria[gasto.categoria].cantidad += 1;
        });
        
        let reporteHTML = `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #1a8c8a; margin-bottom: 5px;">Reporte de Gastos</h1>
                    <h2 style="color: #4a5568; font-size: 1.2rem; margin-top: 0;">${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h2>
                </div>
                
                <div style="background: #f56565; color: white; padding: 20px; border-radius: 10px; margin-bottom: 30px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 1.2rem; font-weight: 600;">TOTAL GASTOS:</span>
                        <span style="font-size: 2rem; font-weight: 700;">$${totalGastos.toFixed(2)}</span>
                    </div>
                    <div style="margin-top: 10px; font-size: 0.9rem;">
                        Total de registros: ${gastosDelDia.length} gastos
                    </div>
                </div>
                
                <div style="margin-bottom: 30px;">
                    <h3 style="color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Resumen por Categoría</h3>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 15px;">
        `;
        
        Object.keys(gastosPorCategoria).forEach(categoria => {
            const datos = gastosPorCategoria[categoria];
            reporteHTML += `
                <div style="background: #f7fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #f56565;">
                    <div style="font-weight: 600; color: #2d3748; margin-bottom: 5px;">${categoria}</div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #718096;">${datos.cantidad} gastos</span>
                        <span style="font-weight: 700; color: #f56565;">$${datos.total.toFixed(2)}</span>
                    </div>
                </div>
            `;
        });
        
        reporteHTML += `
                    </div>
                </div>
                
                <div>
                    <h3 style="color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Detalle de Gastos</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                        <thead>
                            <tr style="background: #4a5568; color: white;">
                                <th style="padding: 12px; text-align: left; border-radius: 8px 0 0 0;">Descripción</th>
                                <th style="padding: 12px; text-align: left;">Categoría</th>
                                <th style="padding: 12px; text-align: left;">Método</th>
                                <th style="padding: 12px; text-align: right; border-radius: 0 8px 0 0;">Monto</th>
                              </tr>
                        </thead>
                        <tbody>
        `;
        
        gastosDelDia.forEach((gasto, index) => {
            const bgColor = index % 2 === 0 ? '#ffffff' : '#f7fafc';
            reporteHTML += `
                <tr style="background: ${bgColor};">
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
                        <strong>${gasto.descripcion}</strong>
                        ${gasto.proveedor ? `<div style="font-size: 0.85rem; color: #718096;">${gasto.proveedor}</div>` : ''}
                      </td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
                        <span style="background: #e6fffa; color: #234e52; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">
                            ${gasto.categoria}
                        </span>
                      </td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${gasto.metodo_pago}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #f56565;">
                        $${gasto.monto.toFixed(2)}
                      </td>
                  </tr>
            `;
        });
        
        reporteHTML += `
                        </tbody>
                        <tfoot>
                            <tr style="background: #fff5f5; font-weight: 700;">
                                <td colspan="3" style="padding: 12px; text-align: right; border-top: 2px solid #f56565;">TOTAL GENERAL:</td>
                                <td style="padding: 12px; text-align: right; border-top: 2px solid #f56565; color: #f56565; font-size: 1.1rem;">
                                    $${totalGastos.toFixed(2)}
                                  </td>
                              </tr>
                        </tfoot>
                    </table>
                </div>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 2px dashed #e2e8f0; text-align: center; color: #718096; font-size: 0.9rem;">
                    <p>Reporte generado el ${new Date().toLocaleString('es-ES')}</p>
                    <p style="margin-top: 5px;">Tienda de Pesca - Sistema de Gestión</p>
                </div>
            </div>
        `;
        
        const ventanaImpresion = window.open('', '_blank');
        if (ventanaImpresion) {
            ventanaImpresion.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Reporte de Gastos - ${new Date().toLocaleDateString('es-ES')}</title>
                    <style>
                        body { 
                            font-family: 'Segoe UI', Arial, sans-serif; 
                            margin: 0; 
                            padding: 20px;
                            background: white;
                        }
                        @media print {
                            @page { 
                                margin: 10mm; 
                            }
                            body { 
                                margin: 0; 
                                padding: 0; 
                            }
                        }
                    </style>
                </head>
                <body>${reporteHTML}</body>
                </html>
            `);
            ventanaImpresion.document.close();
            ventanaImpresion.focus();
            ventanaImpresion.print();
        }
    }

    // ==================== FUNCIONES DE CIERRE DE CAJA ====================
    abrirCierreCaja() {
        let modal = document.getElementById('modal-cierre-caja');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-cierre-caja';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3><i class="fas fa-cash-register"></i> Cierre de Caja</h3>
                    <button class="btn-cerrar-modal" data-modal="modal-cierre-caja" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div id="resumen-cierre-caja" style="padding: 20px;">
                    <!-- Contenido dinámico -->
                </div>
                <div class="form-actions" style="padding: 0 20px 20px; display: flex; flex-wrap: wrap; gap: 10px;">
                    <button type="button" class="btn btn-secondary btn-cerrar-modal" data-modal="modal-cierre-caja">
                        Cerrar
                    </button>
                    <button type="button" id="btn-imprimir-cierre" class="btn btn-primary" onclick="app.imprimirCierreCaja()">
                        <i class="fas fa-print"></i> Imprimir
                    </button>
                    <button type="button" id="btn-registrar-cierre" class="btn btn-danger" onclick="app.registrarCierreCaja()">
                        <i class="fas fa-check"></i> Registrar Cierre
                    </button>
                    <button type="button" id="btn-borrar-historial" class="btn btn-warning" onclick="app.borrarTodosLosCierres()" style="background: #ed8936; color: white;">
                        <i class="fas fa-trash"></i> Borrar Historial
                    </button>
                </div>
            </div>
        `;
        
        this.abrirModal('modal-cierre-caja');
        this.generarResumenCierreCaja();
    }

    generarResumenCierreCaja() {
        const ventasDelDia = JSON.parse(localStorage.getItem('ventasDelDia')) || [];
        const gastosDelDia = JSON.parse(localStorage.getItem('gastosDelDia')) || [];
        
        const ventasPorMetodo = {};
        ventasDelDia.forEach(venta => {
            // Usar total_final si existe, sino total (para compatibilidad)
            const totalVenta = venta.total_final !== undefined ? venta.total_final : venta.total;
            const totalNeto = venta.total_neto !== undefined ? venta.total_neto : (totalVenta - (venta.comision_monto || 0));
            const comisionMonto = venta.comision_monto || 0;
            
            if (!ventasPorMetodo[venta.metodo_pago]) {
                ventasPorMetodo[venta.metodo_pago] = {
                    total: 0,
                    neto: 0,
                    comisiones: 0,
                    cantidad: 0
                };
            }
            
            ventasPorMetodo[venta.metodo_pago].total += totalVenta;
            ventasPorMetodo[venta.metodo_pago].neto += totalNeto;
            ventasPorMetodo[venta.metodo_pago].comisiones += comisionMonto;
            ventasPorMetodo[venta.metodo_pago].cantidad += 1;
        });
        
        const totalVentas = ventasDelDia.reduce((sum, venta) => sum + (venta.total_final !== undefined ? venta.total_final : venta.total), 0);
        const totalComisiones = ventasDelDia.reduce((sum, venta) => sum + (venta.comision_monto || 0), 0);
        const totalNeto = ventasDelDia.reduce((sum, venta) => sum + (venta.total_neto !== undefined ? venta.total_neto : ((venta.total_final !== undefined ? venta.total_final : venta.total) - (venta.comision_monto || 0))), 0);
        const totalGastos = gastosDelDia.reduce((sum, gasto) => sum + gasto.monto, 0);
        const totalFinal = totalNeto - totalGastos;
        
        let html = `
            <div style="margin-bottom: 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h4 style="color: var(--dark); margin-bottom: 5px;">Resumen del Día</h4>
                    <div style="color: #718096; font-size: 1.1rem;">${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>
                
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 25px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span style="font-size: 1.1rem;">Ventas del día:</span>
                        <span style="font-size: 1.5rem; font-weight: 700;">$${totalVentas.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span style="font-size: 1.1rem;">Total comisiones:</span>
                        <span style="font-size: 1.3rem; font-weight: 600; color: #fed7d7;">-$${totalComisiones.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span style="font-size: 1.1rem;">Total gastos:</span>
                        <span style="font-size: 1.3rem; font-weight: 600; color: #fed7d7;">-$${totalGastos.toFixed(2)}</span>
                    </div>
                    <div style="border-top: 2px solid rgba(255,255,255,0.3); margin: 15px 0 10px; padding-top: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 1.2rem; font-weight: 600;">NETO A DEPOSITAR:</span>
                            <span style="font-size: 1.8rem; font-weight: 700; color: #c6f6d5;">$${totalFinal.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                
                <h5 style="color: var(--dark); margin: 20px 0 15px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-chart-pie"></i> Ventas por Método de Pago
                </h5>
        `;
        
        if (Object.keys(ventasPorMetodo).length === 0) {
            html += `<p style="text-align: center; padding: 20px; color: #718096;">No hay ventas registradas hoy</p>`;
        } else {
            Object.keys(ventasPorMetodo).forEach(metodo => {
                const datos = ventasPorMetodo[metodo];
                const porcentaje = totalVentas > 0 ? ((datos.total / totalVentas) * 100).toFixed(1) : '0.0';
                
                html += `
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <div>
                                <strong style="text-transform: capitalize; font-size: 1.1rem;">${metodo}</strong>
                                <span style="background: #e2e8f0; padding: 3px 8px; border-radius: 4px; margin-left: 10px; font-size: 0.85rem;">
                                    ${datos.cantidad} venta${datos.cantidad !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <span style="font-weight: 700; color: var(--primary); font-size: 1.2rem;">$${datos.total.toFixed(2)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
                            <span style="color: #718096;">Comisión: $${datos.comisiones.toFixed(2)}</span>
                            <span style="color: #2d3748;">Neto: $${datos.neto.toFixed(2)}</span>
                            <span style="color: #48bb78;">${porcentaje}%</span>
                        </div>
                    </div>
                `;
            });
        }
        
        if (gastosDelDia.length > 0) {
            html += `<h5 style="color: var(--dark); margin: 25px 0 15px; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-receipt"></i> Gastos del Día (${gastosDelDia.length})
                    </h5>
                    <div style="max-height: 250px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">`;
            
            gastosDelDia.forEach((gasto, index) => {
                html += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: ${index < gastosDelDia.length - 1 ? '1px solid #e2e8f0' : 'none'};">
                        <div>
                            <div style="font-weight: 600;">${gasto.descripcion}</div>
                            <div style="font-size: 0.85rem; color: #718096;">${gasto.categoria} • ${gasto.metodo_pago}</div>
                        </div>
                        <div style="color: #f56565; font-weight: 700; font-size: 1.1rem;">-$${gasto.monto.toFixed(2)}</div>
                    </div>
                `;
            });
            
            html += `</div>`;
        }
        
        html += `
            <div style="margin-top: 25px; padding: 15px; background: #f7fafc; border-radius: 8px; border-left: 4px solid #48bb78;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span>Total ventas (neto):</span>
                    <span style="font-weight: 600;">$${totalNeto.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span>Total gastos:</span>
                    <span style="font-weight: 600; color: #f56565;">-$${totalGastos.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 2px dashed #cbd5e0;">
                    <span style="font-weight: 700; font-size: 1.1rem;">RESULTADO FINAL:</span>
                    <span style="font-weight: 700; font-size: 1.3rem; color: ${totalFinal >= 0 ? '#48bb78' : '#f56565'};">
                        $${totalFinal.toFixed(2)}
                    </span>
                </div>
            </div>
        `;
        
        const resumenCierre = document.getElementById('resumen-cierre-caja');
        if (resumenCierre) {
            resumenCierre.innerHTML = html;
        }
    }

    imprimirCierreCaja() {
        const resumenCierre = document.getElementById('resumen-cierre-caja');
        if (!resumenCierre) return;
        
        const contenido = resumenCierre.innerHTML;
        const fecha = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        const ventanaImpresion = window.open('', '_blank');
        if (ventanaImpresion) {
            ventanaImpresion.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Cierre de Caja - ${fecha}</title>
                    <style>
                        body { 
                            font-family: 'Segoe UI', Arial, sans-serif; 
                            margin: 20px; 
                            padding: 20px;
                            background: white;
                        }
                        h3 { 
                            color: #1a8c8a; 
                            margin-bottom: 5px;
                        }
                        .fecha {
                            color: #718096;
                            margin-bottom: 30px;
                        }
                        @media print {
                            @page { 
                                margin: 10mm; 
                            }
                            body { 
                                margin: 0; 
                                padding: 0; 
                            }
                        }
                    </style>
                </head>
                <body>
                    <h2 style="color: #1a8c8a; text-align: center;">CIERRE DE CAJA</h2>
                    <h3 style="text-align: center;">Tienda de Pesca</h3>
                    <p style="text-align: center; color: #718096; margin-bottom: 30px;">${fecha}</p>
                    ${contenido}
                    <p style="text-align: center; margin-top: 40px; color: #718096; font-size: 0.9rem;">
                        Este es un documento oficial de cierre de caja<br>
                        Generado el ${new Date().toLocaleString('es-ES')}
                    </p>
                </body>
                </html>
            `);
            ventanaImpresion.document.close();
            ventanaImpresion.focus();
            ventanaImpresion.print();
        }
    }

    // ==================== CIERRE DE CAJA MODIFICADO: NO DESCUENTA SALDO ====================
    async registrarCierreCaja() {
        if (confirm('¿Registrar cierre de caja y limpiar datos del día?')) {
            // --- 1. Guardar el resumen diario de caja (historialCaja) ---
            let cajaDiaria = JSON.parse(localStorage.getItem('cajaDiaria'));
            const hoy = new Date().toISOString().split('T')[0];
            
            // Si no existe o la fecha no es hoy, forzamos a crear el resumen actual
            if (!cajaDiaria || cajaDiaria.fecha !== hoy) {
                const caja = JSON.parse(localStorage.getItem('caja')) || { saldo: 0 };
                cajaDiaria = {
                    fecha: hoy,
                    saldoInicial: caja.saldo,
                    totalIngresos: 0,
                    totalEgresos: 0,
                    saldoFinal: caja.saldo,
                    movimientos: []
                };
            }
            // Guardamos este día en el historial
            this.guardarDiaEnHistorial(cajaDiaria);
    
            // --- 2. Guardar el cierre contable (resumen) ---
            const cierres = JSON.parse(localStorage.getItem('cierresHistoricos')) || [];
            const ventasDelDia = JSON.parse(localStorage.getItem('ventasDelDia')) || [];
            const gastosDelDia = JSON.parse(localStorage.getItem('gastosDelDia')) || [];
            
            // Mover gastos al histórico de gastos
            const gastosHistoricos = JSON.parse(localStorage.getItem('gastosHistoricos')) || [];
            gastosHistoricos.push(...gastosDelDia);
            localStorage.setItem('gastosHistoricos', JSON.stringify(gastosHistoricos));
            
            const totalVentas = ventasDelDia.reduce((sum, venta) => sum + (venta.total_final !== undefined ? venta.total_final : venta.total), 0);
            const totalComisiones = ventasDelDia.reduce((sum, venta) => sum + (venta.comision_monto || 0), 0);
            const totalGastos = gastosDelDia.reduce((sum, gasto) => sum + gasto.monto, 0);
            const totalNeto = ventasDelDia.reduce((sum, venta) => sum + (venta.total_neto !== undefined ? venta.total_neto : ((venta.total_final !== undefined ? venta.total_final : venta.total) - (venta.comision_monto || 0))), 0);
            
            const cierre = {
                id: Date.now(),
                fecha: new Date().toISOString(),
                fechaFormateada: new Date().toLocaleDateString('es-ES'),
                totalVentas: totalVentas,
                totalComisiones: totalComisiones,
                totalGastos: totalGastos,
                netoDepositar: totalNeto - totalGastos,
                cantidadVentas: ventasDelDia.length,
                cantidadGastos: gastosDelDia.length,
                ventasPorMetodo: this.obtenerResumenVentasPorMetodo(ventasDelDia)
            };
            
            cierres.push(cierre);
            localStorage.setItem('cierresHistoricos', JSON.stringify(cierres));
            
            if (window.api && window.api.createCierre) {
                try {
                    await window.api.createCierre(cierre);
                } catch (error) {
                    console.error("Error al guardar cierre en BD:", error);
                }
            }
            
            // --- 3. NO se descuenta el saldo de caja ---
            // Mantenemos la caja con su saldo actual
    
            // --- 4. Limpiar datos del día ---
            localStorage.removeItem('ventasDelDia');
            localStorage.removeItem('gastosDelDia');
            localStorage.removeItem('carrito');
            this.carrito = [];
            this.actualizarCarrito();
            this.actualizarResumenGastos([]);
            
            // --- 5. Inicializar un nuevo día para la caja diaria (con el mismo saldo) ---
            const cajaActualizada = JSON.parse(localStorage.getItem('caja')) || { saldo: 0 };
            const nuevoDia = {
                fecha: hoy,
                saldoInicial: cajaActualizada.saldo,
                totalIngresos: 0,
                totalEgresos: 0,
                saldoFinal: cajaActualizada.saldo,
                movimientos: []
            };
            localStorage.setItem('cajaDiaria', JSON.stringify(nuevoDia));
            
            this.cerrarModal('modal-cierre-caja');
            this.mostrarMensaje('✅ Cierre de caja registrado correctamente. El saldo de caja no ha sido modificado.');
            
            if (confirm('¿Desea imprimir el comprobante de cierre?')) {
                this.imprimirCierreCaja();
            }
        }
    }
    
    obtenerResumenVentasPorMetodo(ventas) {
        const resumen = {};
        ventas.forEach(venta => {
            const totalVenta = venta.total_final !== undefined ? venta.total_final : venta.total;
            if (!resumen[venta.metodo_pago]) {
                resumen[venta.metodo_pago] = {
                    total: 0,
                    cantidad: 0
                };
            }
            resumen[venta.metodo_pago].total += totalVenta;
            resumen[venta.metodo_pago].cantidad += 1;
        });
        return resumen;
    }

    limpiarCierresAntiguos() {
        const cierres = JSON.parse(localStorage.getItem('cierresHistoricos')) || [];
        const ahora = new Date();
        const cierresFiltrados = cierres.filter(cierre => {
            const fechaCierre = new Date(cierre.fecha);
            const diffTime = ahora - fechaCierre;
            const diffDays = diffTime / (1000 * 60 * 60 * 24);
            return diffDays <= 30;
        });
        if (cierres.length !== cierresFiltrados.length) {
            localStorage.setItem('cierresHistoricos', JSON.stringify(cierresFiltrados));
            console.log(`Se eliminaron ${cierres.length - cierresFiltrados.length} cierres antiguos.`);
        }
    }

    borrarTodosLosCierres() {
        if (confirm('¿Estás seguro de que deseas borrar TODO el historial de cierres? Esta acción no se puede deshacer.')) {
            localStorage.setItem('cierresHistoricos', JSON.stringify([]));
            this.mostrarMensaje('🧹 Historial de cierres eliminado');
        }
    }

    // ==================== NUEVO: HISTORIAL DE CIERRES ====================
    async mostrarHistorialCierres() {
        let cierres = [];
        // Intentar obtener de base de datos primero
        if (window.api && window.api.getCierres) {
            try {
                cierres = await window.api.getCierres(100);
            } catch (error) {
                console.error("Error al obtener cierres de BD:", error);
            }
        }
        // Si no hay en BD, usar localStorage
        if (cierres.length === 0) {
            cierres = JSON.parse(localStorage.getItem('cierresHistoricos')) || [];
        }
        
        let modal = document.getElementById('modal-historial-cierres');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-historial-cierres';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }
        
        let html = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3><i class="fas fa-history"></i> Historial de Cierres de Caja</h3>
                    <button class="btn-cerrar-modal" data-modal="modal-historial-cierres" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding: 20px; max-height: 500px; overflow-y: auto;">
        `;
        
        if (cierres.length === 0) {
            html += '<p style="text-align: center;">No hay cierres registrados</p>';
        } else {
            cierres.reverse().forEach(cierre => {
                html += `
                    <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between;">
                            <strong>${cierre.fechaFormateada || new Date(cierre.fecha).toLocaleDateString()}</strong>
                            <span>ID: ${cierre.id}</span>
                        </div>
                        <div style="margin-top: 10px;">
                            <div>Ventas: $${cierre.totalVentas.toFixed(2)} (${cierre.cantidadVentas} ventas)</div>
                            <div>Comisiones: -$${cierre.totalComisiones.toFixed(2)}</div>
                            <div>Gastos: -$${cierre.totalGastos.toFixed(2)}</div>
                            <div style="font-weight: bold; margin-top: 5px;">Neto depositado: $${cierre.netoDepositar.toFixed(2)}</div>
                        </div>
                    </div>
                `;
            });
        }
        
        html += `
                </div>
                <div class="form-actions" style="padding: 20px;">
                    <button class="btn btn-secondary btn-cerrar-modal" data-modal="modal-historial-cierres">Cerrar</button>
                </div>
            </div>
        `;
        
        modal.innerHTML = html;
        this.abrirModal('modal-historial-cierres');
    }

    // ==================== FUNCIONES AUXILIARES ====================
    limpiarBusqueda() {
        const display = document.getElementById('product-display');
        if (!display) return;
        
        display.innerHTML = `
            <i class="fas fa-search"></i>
            <h3>Busque un producto por SKU</h3>
            <p>Ingrese el código SKU para mostrar los detalles del producto</p>
            <p style="font-size: 0.9rem; color: #718096; margin-top: 10px;">
                Ejemplo: usa los SKU que hayas creado
            </p>
        `;
        display.classList.add('empty');
        
        const skuInput = document.getElementById('sku-input');
        if (skuInput) {
            skuInput.value = '';
            skuInput.focus();
        }
        this.productoActual = null;
    }

    irAlDashboard() {
        window.open('index.html', '_blank');
    }

    abrirModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = '';
            modal.classList.add('active');
        } else {
            console.error(`Modal ${modalId} no encontrado`);
        }
    }

    cerrarModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
    }

    cerrarTodosModales() {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
            modal.style.display = 'none';
        });
        setTimeout(() => {
            const skuInput = document.getElementById('sku-input');
            if (skuInput) skuInput.focus();
        }, 100);
    }

    mostrarNotificacion(mensaje) {
        const notif = document.createElement('div');
        notif.textContent = mensaje;
        notif.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 9999;
            font-weight: bold;
            animation: fadeInOut 3s ease forwards;
        `;
        
        if (!document.getElementById('notif-style')) {
            const style = document.createElement('style');
            style.id = 'notif-style';
            style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translateX(100px); }
                    10% { opacity: 1; transform: translateX(0); }
                    90% { opacity: 1; transform: translateX(0); }
                    100% { opacity: 0; transform: translateX(100px); }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notif);
        
        setTimeout(() => {
            if (notif.parentNode) notif.parentNode.removeChild(notif);
        }, 3000);
    }

    mostrarMensaje(mensaje) {
        this.mostrarNotificacion(mensaje);
    }

    mostrarError(mensaje) {
        alert('❌ ' + mensaje);
    }

    // ==================== FUNCIONES DE PRODUCTO ====================
    async buscarProducto(sku) {
        const display = document.getElementById('product-display');
        display.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: #1a8c8a;"></i>
                <h3>Buscando producto...</h3>
                <p>SKU: <code>${sku}</code></p>
            </div>
        `;

        try {
            const producto = await this.obtenerProductoPorSKU(sku);
            
            if (producto) {
                this.productoActual = producto;
                this.mostrarProducto(producto);
            } else {
                this.mostrarProductoNoEncontrado(sku);
            }
        } catch (error) {
            this.mostrarError('Error al buscar producto');
        }
    }

    async obtenerProductoPorSKU(sku) {
        if (window.api && window.api.searchProducts) {
            try {
                const resultados = await window.api.searchProducts(sku);
                const producto = resultados.find(p => p.sku === sku);
                if (producto) {
                    if (!producto.id && producto._id) {
                        producto.id = producto._id;
                    }
                    return producto;
                }
            } catch (error) {}
        }
        
        const todosLosProductos = JSON.parse(localStorage.getItem('productos')) || [];
        const producto = todosLosProductos.find(p => p.sku === sku);
        
        return producto || null;
    }

    // ==================== MOSTRAR PRODUCTO CON BOTÓN EDITAR ====================
    mostrarProducto(producto) {
        const display = document.getElementById('product-display');

        const stock = producto.stock || 0;
        let stockClass = 'stock-normal';
        let stockTexto = `${stock} unidades`;

        if (stock === 0) {
            stockClass = 'stock-agotado';
            stockTexto = 'AGOTADO';
        } else if (stock <= (producto.stock_minimo || 5)) {
            stockClass = 'stock-bajo';
            stockTexto = `${stock} unidades (BAJO)`;
        }

        const precioFormateado = new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(producto.precio);

        display.innerHTML = `
            <div class="product-info">
                <div class="producto-imagen-contenedor">
                    <div class="producto-imagen-placeholder">
                        <i class="fas fa-fish"></i>
                    </div>
                </div>

                <div class="product-details">
                    <h3>${producto.nombre}</h3>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <div>
                            <div style="font-size: 0.9rem; color: #718096; margin-bottom: 5px;">
                                ${producto.categoria} • ${producto.marca}
                            </div>
                            <div style="font-size: 0.8rem; color: #4a5568; background: #f7fafc; padding: 5px 10px; border-radius: 4px;">
                                SKU: <strong>${producto.sku}</strong>
                            </div>
                        </div>
                        <span class="stock-badge ${stockClass}">${stockTexto}</span>
                    </div>

                    <div class="price-tag">${precioFormateado}</div>

                    <div class="details-grid">
                        <div class="detail-item">
                            <strong>Stock Actual</strong>
                            <span>${stock} unidades</span>
                        </div>
                        <div class="detail-item">
                            <strong>Costo</strong>
                            <span>$${(producto.costo || 0).toFixed(2)}</span>
                        </div>
                        <div class="detail-item">
                            <strong>Ganancia</strong>
                            <span>$${((producto.precio || 0) - (producto.costo || 0)).toFixed(2)}</span>
                        </div>
                        <div class="detail-item">
                            <strong>Margen</strong>
                            <span>${producto.costo ? (((producto.precio || 0) - producto.costo) / producto.costo * 100).toFixed(1) + '%' : 'N/A'}</span>
                        </div>
                    </div>

                    <p style="color: #718096; margin: 15px 0;">${producto.descripcion}</p>

                    <div class="action-buttons">
                        <button class="btn btn-primary" onclick="app.agregarAlCarrito()">
                            <i class="fas fa-cart-plus"></i> AGREGAR AL CARRITO
                        </button>
                        <button class="btn btn-outline" onclick="app.limpiarBusqueda()">
                            <i class="fas fa-times"></i> Limpiar
                        </button>
                        <button class="btn btn-warning" onclick="app.editarProducto('${producto.sku}')" style="background:#f39c12; color:white;">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                    </div>
                </div>
            </div>
        `;

        display.classList.remove('empty');
    }

    mostrarProductoNoEncontrado(sku) {
        const display = document.getElementById('product-display');
        
        display.innerHTML = `
            <div class="product-info">
                <i class="fas fa-exclamation-triangle" style="font-size: 4rem; color: #f6ad55; margin-bottom: 20px;"></i>
                <h3>Producto no encontrado</h3>
                <p>SKU: <code>${sku}</code></p>
                <p style="color: #718096; margin: 10px 0;">No hay productos guardados con ese SKU.</p>
                <p style="color: #718096; margin: 10px 0;">Agrega productos desde el Dashboard</p>
                <button class="btn btn-secondary" onclick="app.limpiarBusqueda()">
                    <i class="fas fa-redo"></i> Limpiar
                </button>
            </div>
        `;
    }

    // ==================== FUNCIONES DEL CARRITO ====================
    agregarAlCarrito() {
        if (!this.productoActual) {
            this.mostrarError('Primero debe buscar un producto');
            return;
        }
        
        if (this.productoActual.stock <= 0) {
            this.mostrarError('Producto agotado');
            return;
        }
        
        this.preguntarCantidad().then(cantidad => {
            if (!cantidad) return;
            
            const unidades = parseInt(cantidad);
            if (isNaN(unidades) || unidades <= 0) {
                this.mostrarError('Cantidad inválida');
                return;
            }
            
            if (unidades > this.productoActual.stock) {
                this.mostrarError(`Solo hay ${this.productoActual.stock} unidades disponibles`);
                return;
            }
            
            const index = this.carrito.findIndex(item => item.sku === this.productoActual.sku);
            
            if (index !== -1) {
                const nuevaCantidad = this.carrito[index].cantidad + unidades;
                if (nuevaCantidad > this.productoActual.stock) {
                    this.mostrarError(`No puedes agregar más. Stock máximo: ${this.productoActual.stock}`);
                    return;
                }
                this.carrito[index].cantidad = nuevaCantidad;
                this.carrito[index].subtotal = nuevaCantidad * this.carrito[index].precio;
            } else {
                this.carrito.push({
                    ...this.productoActual,
                    cantidad: unidades,
                    subtotal: this.productoActual.precio * unidades
                });
            }
            
            this.actualizarCarrito();
            this.mostrarMensaje(`✅ ${unidades} x ${this.productoActual.nombre} agregado al carrito`);
            
            const skuInput = document.getElementById('sku-input');
            if (skuInput) {
                skuInput.value = '';
                skuInput.focus();
            }
        });
    }

    preguntarCantidad() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 20000;
            `;
            
            const content = document.createElement('div');
            content.style.cssText = `
                background: white;
                padding: 30px;
                border-radius: 15px;
                width: 350px;
                max-width: 90%;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                animation: fadeIn 0.3s ease;
            `;
            
            content.innerHTML = `
                <style>
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(-20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                </style>
                <h3 style="color: var(--primary); margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-cart-plus"></i> Cantidad
                </h3>
                <div style="margin-bottom: 25px;">
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <div style="font-weight: 600; margin-bottom: 5px;">${this.productoActual.nombre}</div>
                        <div style="display: flex; justify-content: space-between; color: #718096;">
                            <span>SKU: ${this.productoActual.sku}</span>
                            <span>Precio: $${this.productoActual.precio.toFixed(2)}</span>
                        </div>
                    </div>
                    <label style="display: block; margin-bottom: 8px; color: var(--dark); font-weight: 600;">
                        Stock disponible: <span style="color: var(--primary);">${this.productoActual.stock} unidades</span>
                    </label>
                    <input type="number" id="cantidad-input" min="1" max="${this.productoActual.stock}" value="1" 
                           style="width: 100%; padding: 15px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 1.3rem; text-align: center; margin-top: 10px; font-weight: 600;">
                </div>
                <div style="display: flex; gap: 10px;">
                    <button id="cancelar-btn" style="flex: 1; padding: 12px; background: #e2e8f0; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 1rem;">
                        Cancelar
                    </button>
                    <button id="confirmar-btn" style="flex: 1; padding: 12px; background: var(--primary); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 1rem;">
                        Agregar
                    </button>
                </div>
            `;
            
            modal.appendChild(content);
            document.body.appendChild(modal);
            
            const input = document.getElementById('cantidad-input');
            if (input) {
                input.focus();
                input.select();
            }
            
            const confirmarBtn = document.getElementById('confirmar-btn');
            const cancelarBtn = document.getElementById('cancelar-btn');
            
            if (confirmarBtn) {
                confirmarBtn.onclick = () => {
                    document.body.removeChild(modal);
                    resolve(input ? input.value : null);
                };
            }
            
            if (cancelarBtn) {
                cancelarBtn.onclick = () => {
                    document.body.removeChild(modal);
                    resolve(null);
                };
            }
            
            if (input) {
                input.onkeypress = (e) => {
                    if (e.key === 'Enter') {
                        document.body.removeChild(modal);
                        resolve(input.value);
                    }
                };
            }
            
            const onKeyDown = (e) => {
                if (e.key === 'Escape') {
                    document.body.removeChild(modal);
                    document.removeEventListener('keydown', onKeyDown);
                    resolve(null);
                }
            };
            document.addEventListener('keydown', onKeyDown);
            
            modal.onclick = (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                    document.removeEventListener('keydown', onKeyDown);
                    resolve(null);
                }
            };
        });
    }

    actualizarCarrito() {
        const container = document.getElementById('carrito-container');
        
        if (!container) return;
        
        if (this.carrito.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #718096;">
                    <i class="fas fa-shopping-cart" style="font-size: 3rem; margin-bottom: 15px;"></i>
                    <h3>Carrito Vacío</h3>
                    <p>Agrega productos para comenzar una venta</p>
                </div>
            `;
            localStorage.removeItem('carrito');
            return;
        }
        
        localStorage.setItem('carrito', JSON.stringify(this.carrito));
        
        let itemsHTML = '<div id="carrito-items">';
        this.carrito.forEach((item, index) => {
            itemsHTML += `
                <div class="carrito-item">
                    <div class="item-info">
                        <h4>${item.nombre}</h4>
                        <div class="item-sku">${item.sku}</div>
                        <div class="item-precio">$${item.precio.toFixed(2)}</div>
                    </div>
                    
                    <div class="item-cantidad">
                        <button class="btn-cantidad" onclick="app.modificarCantidad(${index}, -1)">
                            <i class="fas fa-minus"></i>
                        </button>
                        <span class="cantidad-numero">${item.cantidad}</span>
                        <button class="btn-cantidad" onclick="app.modificarCantidad(${index}, 1)">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    
                    <div class="item-subtotal">$${item.subtotal.toFixed(2)}</div>
                    
                    <button class="btn-eliminar" onclick="app.eliminarDelCarrito(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        });
        itemsHTML += '</div>';
        
        const subtotal = this.carrito.reduce((sum, item) => sum + item.subtotal, 0);
        
        itemsHTML += `
            <div id="carrito-totales" style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #e2e8f0;">
                <div class="total-linea" style="display: flex; justify-content: space-between; font-size: 1.2rem; font-weight: 600;">
                    <span>Total:</span>
                    <span>$${subtotal.toFixed(2)}</span>
                </div>
            </div>
            
            <div id="botones-pago" style="margin-top: 20px;">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px;">
                    <button class="btn-pago btn-efectivo ${this.metodoPagoSeleccionado === 'efectivo' ? 'activo' : ''}" 
                            onclick="app.seleccionarMetodoPago('efectivo')">
                        <i class="fas fa-money-bill-wave"></i> Efectivo
                    </button>
                    <button class="btn-pago btn-debito ${this.metodoPagoSeleccionado === 'debito' ? 'activo' : ''}" 
                            onclick="app.seleccionarMetodoPago('debito')">
                        <i class="fas fa-credit-card"></i> Débito
                    </button>
                    <button class="btn-pago btn-credito ${this.metodoPagoSeleccionado === 'credito' ? 'activo' : ''}" 
                            onclick="app.seleccionarMetodoPago('credito')">
                        <i class="fas fa-credit-card"></i> Crédito
                    </button>
                    <button class="btn-pago btn-qr ${this.metodoPagoSeleccionado === 'qr' ? 'activo' : ''}" 
                            onclick="app.seleccionarMetodoPago('qr')">
                        <i class="fas fa-qrcode"></i> QR
                    </button>
                    <button class="btn-pago btn-transferencia ${this.metodoPagoSeleccionado === 'transferencia' ? 'activo' : ''}" 
                            onclick="app.seleccionarMetodoPago('transferencia')">
                        <i class="fas fa-university"></i> Transferencia
                    </button>
                    <button class="btn-pago btn-mercadopago ${this.metodoPagoSeleccionado === 'mercadopago' ? 'activo' : ''}" 
                            onclick="app.seleccionarMetodoPago('mercadopago')">
                        <i class="fas fa-mobile-alt"></i> Mercado Pago
                    </button>
                </div>
                
                <button class="btn btn-success" onclick="app.abrirProcesarPago()" 
                        style="width: 100%; padding: 15px; background: var(--ingreso); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                    <i class="fas fa-check"></i> Procesar Pago
                </button>
            </div>
        `;
        
        container.innerHTML = itemsHTML;
    }

    modificarCantidad(index, cambio) {
        const nuevoCantidad = this.carrito[index].cantidad + cambio;
        
        if (nuevoCantidad < 1) {
            this.eliminarDelCarrito(index);
        } else if (nuevoCantidad > this.carrito[index].stock) {
            this.mostrarError(`Stock máximo: ${this.carrito[index].stock}`);
        } else {
            this.carrito[index].cantidad = nuevoCantidad;
            this.carrito[index].subtotal = nuevoCantidad * this.carrito[index].precio;
            this.actualizarCarrito();
        }
    }

    eliminarDelCarrito(index) {
        if (confirm('¿Eliminar este producto del carrito?')) {
            this.carrito.splice(index, 1);
            this.actualizarCarrito();
        }
    }

    vaciarCarrito() {
        if (this.carrito.length === 0) return;
        
        if (confirm('¿Vaciar todo el carrito?')) {
            this.carrito = [];
            this.actualizarCarrito();
            this.mostrarMensaje('✅ Carrito vaciado');
        }
    }

    seleccionarMetodoPago(metodo) {
        this.metodoPagoSeleccionado = metodo;
        this.actualizarCarrito();
    }

    // ==================== FUNCIONES DE PAGO CON DESCUENTO/RECARGO ====================

    abrirProcesarPago() {
        if (this.carrito.length === 0) {
            this.mostrarError('No hay productos en el carrito');
            return;
        }
        
        const totalBase = this.carrito.reduce((sum, item) => sum + item.subtotal, 0);
        
        let modal = document.getElementById('modal-procesar-pago');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-procesar-pago';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }
        
        const metodo = this.metodoPagoSeleccionado;
        let seccionMetodo = '';
        
        if (metodo === 'efectivo') {
            seccionMetodo = `
                <div id="seccion-descuento" style="margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 8px;">
                    <h4 style="margin-bottom: 15px; color: var(--dark);">Aplicar descuento</h4>
                    <div style="display: flex; gap: 20px; margin-bottom: 15px;">
                        <label style="display: flex; align-items: center; gap: 5px;">
                            <input type="radio" name="tipo-descuento" value="porcentaje" checked> Porcentaje (%)
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px;">
                            <input type="radio" name="tipo-descuento" value="monto"> Monto fijo ($)
                        </label>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <input type="number" id="descuento-valor" class="form-control" min="0" step="0.01" value="0" style="flex: 2;">
                        <button class="btn btn-primary" id="btn-aplicar-descuento" style="flex: 1;">Aplicar</button>
                    </div>
                    <p style="margin-top: 10px; font-size: 0.9rem; color: #718096;">El descuento se resta del total base.</p>
                </div>
            `;
        } else if (metodo === 'credito') {
            seccionMetodo = `
                <div id="seccion-recargo" style="margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 8px;">
                    <h4 style="margin-bottom: 15px; color: var(--dark);">Recargo por cuotas</h4>
                    <div style="display: flex; gap: 15px; margin-bottom: 15px;">
                        <button class="btn btn-outline" data-cuotas="1" onclick="app.seleccionarCuotas(1)">1 pago (5%)</button>
                        <button class="btn btn-outline" data-cuotas="3" onclick="app.seleccionarCuotas(3)">3 pagos (15%)</button>
                        <button class="btn btn-outline" data-cuotas="6" onclick="app.seleccionarCuotas(6)">6 pagos (20%)</button>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label>Recargo manual (%)</label>
                        <input type="number" id="recargo-manual" class="form-control" min="0" step="0.1" value="0">
                    </div>
                    <button class="btn btn-primary" id="btn-aplicar-recargo">Aplicar recargo</button>
                    <p style="margin-top: 10px; font-size: 0.9rem; color: #718096;">El recargo se suma al total base.</p>
                </div>
            `;
        } else {
            seccionMetodo = '';
        }
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-credit-card"></i> Procesar Pago</h3>
                    <button class="btn-cerrar-modal" data-modal="modal-procesar-pago" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <div style="font-size: 0.9rem; color: #718096;">Total base</div>
                        <div id="monto-base-pago" style="font-size: 1.8rem; font-weight: 600; color: var(--dark);">$${totalBase.toFixed(2)}</div>
                        <div style="font-size: 0.9rem; color: #718096; margin-top: 5px;">
                            Método: <span id="metodo-pago-seleccionado">${metodo.charAt(0).toUpperCase() + metodo.slice(1)}</span>
                        </div>
                        <div style="margin-top: 10px; padding: 10px; background: #e6f7f7; border-radius: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 600;">TOTAL A PAGAR:</span>
                                <span id="total-final-pago" style="font-size: 2rem; font-weight: 700; color: var(--primary);">$${totalBase.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${seccionMetodo}
                    
                    <div id="seccion-efectivo" style="display: ${metodo === 'efectivo' ? 'block' : 'none'}; margin-top: 20px;">
                        <div class="form-group">
                            <label><i class="fas fa-money-bill-wave"></i> Monto recibido</label>
                            <input type="number" id="monto-recibido" class="form-control" min="0" step="0.01" placeholder="0.00" value="${totalBase.toFixed(2)}">
                        </div>
                        <div id="vuelto-info" style="background: #e6f7f7; padding: 15px; border-radius: 8px; margin-top: 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 600;">Vuelto:</span>
                                <span id="monto-vuelto" style="font-size: 1.3rem; font-weight: 700; color: var(--primary);">$0.00</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-actions" style="margin-top: 30px;">
                        <button type="button" class="btn btn-secondary btn-cerrar-modal" data-modal="modal-procesar-pago">
                            Cancelar
                        </button>
                        <button type="button" id="btn-finalizar-venta" class="btn btn-success" 
                                style="background: var(--ingreso); color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            <i class="fas fa-check"></i> Finalizar Venta
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.abrirModal('modal-procesar-pago');
        
        let totalFinal = totalBase;
        let descuentoAplicado = { tipo: null, valor: 0 };
        let recargoAplicado = { porcentaje: 5, cuotas: 1 };
        
        const actualizarTotalFinal = () => {
            const totalFinalElement = document.getElementById('total-final-pago');
            if (totalFinalElement) {
                totalFinalElement.textContent = `$${totalFinal.toFixed(2)}`;
            }
            if (metodo === 'efectivo') {
                const montoRecibido = document.getElementById('monto-recibido');
                if (montoRecibido && parseFloat(montoRecibido.value) < totalFinal) {
                    montoRecibido.value = totalFinal.toFixed(2);
                }
                this.calcularVuelto(totalFinal);
            }
        };
        
        if (metodo === 'efectivo') {
            const btnAplicar = document.getElementById('btn-aplicar-descuento');
            const valorInput = document.getElementById('descuento-valor');
            const radios = document.getElementsByName('tipo-descuento');
            
            const aplicarDescuento = () => {
                let tipo = 'porcentaje';
                for (let radio of radios) {
                    if (radio.checked) {
                        tipo = radio.value;
                        break;
                    }
                }
                const valor = parseFloat(valorInput.value) || 0;
                if (valor <= 0) {
                    totalFinal = totalBase;
                    descuentoAplicado = { tipo: null, valor: 0 };
                } else {
                    if (tipo === 'porcentaje') {
                        if (valor > 100) {
                            alert('El porcentaje no puede ser mayor a 100%');
                            return;
                        }
                        totalFinal = totalBase * (1 - valor / 100);
                    } else {
                        if (valor > totalBase) {
                            alert('El monto de descuento no puede superar el total');
                            return;
                        }
                        totalFinal = totalBase - valor;
                    }
                    descuentoAplicado = { tipo, valor };
                }
                actualizarTotalFinal();
            };
            
            btnAplicar.addEventListener('click', aplicarDescuento);
            valorInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') aplicarDescuento();
            });
        }
        
        if (metodo === 'credito') {
            // Definir la función en this para que pueda ser llamada desde el onclick
            this.seleccionarCuotas = (cuotas) => {
                let porcentaje = 0;
                if (cuotas === 1) porcentaje = 5;
                else if (cuotas === 3) porcentaje = 15;
                else if (cuotas === 6) porcentaje = 20;
                
                const recargoManual = document.getElementById('recargo-manual');
                if (recargoManual) recargoManual.value = porcentaje;
                
                recargoAplicado.cuotas = cuotas;
                recargoAplicado.porcentaje = porcentaje;
                totalFinal = totalBase * (1 + porcentaje / 100);
                actualizarTotalFinal();
            };

            const btnAplicarRecargo = document.getElementById('btn-aplicar-recargo');
            const recargoManual = document.getElementById('recargo-manual');

            const aplicarRecargo = () => {
                let porcentaje = parseFloat(recargoManual.value) || 0;
                if (porcentaje < 0) porcentaje = 0;
                recargoAplicado.porcentaje = porcentaje;
                if (!recargoAplicado.cuotas) recargoAplicado.cuotas = 1;
                totalFinal = totalBase * (1 + porcentaje / 100);
                actualizarTotalFinal();
            };

            if (btnAplicarRecargo) {
                btnAplicarRecargo.addEventListener('click', aplicarRecargo);
            }
            if (recargoManual) {
                recargoManual.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') aplicarRecargo();
                });
            }

            // Inicializar con 1 pago (5%)
            setTimeout(() => {
                if (typeof this.seleccionarCuotas === 'function') {
                    this.seleccionarCuotas(1);
                }
            }, 100);
        }
        
        const montoRecibido = document.getElementById('monto-recibido');
        if (montoRecibido) {
            montoRecibido.addEventListener('input', () => this.calcularVuelto(totalFinal));
            montoRecibido.focus();
            montoRecibido.select();
        }
        
        // Definir calcularVuelto como método de instancia
        this.calcularVuelto = (total) => {
            const recibidoInput = document.getElementById('monto-recibido');
            if (!recibidoInput) return;
            const recibido = parseFloat(recibidoInput.value) || 0;
            const btnFinalizar = document.getElementById('btn-finalizar-venta');
            const vueltoInfo = document.getElementById('vuelto-info');
            const montoVuelto = document.getElementById('monto-vuelto');
            
            if (recibido >= total) {
                const vuelto = recibido - total;
                if (montoVuelto) montoVuelto.textContent = `$${vuelto.toFixed(2)}`;
                if (vueltoInfo) vueltoInfo.style.display = 'block';
                if (btnFinalizar) btnFinalizar.disabled = false;
            } else {
                if (vueltoInfo) vueltoInfo.style.display = 'none';
                if (btnFinalizar) btnFinalizar.disabled = true;
            }
        };
        
        // Asignar evento al botón finalizar de manera directa (método original que funcionaba)
        
    }
    // ==================== NUEVAS FUNCIONES: DEVOLUCIONES Y CAMBIOS ====================

    guardarVentaEnHistorial(venta) {
        const historial = JSON.parse(localStorage.getItem('ventasHistoricas')) || [];
        historial.push(venta);
        localStorage.setItem('ventasHistoricas', JSON.stringify(historial));
    }

    async actualizarStockProductos(operacion, items) {
        console.log('Ejecutando actualizarStockProductos', operacion, items);
        const productos = JSON.parse(localStorage.getItem('productos')) || [];
        console.log('Productos en localStorage:', productos);
        
        const dbOperacion = operacion === 'restar' ? 'decrementar' : 'incrementar';
        
        items.forEach(item => {
            const index = productos.findIndex(p => p.sku.trim().toLowerCase() === item.sku.trim().toLowerCase());
            if (index !== -1) {
                const stockAnterior = productos[index].stock || 0;
                if (operacion === 'restar') {
                    productos[index].stock = stockAnterior - item.cantidad;
                } else {
                    productos[index].stock = stockAnterior + item.cantidad;
                }
                console.log(`Stock en localStorage actualizado de ${stockAnterior} a ${productos[index].stock}`);
            } else {
                console.warn(`Producto con SKU "${item.sku}" no encontrado en localStorage`);
            }
        });
        
        localStorage.setItem('productos', JSON.stringify(productos));
        console.log('Productos guardados en localStorage:', JSON.parse(localStorage.getItem('productos')));
        
        if (window.api && window.api.updateStock) {
            for (const item of items) {
                let productId = item.id;
                
                if (!productId) {
                    const prod = productos.find(p => p.sku.trim().toLowerCase() === item.sku.trim().toLowerCase());
                    if (prod && prod.id) {
                        productId = prod.id;
                    } else {
                        try {
                            const productoBD = await this.obtenerProductoPorSKU(item.sku);
                            if (productoBD && productoBD.id) {
                                productId = productoBD.id;
                            }
                        } catch (e) {
                            console.error('Error al buscar producto en BD por SKU', e);
                        }
                    }
                }
                
                if (productId) {
                    try {
                        await window.api.updateStock(productId, item.cantidad, dbOperacion);
                        console.log(`Stock actualizado en BD para producto ${productId} (${item.sku})`);
                    } catch (error) {
                        console.error(`Error al actualizar stock en BD para ${item.sku}:`, error);
                    }
                } else {
                    console.warn(`No se pudo obtener ID para el producto con SKU ${item.sku}, no se actualizará en BD`);
                }
            }
        } else {
            console.warn('API no disponible para actualizar stock en base de datos');
        }
    }

    abrirModalDevolucion() {
        let modal = document.getElementById('modal-devolucion');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-devolucion';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3><i class="fas fa-undo-alt"></i> Devoluciones y Cambios</h3>
                    <button class="btn-cerrar-modal" data-modal="modal-devolucion" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding: 20px;">
                    <div class="form-group">
                        <label>Buscar venta por ID, fecha o monto</label>
                        <input type="text" id="buscar-venta-input" class="form-control" placeholder="Ej: #123, 2025-03-09, $150.00">
                    </div>
                    <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                        <button class="btn btn-primary" id="btn-buscar-venta">
                            <i class="fas fa-search"></i> Buscar
                        </button>
                        <button class="btn btn-secondary" id="btn-ver-historial-devoluciones">
                            <i class="fas fa-history"></i> Ver historial de devoluciones
                        </button>
                    </div>
                    <div id="resultados-busqueda" style="max-height: 300px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
                        <p style="text-align: center; color: #718096;">Ingrese un término y haga clic en Buscar</p>
                    </div>
                    <div id="detalle-venta-devolucion" style="margin-top: 20px;"></div>
                </div>
            </div>
        `;

        this.abrirModal('modal-devolucion');

        document.getElementById('btn-buscar-venta').addEventListener('click', () => {
            const query = document.getElementById('buscar-venta-input').value.trim();
            this.buscarVentas(query);
        });

        document.getElementById('btn-ver-historial-devoluciones').addEventListener('click', () => {
            this.mostrarHistorialDevoluciones();
        });

        document.getElementById('buscar-venta-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('btn-buscar-venta').click();
            }
        });
    }

    buscarVentas(query) {
        const historial = JSON.parse(localStorage.getItem('ventasHistoricas')) || [];
        const resultados = historial.filter(venta => {
            const idMatch = venta.id.toString().includes(query);
            const fechaMatch = new Date(venta.fecha).toLocaleDateString().includes(query);
            const montoMatch = venta.total.toFixed(2).includes(query);
            return idMatch || fechaMatch || montoMatch;
        });

        this.mostrarResultadosBusqueda(resultados);
    }

    mostrarResultadosBusqueda(resultados) {
        const contenedor = document.getElementById('resultados-busqueda');
        if (resultados.length === 0) {
            contenedor.innerHTML = '<p style="text-align: center; color: #718096;">No se encontraron ventas</p>';
            return;
        }

        let html = '<h4 style="margin-bottom: 10px;">Ventas encontradas:</h4>';
        resultados.forEach(venta => {
            html += `
                <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 10px; cursor: pointer;"
                     onclick="app.mostrarDetalleVentaDevolucion(${JSON.stringify(venta).replace(/"/g, '&quot;')})">
                    <div style="display: flex; justify-content: space-between;">
                        <span><strong>#${venta.id}</strong></span>
                        <span>${new Date(venta.fecha).toLocaleString()}</span>
                    </div>
                    <div>Total: $${venta.total.toFixed(2)} (${venta.metodo_pago})</div>
                </div>
            `;
        });
        contenedor.innerHTML = html;
    }

    mostrarDetalleVentaDevolucion(venta) {
        const contenedor = document.getElementById('detalle-venta-devolucion');
        let html = `
            <h4 style="margin-bottom: 10px;">Productos de la venta #${venta.id}</h4>
            <div style="max-height: 300px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
        `;

        venta.productos.forEach((producto, index) => {
            html += `
                <div style="display: flex; align-items: center; gap: 10px; padding: 10px; border-bottom: 1px solid #e2e8f0;">
                    <input type="checkbox" id="prod-${index}" data-sku="${producto.sku}" data-precio="${producto.precio}" data-max="${producto.cantidad}">
                    <div style="flex: 1;">
                        <strong>${producto.nombre}</strong> (SKU: ${producto.sku})
                        <div>Cantidad original: ${producto.cantidad} - Precio: $${producto.precio.toFixed(2)}</div>
                    </div>
                    <div>
                        <label>Cantidad a devolver:</label>
                        <input type="number" id="cant-${index}" min="1" max="${producto.cantidad}" value="${producto.cantidad}" style="width: 70px; padding: 5px;" ${producto.cantidad === 0 ? 'disabled' : ''}>
                    </div>
                </div>
            `;
        });

        html += `
            </div>
            <div style="margin-top: 20px; display: flex; gap: 10px;">
                <button class="btn btn-danger" onclick="app.procesarDevolucion(${JSON.stringify(venta).replace(/"/g, '&quot;')}, 'reembolso')">
                    <i class="fas fa-money-bill-wave"></i> Devolución con reembolso
                </button>
                <button class="btn btn-warning" onclick="app.procesarDevolucion(${JSON.stringify(venta).replace(/"/g, '&quot;')}, 'cambio')">
                    <i class="fas fa-exchange-alt"></i> Cambio por otro producto
                </button>
                <button class="btn btn-secondary" onclick="document.getElementById('detalle-venta-devolucion').innerHTML = '';">
                    Cancelar
                </button>
            </div>
        `;

        contenedor.innerHTML = html;
    }

    async procesarDevolucion(venta, tipo) {
        try {
            const checkboxes = document.querySelectorAll('#detalle-venta-devolucion input[type="checkbox"]');
            const itemsDevueltos = [];
            let totalReembolso = 0;

            checkboxes.forEach((checkbox, index) => {
                if (checkbox.checked) {
                    const cantidadInput = document.getElementById(`cant-${index}`);
                    const cantidad = parseInt(cantidadInput.value);
                    const sku = checkbox.dataset.sku;
                    const precio = parseFloat(checkbox.dataset.precio);
                    const max = parseInt(checkbox.dataset.max);

                    if (cantidad > 0 && cantidad <= max) {
                        itemsDevueltos.push({
                            sku: sku,
                            cantidad: cantidad,
                            precio: precio,
                            subtotal: precio * cantidad
                        });
                        totalReembolso += precio * cantidad;
                    } else {
                        alert(`Cantidad inválida para el producto con SKU ${sku}`);
                        return;
                    }
                }
            });

            if (itemsDevueltos.length === 0) {
                alert('Seleccione al menos un producto para devolver');
                return;
            }

            if (!confirm(`¿Confirmar devolución de ${itemsDevueltos.length} producto(s) por $${totalReembolso.toFixed(2)}?`)) {
                return;
            }

            await this.actualizarStockProductos('sumar', itemsDevueltos);

            const devolucion = {
                id: Date.now(),
                ventaId: venta.id,
                fecha: new Date().toISOString(),
                items: itemsDevueltos,
                totalReembolso: totalReembolso,
                tipo: tipo
            };
            const historialDevoluciones = JSON.parse(localStorage.getItem('devolucionesHistoricas')) || [];
            historialDevoluciones.push(devolucion);
            localStorage.setItem('devolucionesHistoricas', JSON.stringify(historialDevoluciones));

            if (tipo === 'reembolso') {
                this.agregarEgreso(totalReembolso, `Devolución venta #${venta.id}`, venta.metodo_pago, `Devolución`);
                this.mostrarNotificacion(`✅ Reembolso de $${totalReembolso.toFixed(2)} procesado`);
            } else if (tipo === 'cambio') {
                this.mostrarNotificacion(`Productos devueltos. Ahora puede agregar los nuevos productos al carrito. La diferencia se ajustará al finalizar la venta.`);
                sessionStorage.setItem('cambioPendiente', JSON.stringify({
                    ventaId: venta.id,
                    totalReembolso: totalReembolso
                }));
            }
        } catch (error) {
            console.error('Error en devolución:', error);
            this.mostrarError('Ocurrió un error al procesar la devolución');
        } finally {
            this.cerrarModal('modal-devolucion');
            setTimeout(() => {
                const skuInput = document.getElementById('sku-input');
                if (skuInput) skuInput.focus();
            }, 500);
        }
    }

    mostrarHistorialDevoluciones() {
        const devoluciones = JSON.parse(localStorage.getItem('devolucionesHistoricas')) || [];
        let modal = document.getElementById('modal-historial-devoluciones');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-historial-devoluciones';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        let html = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h3><i class="fas fa-history"></i> Historial de Devoluciones</h3>
                    <button class="btn-cerrar-modal" data-modal="modal-historial-devoluciones" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding: 20px; max-height: 500px; overflow-y: auto;">
        `;

        if (devoluciones.length === 0) {
            html += '<p style="text-align: center;">No hay devoluciones registradas</p>';
        } else {
            devoluciones.reverse().forEach(dev => {
                html += `
                    <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between;">
                            <strong>Devolución #${dev.id}</strong>
                            <span>${new Date(dev.fecha).toLocaleString()}</span>
                        </div>
                        <div>Venta original: #${dev.ventaId}</div>
                        <div>Tipo: ${dev.tipo === 'reembolso' ? 'Reembolso' : 'Cambio'}</div>
                        <div>Total reembolsado: $${dev.totalReembolso.toFixed(2)}</div>
                        <div style="margin-top: 10px;">
                            <strong>Productos:</strong>
                            ${dev.items.map(item => `<div>${item.cantidad} x SKU ${item.sku} - $${item.subtotal.toFixed(2)}</div>`).join('')}
                        </div>
                        <button class="btn btn-sm btn-danger" onclick="app.eliminarDevolucion('${dev.id}')" style="margin-top: 10px;">
                            <i class="fas fa-trash"></i> Eliminar
                        </button>
                    </div>
                `;
            });
        }

        html += `
                </div>
                <div class="form-actions" style="padding: 20px;">
                    <button class="btn btn-secondary btn-cerrar-modal" data-modal="modal-historial-devoluciones">Cerrar</button>
                </div>
            </div>
        `;

        modal.innerHTML = html;
        this.abrirModal('modal-historial-devoluciones');
    }

    eliminarDevolucion(id) {
        if (confirm('¿Está seguro de eliminar esta devolución del historial? Esta acción no afecta el stock.')) {
            const historial = JSON.parse(localStorage.getItem('devolucionesHistoricas')) || [];
            const nuevoHistorial = historial.filter(dev => dev.id != id);
            localStorage.setItem('devolucionesHistoricas', JSON.stringify(nuevoHistorial));
            this.mostrarNotificacion('✅ Devolución eliminada del historial');
            this.mostrarHistorialDevoluciones();
        }
    }

    // ==================== FUNCIONES DE LISTA DE PRECIOS ====================
    async abrirListaPrecios() {
        try {
            let modal = document.getElementById('modal-lista-precios');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'modal-lista-precios';
                modal.className = 'modal';
                document.body.appendChild(modal);
            }
            
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 1300px; width: 95%; padding: 0; overflow: hidden;">
                    <div style="background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: white; padding: 20px 25px; display: flex; justify-content: space-between; align-items: center;">
                        <h2 style="margin: 0; display: flex; align-items: center; gap: 15px; font-size: 1.8rem;">
                            <i class="fas fa-tags"></i> LISTA DE PRECIOS
                        </h2>
                        <button class="btn-cerrar-modal" data-modal="modal-lista-precios" 
                                style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 1.8rem; cursor: pointer; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.3s;"
                                onmouseover="this.style.background='rgba(255,255,255,0.3)'"
                                onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div style="padding: 25px;">
                        <div style="margin-bottom: 25px; display: flex; gap: 15px; align-items: center;">
                            <div style="flex: 1; position: relative;">
                                <i class="fas fa-search" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #a0aec0; font-size: 1.2rem;"></i>
                                <input type="text" id="search-precios" 
                                       class="form-control" 
                                       placeholder="🔍 Buscar por SKU, nombre, categoría o marca..."
                                       style="padding-left: 50px; height: 55px; font-size: 1.1rem; border: 2px solid #e2e8f0; border-radius: 10px; width: 100%;">
                            </div>
                            <button class="btn btn-primary" onclick="app.filtrarListaPrecios()" 
                                    style="height: 55px; padding: 0 30px; font-size: 1.1rem; background: var(--primary); color: white; border: none; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-search"></i> Buscar
                            </button>
                            <button class="btn btn-outline" onclick="app.exportarListaPrecios()" 
                                    style="height: 55px; padding: 0 30px; font-size: 1.1rem; border: 2px solid var(--primary); color: var(--primary); background: white; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-file-export"></i> Exportar CSV
                            </button>
                        </div>
                        
                        <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: auto; max-height: 500px; width: 100%;">
                            <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                                <colgroup>
                                    <col style="width: 12%;">
                                    <col style="width: 25%;">
                                    <col style="width: 12%;">
                                    <col style="width: 10%;">
                                    <col style="width: 12%;">
                                    <col style="width: 10%;">
                                    <col style="width: 9%;">
                                </colgroup>
                                <thead style="background: #f8fafc; position: sticky; top: 0; z-index: 10;">
                                    <tr>
                                        <th style="padding: 16px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #2d3748; font-weight: 700; font-size: 0.95rem;">SKU</th>
                                        <th style="padding: 16px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #2d3748; font-weight: 700; font-size: 0.95rem;">PRODUCTO</th>
                                        <th style="padding: 16px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #2d3748; font-weight: 700; font-size: 0.95rem;">CATEGORÍA</th>
                                        <th style="padding: 16px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #2d3748; font-weight: 700; font-size: 0.95rem;">MARCA</th>
                                        <th style="padding: 16px; text-align: right; border-bottom: 2px solid #e2e8f0; color: #2d3748; font-weight: 700; font-size: 0.95rem;">PRECIO</th>
                                        <th style="padding: 16px; text-align: center; border-bottom: 2px solid #e2e8f0; color: #2d3748; font-weight: 700; font-size: 0.95rem;">STOCK</th>
                                        <th style="padding: 16px; text-align: center; border-bottom: 2px solid #e2e8f0; color: #2d3748; font-weight: 700; font-size: 0.95rem;">ACCIÓN</th>
                                    </tr>
                                </thead>
                                <tbody id="precios-tbody">
                                    <tr>
                                        <td colspan="7" style="text-align: center; padding: 60px; color: #718096;">
                                            <i class="fas fa-spinner fa-spin" style="font-size: 4rem; margin-bottom: 20px; color: var(--primary);"></i>
                                            <h3 style="margin-bottom: 10px; font-size: 1.3rem;">Cargando productos...</h3>
                                            <p style="color: #a0aec0; font-size: 1rem;">Por favor espere</p>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 25px; padding: 20px 0 0; border-top: 1px solid #e2e8f0;">
                            <div style="display: flex; align-items: center; gap: 30px;">
                                <span style="color: #2d3748; font-weight: 600; font-size: 1.1rem;">
                                    <i class="fas fa-box"></i> <span id="product-count">0</span> productos encontrados
                                </span>
                                <span style="color: #2d3748; font-weight: 600; font-size: 1.1rem;">
                                    <i class="fas fa-cubes"></i> Stock total: <span id="total-stock">0</span> unidades
                                </span>
                            </div>
                            <div style="color: #718096; font-size: 1rem; background: #f7fafc; padding: 10px 20px; border-radius: 8px;">
                                <i class="fas fa-info-circle"></i> Click en "Agregar" para añadir al carrito
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            this.abrirModal('modal-lista-precios');
            this.cargarListaPrecios();
            
            const searchInput = document.getElementById('search-precios');
            if (searchInput) {
                searchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.filtrarListaPrecios();
                });
                setTimeout(() => searchInput.focus(), 100);
            }
            
        } catch (error) {
            this.mostrarError('No se pudo abrir la lista de precios');
        }
    }

    filtrarListaPrecios() {
        const searchInput = document.getElementById('search-precios');
        if (searchInput) this.cargarListaPrecios(searchInput.value);
    }

    seleccionarProductoLista(sku) {
        this.obtenerProductoPorSKU(sku).then(producto => {
            if (producto) {
                this.productoActual = producto;
                this.agregarAlCarrito();
                this.cerrarModal('modal-lista-precios');
            }
        });
    }

    async editarProducto(sku) {
        const producto = await this.obtenerProductoPorSKU(sku);
        if (producto) {
            this.abrirModalNuevoProducto(producto);
        } else {
            alert('Producto no encontrado');
        }
    }

    async cargarListaPrecios(searchTerm = '') {
        try {
            let productos = [];
            
            if (window.api && window.api.getPriceList) {
                if (searchTerm) {
                    productos = await window.api.searchProducts(searchTerm);
                } else {
                    productos = await window.api.getPriceList();
                }
            } else {
                productos = JSON.parse(localStorage.getItem('productos')) || [];
                if (searchTerm) {
                    const termino = searchTerm.toLowerCase();
                    productos = productos.filter(p => 
                        p.sku.toLowerCase().includes(termino) ||
                        p.nombre.toLowerCase().includes(termino) ||
                        (p.categoria && p.categoria.toLowerCase().includes(termino)) ||
                        (p.marca && p.marca.toLowerCase().includes(termino))
                    );
                }
            }
            
            const tbody = document.getElementById('precios-tbody');
            if (!tbody) return;
            
            if (!productos || productos.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 60px; color: #718096;">
                            <i class="fas fa-box-open" style="font-size: 4rem; margin-bottom: 20px;"></i>
                            <h3>No hay productos guardados</h3>
                            <p>Agrega productos desde el Dashboard</p>
                        </td>
                    </tr>
                `;
                document.getElementById('product-count').textContent = '0';
                document.getElementById('total-stock').textContent = '0';
                return;
            }
            
            let html = '';
            let stockTotal = 0;
            
            productos.forEach(producto => {
                stockTotal += producto.stock || 0;
                
                let stockClass = '';
                let stockTexto = producto.stock || 0;
                
                if (producto.stock <= 0) {
                    stockClass = 'stock-agotado';
                    stockTexto = 'AGOTADO';
                } else if (producto.stock <= 5) {
                    stockClass = 'stock-bajo';
                    stockTexto = producto.stock + ' (BAJO)';
                }
                
                const precioFormateado = new Intl.NumberFormat('es-MX', {
                    style: 'currency',
                    currency: 'MXN'
                }).format(producto.precio || 0);
                
                html += `
                    <tr>
                        <td style="padding: 12px; font-weight: 600;">${producto.sku}</td>
                        <td style="padding: 12px;">
                            <div><strong>${producto.nombre}</strong></div>
                            ${producto.descripcion ? `<div style="font-size: 0.85rem;">${producto.descripcion.substring(0,50)}</div>` : ''}
                        </td>
                        <td style="padding: 12px;">${producto.categoria || '-'}</td>
                        <td style="padding: 12px;">${producto.marca || '-'}</td>
                        <td style="padding: 12px; text-align: right; font-weight: 700; color: var(--primary);">${precioFormateado}</td>
                        <td style="padding: 12px; text-align: center;">
                            <span style="padding: 4px 8px; border-radius: 4px; background: ${producto.stock > 0 ? '#d4edda' : '#f8d7da'};">
                                ${stockTexto}
                            </span>
                        </td>
                        <td style="padding: 12px; text-align: center;">
                            <button class="btn btn-sm btn-info" onclick="app.editarProducto('${producto.sku}')" style="margin-right: 5px;">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-primary btn-sm" 
                                    onclick="app.seleccionarProductoLista('${producto.sku}')"
                                    ${producto.stock <= 0 ? 'disabled' : ''}>
                                <i class="fas fa-cart-plus"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            
            tbody.innerHTML = html;
            document.getElementById('product-count').textContent = productos.length;
            document.getElementById('total-stock').textContent = stockTotal;
            
        } catch (error) {
            // Silenciar error
        }
    }

    exportarListaPrecios() {
        alert('Función de exportar CSV en desarrollo');
    }

    // ==================== FINALIZAR VENTA ====================
    finalizarVenta() {
        // Validar que haya productos en el carrito
        if (this.carrito.length === 0) {
            this.mostrarError('No hay productos en el carrito');
            return;
        }

        // Obtener referencia al modal de pago
        const modal = document.getElementById('modal-procesar-pago');
        if (!modal) return;

        // Obtener método de pago
        const metodo = this.metodoPagoSeleccionado;

        // Calcular total base (sin descuento/recargo)
        const totalBase = this.carrito.reduce((sum, item) => sum + item.subtotal, 0);

        // Determinar total final según método (descuento/recargo)
        let totalFinal = totalBase;
        if (metodo === 'efectivo') {
            // Leer descuento aplicado desde el DOM
            const descuentoValor = parseFloat(document.getElementById('descuento-valor')?.value) || 0;
            const tipoDescuento = document.querySelector('input[name="tipo-descuento"]:checked')?.value;
            if (descuentoValor > 0) {
                if (tipoDescuento === 'porcentaje') {
                    totalFinal = totalBase * (1 - descuentoValor / 100);
                } else {
                    totalFinal = Math.max(0, totalBase - descuentoValor);
                }
            }
        } else if (metodo === 'credito') {
            // Leer recargo manual
            const recargoManual = parseFloat(document.getElementById('recargo-manual')?.value) || 0;
            totalFinal = totalBase * (1 + recargoManual / 100);
        }

        // Para efectivo, verificar que el monto recibido cubra el total
        let montoRecibido = null;
        if (metodo === 'efectivo') {
            const recibidoInput = document.getElementById('monto-recibido');
            if (!recibidoInput) {
                this.mostrarError('No se encontró el campo de monto recibido');
                return;
            }
            montoRecibido = parseFloat(recibidoInput.value) || 0;
            if (montoRecibido < totalFinal) {
                this.mostrarError(`El monto recibido ($${montoRecibido.toFixed(2)}) es menor al total ($${totalFinal.toFixed(2)})`);
                return;
            }
        }

        // Aplicar comisión del método de pago
        const comisionPorcentaje = this.comisiones[metodo] || 0;
        const comisionMonto = totalFinal * (comisionPorcentaje / 100);
        const totalNeto = totalFinal - comisionMonto;

        // Crear objeto venta
        const venta = {
            id: Date.now(),
            fecha: new Date().toISOString(),
            productos: this.carrito.map(item => ({
                id: item.id,
                sku: item.sku,
                nombre: item.nombre,
                cantidad: item.cantidad,
                precio: item.precio,
                subtotal: item.subtotal
            })),
            total: totalFinal,          // total que pagó el cliente
            total_neto: totalNeto,      // total después de comisión
            comision_porcentaje: comisionPorcentaje,
            comision_monto: comisionMonto,
            metodo_pago: metodo,
            descuento_aplicado: metodo === 'efectivo' ? (totalBase - totalFinal) : 0,
            recargo_aplicado: metodo === 'credito' ? (totalFinal - totalBase) : 0,
            monto_recibido: montoRecibido,
            vuelto: montoRecibido ? (montoRecibido - totalFinal) : 0
        };

        // Guardar en ventas del día e histórico
        const ventasDelDia = JSON.parse(localStorage.getItem('ventasDelDia')) || [];
        ventasDelDia.push(venta);
        localStorage.setItem('ventasDelDia', JSON.stringify(ventasDelDia));

        this.guardarVentaEnHistorial(venta);

        // Actualizar stock (restar cantidades)
        this.actualizarStockProductos('restar', this.carrito);

        // Agregar ingreso neto a la caja
        this.agregarIngreso(totalNeto, `Venta #${venta.id}`, metodo, venta.id.toString());

        // Limpiar carrito y cerrar modal
        this.carrito = [];
        this.actualizarCarrito();
        this.cerrarModal('modal-procesar-pago');

        // Mostrar mensaje de éxito
        this.mostrarNotificacion(`✅ Venta #${venta.id} registrada. Total: $${totalFinal.toFixed(2)} (neto: $${totalNeto.toFixed(2)})`);

        // Preguntar si desea imprimir ticket
        if (confirm('¿Desea imprimir el ticket de venta?')) {
            this.imprimirTicket(venta);
        }

        console.log('Venta finalizada:', venta);
    }

    // ==================== IMPRESIÓN DE TICKET ====================
    imprimirTicket(venta) {
        // Crear contenido HTML para el ticket
        const fecha = new Date(venta.fecha);
        const fechaStr = fecha.toLocaleDateString('es-ES');
        const horaStr = fecha.toLocaleTimeString('es-ES');

        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Ticket de Venta #${venta.id}</title>
                <style>
                    body {
                        font-family: 'Courier New', monospace;
                        font-size: 12px;
                        margin: 0;
                        padding: 20px;
                        width: 300px;
                        margin: 0 auto;
                    }
                    .ticket {
                        border: 1px solid #000;
                        padding: 10px;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 10px;
                    }
                    .header h1 {
                        font-size: 16px;
                        margin: 0;
                    }
                    .header p {
                        margin: 2px 0;
                    }
                    .line {
                        border-top: 1px dashed #000;
                        margin: 8px 0;
                    }
                    .items {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    .items th, .items td {
                        text-align: left;
                        padding: 4px 0;
                    }
                    .items th {
                        border-bottom: 1px solid #000;
                    }
                    .total-line {
                        display: flex;
                        justify-content: space-between;
                        margin: 5px 0;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 10px;
                        font-size: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="header">
                        <h1>TIENDA DE PESCA</h1>
                        <p>Av. Principal #123</p>
                        <p>Tel: 555-1234</p>
                        <p>RUC: 123456789</p>
                        <div class="line"></div>
                        <p>Ticket: #${venta.id}</p>
                        <p>Fecha: ${fechaStr} ${horaStr}</p>
                        <p>Método: ${venta.metodo_pago.toUpperCase()}</p>
                    </div>
                    <div class="line"></div>
                    <table class="items">
                        <thead>
                            <tr><th>Cant</th><th>Producto</th><th>Precio</th><th>Subtotal</th></tr>
                        </thead>
                        <tbody>
        `;

        venta.productos.forEach(item => {
            html += `
                <tr>
                    <td>${item.cantidad}</td>
                    <td>${item.nombre}</td>
                    <td>$${item.precio.toFixed(2)}</td>
                    <td>$${item.subtotal.toFixed(2)}</td>
                </tr>
            `;
        });

        html += `
                        </tbody>
                    </table>
                    <div class="line"></div>
        `;

        if (venta.descuento_aplicado > 0) {
            html += `<div class="total-line"><span>Descuento:</span><span> -$${venta.descuento_aplicado.toFixed(2)}</span></div>`;
        }
        if (venta.recargo_aplicado > 0) {
            html += `<div class="total-line"><span>Recargo:</span><span> +$${venta.recargo_aplicado.toFixed(2)}</span></div>`;
        }
        html += `<div class="total-line"><strong>TOTAL:</strong><strong>$${venta.total.toFixed(2)}</strong></div>`;

        if (venta.comision_monto > 0) {
            html += `<div class="total-line"><span>Comisión (${venta.comision_porcentaje}%):</span><span> -$${venta.comision_monto.toFixed(2)}</span></div>`;
            html += `<div class="total-line"><span>Neto:</span><span>$${venta.total_neto.toFixed(2)}</span></div>`;
        }

        if (venta.monto_recibido) {
            html += `<div class="total-line"><span>Recibido:</span><span>$${venta.monto_recibido.toFixed(2)}</span></div>`;
            html += `<div class="total-line"><span>Vuelto:</span><span>$${venta.vuelto.toFixed(2)}</span></div>`;
        }

        html += `
                    <div class="line"></div>
                    <div class="footer">
                        <p>¡Gracias por su compra!</p>
                        <p>Visítenos nuevamente</p>
                    </div>
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() { window.close(); }, 500);
                    };
                </script>
            </body>
            </html>
        `;

        const ventanaTicket = window.open('', '_blank');
        if (ventanaTicket) {
            ventanaTicket.document.write(html);
            ventanaTicket.document.close();
            ventanaTicket.focus();
        } else {
            this.mostrarError('No se pudo abrir la ventana de impresión. Verifique que los bloqueadores de ventanas emergentes estén desactivados.');
        }
    }
}

// Inicializar la aplicación
let app;

function inicializarApp() {
    if (!app) {
        app = new PuntoVentaApp();
        window.app = app;
    }
    return app;
}

document.addEventListener('DOMContentLoaded', inicializarApp);

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(inicializarApp, 10);
}

setTimeout(inicializarApp, 100);