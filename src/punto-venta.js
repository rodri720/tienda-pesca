// punto-venta.js - Archivo SEPARADO para la lógica del punto de venta

class PuntoVentaApp {
    constructor() {
        this.productoActual = null;
        this.init();
    }

    async init() {
        console.log('🛒 Iniciando Punto de Venta...');
        
        // Verificar si la API está disponible
        if (typeof window.api === 'undefined') {
            console.error('❌ API de Electron NO disponible');
            this.mostrarErrorAPI();
            return;
        }
        
        console.log('✅ API disponible, funciones:', Object.keys(window.api));
        this.setupEventListeners();
        
        // Probar la conexión
        await this.probarConexion();
    }

    async probarConexion() {
        try {
            console.log('🔍 Probando conexión con la base de datos...');
            const productos = await window.api.getAllProducts();
            console.log(`✅ Conexión exitosa. ${productos.length} productos cargados`);
            
            // Mostrar SKUs disponibles en consola para debug
            const skus = productos.map(p => p.sku).filter(sku => sku);
            console.log('🏷️ SKUs disponibles:', skus);
            
        } catch (error) {
            console.error('❌ Error conectando a la base de datos:', error);
            this.mostrarError('Error de conexión: ' + error.message);
        }
    }

    mostrarErrorAPI() {
        const display = document.getElementById('product-display');
        display.innerHTML = `
            <div class="product-info">
                <i class="fas fa-exclamation-triangle" style="font-size: 4rem; color: #f6ad55; margin-bottom: 20px;"></i>
                <h3>Error de Conexión</h3>
                <p>No se puede conectar con la base de datos.</p>
                <p>Esta página debe abrirse desde la aplicación Electron.</p>
                <div style="margin-top: 20px;">
                    <button class="btn btn-primary" onclick="window.location.href='index.html'">
                        <i class="fas fa-home"></i> Volver al Dashboard
                    </button>
                </div>
            </div>
        `;
        display.classList.remove('empty');
    }

    setupEventListeners() {
        const skuInput = document.getElementById('sku-input');
        
        if (skuInput) {
            // Enfocar automáticamente
            skuInput.focus();
            
            // Buscar al presionar Enter
            skuInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.buscarPorSKU(skuInput.value.trim());
                }
            });
            
            // Buscar automáticamente (con debounce)
            let timeout;
            skuInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                const sku = e.target.value.trim();
                
                if (sku.length >= 3) {
                    timeout = setTimeout(() => {
                        this.buscarPorSKU(sku);
                    }, 300);
                }
            });
        }
        
        // Configurar botones de acción
        const actionButtons = document.querySelectorAll('.action-btn');
        actionButtons.forEach(btn => {
            const text = btn.querySelector('span').textContent;
            
            if (text === 'Limpiar') {
                btn.onclick = () => this.limpiarBusqueda();
            } else if (text === 'Dashboard') {
                btn.onclick = () => this.abrirDashboard();
            } else if (text === 'Escanear Código') {
                btn.onclick = () => this.buscarPorCodigoBarras();
            } else if (text === 'Recientes') {
                btn.onclick = () => this.mostrarProductosRecientes();
            }
        });
        
        // Configurar botón de vender
        const btnVender = document.getElementById('btn-vender');
        if (btnVender) {
            btnVender.onclick = () => {
                if (this.productoActual) {
                    this.registrarVenta(this.productoActual);
                }
            };
        }
        
        // Configurar botón de limpiar en action-buttons
        const btnLimpiar = document.querySelector('#action-buttons .btn-secondary');
        if (btnLimpiar) {
            btnLimpiar.onclick = () => this.limpiarBusqueda();
        }
    }

    async buscarPorSKU(sku) {
        if (!sku || sku.trim() === '') {
            return;
        }
        
        console.log(`🔍 Buscando SKU: "${sku}"`);
        
        const display = document.getElementById('product-display');
        display.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: #1a8c8a;"></i>
                <h3>Buscando producto...</h3>
                <p>SKU: <code style="background: #f7fafc; padding: 5px 10px; border-radius: 4px; font-weight: bold;">${sku}</code></p>
            </div>
        `;
        
        try {
            // Primero, obtener todos los productos para debug
            const todosProductos = await window.api.getAllProducts();
            console.log('📦 Total productos en BD:', todosProductos.length);
            
            // Mostrar todos los SKUs en consola
            todosProductos.forEach(p => {
                console.log(`  - ${p.sku || 'SIN SKU'}: ${p.nombre}`);
            });
            
            // Ahora buscar
            const resultados = await window.api.searchProducts(sku);
            console.log('🔎 Resultados de búsqueda:', resultados);
            
            if (!resultados || resultados.length === 0) {
                this.mostrarProductoNoEncontrado(sku);
                return;
            }
            
            // Buscar coincidencia exacta de SKU (case insensitive)
            let productoEncontrado = null;
            
            for (const producto of resultados) {
                if (producto.sku && producto.sku.toLowerCase() === sku.toLowerCase()) {
                    productoEncontrado = producto;
                    break;
                }
            }
            
            // Si no hay coincidencia exacta, tomar el primero
            if (!productoEncontrado && resultados.length > 0) {
                productoEncontrado = resultados[0];
                console.log('⚠️ No hay coincidencia exacta, tomando primer resultado');
            }
            
            if (!productoEncontrado) {
                this.mostrarProductoNoEncontrado(sku);
                return;
            }
            
            console.log('✅ Producto encontrado:', productoEncontrado);
            this.productoActual = productoEncontrado;
            this.mostrarProducto(productoEncontrado);
            
        } catch (error) {
            console.error('❌ Error buscando producto:', error);
            this.mostrarError('Error al buscar: ' + error.message);
        }
    }

    mostrarProducto(producto) {
        const display = document.getElementById('product-display');
        const actionButtons = document.getElementById('action-buttons');
        
        // Iconos por categoría
        const iconos = {
            'Anzuelos': 'anchor',
            'Cañas': 'fishing-rod',
            'Carretes': 'cog',
            'Líneas': 'stream',
            'Señuelos': 'fish',
            'Accesorios': 'tools',
            'Carnadas': 'bug',
            'Indumentaria': 'tshirt',
            'Equipamiento': 'campground'
        };
        
        const icono = iconos[producto.categoria] || 'box';
        const stock = producto.stock || 0;
        const stockMinimo = producto.stock_minimo || 5;
        
        // Estado del stock
        let stockClass = 'stock-normal';
        let stockText = `Stock: ${stock}`;
        
        if (stock === 0) {
            stockClass = 'stock-agotado';
            stockText = 'AGOTADO';
        } else if (stock <= stockMinimo) {
            stockClass = 'stock-bajo';
            stockText = `BAJO: ${stock}`;
        }
        
        display.innerHTML = `
            <div class="product-info">
                <div class="product-image">
                    <i class="fas fa-${icono}"></i>
                </div>
                
                <div class="product-details">
                    <h3>${producto.nombre || 'Sin nombre'}</h3>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <div>
                            <div style="font-size: 0.9rem; color: #718096; margin-bottom: 5px;">
                                ${producto.categoria || 'Sin categoría'} • ${producto.marca || 'Sin marca'}
                            </div>
                            <div style="font-size: 0.8rem; color: #4a5568; background: #f7fafc; padding: 5px 10px; border-radius: 4px;">
                                SKU: <strong>${producto.sku || 'N/A'}</strong>
                            </div>
                        </div>
                        <span class="stock-badge ${stockClass}">${stockText}</span>
                    </div>
                    
                    <div class="price-tag">
                        $${(producto.precio || 0).toFixed(2)}
                    </div>
                    
                    <div class="details-grid">
                        <div class="detail-item">
                            <strong>Stock Actual</strong>
                            <span>${stock} unidades</span>
                        </div>
                        <div class="detail-item">
                            <strong>Stock Mínimo</strong>
                            <span>${stockMinimo} unidades</span>
                        </div>
                        <div class="detail-item">
                            <strong>Costo</strong>
                            <span>$${(producto.costo || 0).toFixed(2)}</span>
                        </div>
                        <div class="detail-item">
                            <strong>Proveedor</strong>
                            <span>${producto.proveedor || 'No especificado'}</span>
                        </div>
                    </div>
                    
                    ${producto.descripcion ? `
                        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                            <strong>Descripción:</strong>
                            <p style="color: #4a5568; margin-top: 10px;">${producto.descripcion}</p>
                        </div>
                    ` : ''}
                    
                    <div style="margin-top: 20px; font-size: 0.9rem; color: #718096;">
                        <i class="fas fa-info-circle"></i> ID: ${producto.id}
                    </div>
                </div>
            </div>
        `;
        
        display.classList.remove('empty');
        if (actionButtons) {
            actionButtons.style.display = 'flex';
        }
    }

    mostrarProductoNoEncontrado(sku) {
        const display = document.getElementById('product-display');
        display.innerHTML = `
            <div class="product-info">
                <i class="fas fa-exclamation-triangle" style="font-size: 4rem; color: #f6ad55; margin-bottom: 20px;"></i>
                <h3>Producto no encontrado</h3>
                <p>No se encontró ningún producto con el SKU:</p>
                <p><code style="background: #f7fafc; padding: 5px 10px; border-radius: 4px; font-weight: bold;">${sku}</code></p>
                <p style="color: #718096; font-size: 0.9rem;">Verifica el SKU e intenta nuevamente.</p>
                <div style="margin-top: 20px;">
                    <button class="btn btn-secondary" onclick="window.puntoVentaApp.limpiarBusqueda()">
                        <i class="fas fa-redo"></i> Limpiar búsqueda
                    </button>
                </div>
            </div>
        `;
        display.classList.remove('empty');
    }

    mostrarError(mensaje) {
        const display = document.getElementById('product-display');
        display.innerHTML = `
            <div class="product-info">
                <i class="fas fa-exclamation-circle" style="font-size: 4rem; color: #f56565; margin-bottom: 20px;"></i>
                <h3>Error</h3>
                <p>${mensaje}</p>
                <div style="margin-top: 20px;">
                    <button class="btn btn-primary" onclick="window.location.href='index.html'">
                        <i class="fas fa-home"></i> Volver al Dashboard
                    </button>
                </div>
            </div>
        `;
    }

    limpiarBusqueda() {
        const display = document.getElementById('product-display');
        const actionButtons = document.getElementById('action-buttons');
        const skuInput = document.getElementById('sku-input');
        
        display.innerHTML = `
            <i class="fas fa-search"></i>
            <h3>Busque un producto por SKU</h3>
            <p>Ingrese el código SKU para mostrar los detalles del producto</p>
            <p style="font-size: 0.9rem; color: #718096; margin-top: 10px;">
                Ejemplo: ANZ-OWN001, CÑA-SHI002
            </p>
        `;
        
        display.classList.add('empty');
        if (actionButtons) {
            actionButtons.style.display = 'none';
        }
        if (skuInput) {
            skuInput.value = '';
            skuInput.focus();
        }
        this.productoActual = null;
    }

    async registrarVenta(producto) {
        if (!producto.stock || producto.stock === 0) {
            alert('⚠️ Producto agotado. No se puede registrar venta.');
            return;
        }
        
        try {
            const cantidad = prompt(
                `¿Cuántas unidades de "${producto.nombre}" desea vender?\n\n` +
                `Stock disponible: ${producto.stock}\n` +
                `Precio unitario: $${(producto.precio || 0).toFixed(2)}`,
                "1"
            );
            
            if (!cantidad) return;
            
            const unidades = parseInt(cantidad);
            if (isNaN(unidades) || unidades <= 0) {
                alert('⚠️ Cantidad inválida');
                return;
            }
            
            if (unidades > producto.stock) {
                alert(`⚠️ Stock insuficiente. Solo hay ${producto.stock} unidades disponibles.`);
                return;
            }
            
            const total = unidades * (producto.precio || 0);
            
            const confirmacion = confirm(
                `RESUMEN DE VENTA:\n\n` +
                `Producto: ${producto.nombre}\n` +
                `SKU: ${producto.sku}\n` +
                `Precio unitario: $${(producto.precio || 0).toFixed(2)}\n` +
                `Cantidad: ${unidades}\n` +
                `Total: $${total.toFixed(2)}\n\n` +
                `¿Confirmar venta?`
            );
            
            if (confirmacion) {
                // Actualizar stock en la base de datos
                await window.api.updateStock(producto.id, unidades, 'decrementar');
                
                // Actualizar producto localmente
                producto.stock -= unidades;
                
                alert(`✅ Venta registrada exitosamente!\nTotal: $${total.toFixed(2)}`);
                
                // Actualizar la vista
                this.mostrarProducto(producto);
            }
            
        } catch (error) {
            console.error('❌ Error registrando venta:', error);
            alert('Error al registrar la venta: ' + error.message);
        }
    }

    buscarPorCodigoBarras() {
        alert('Funcionalidad de escáner de código de barras - Por implementar');
    }

    mostrarProductosRecientes() {
        alert('Mostrar productos recientes - Por implementar');
    }

    abrirDashboard() {
        window.location.href = 'index.html';
    }
}

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM cargado, iniciando Punto de Venta...');
    window.puntoVentaApp = new PuntoVentaApp();
});