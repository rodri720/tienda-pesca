class TiendaPescaApp {
    constructor() {
        this.currentPage = 'dashboard';
        this.products = [];
        this.categories = [];
        this.stats = {};
        
        // Inicializar inmediatamente cuando se crea la instancia
        this.init();
    }

    async init() {
        // Verificar que la API está disponible
        if (!window.api) {
            this.showError("Error: API no disponible. Reinicia la aplicación.");
            return;
        }
        
        // Configurar eventos PRIMERO
        this.setupEventListeners();
        
        // Cargar datos iniciales
        await this.loadInitialData();
        
        // Mostrar dashboard
        this.showPage('dashboard');
    }

    async loadInitialData() {
        try {
            // Cargar productos
            this.products = await window.api.getAllProducts();
            
            // Cargar categorías
            this.categories = await window.api.getCategories();
            
            // Cargar estadísticas
            this.stats = await window.api.getStats();
            
            // Actualizar UI
            this.updateDashboard();
            this.updateRecentProducts();
            this.updateAlerts();
            
        } catch (error) {
            this.showError('No se pudieron cargar los datos iniciales');
        }
    }

    updateDashboard() {
        // Actualizar estadísticas
        const totalProductos = document.getElementById('total-productos');
        const totalStock = document.getElementById('total-stock');
        const stockBajo = document.getElementById('stock-bajo');
        const valorInventario = document.getElementById('valor-inventario');
        
        if (totalProductos) totalProductos.textContent = this.stats.total_productos || 0;
        if (totalStock) totalStock.textContent = this.stats.total_stock || 0;
        if (stockBajo) stockBajo.textContent = this.stats.bajo_stock || 0;
        
        // Formatear valor del inventario
        if (valorInventario) {
            const valor = this.stats.valor_inventario || 0;
            valorInventario.textContent = 
                `$${valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
    }

    updateRecentProducts() {
        const container = document.getElementById('recent-products');
        if (!container) return;
        
        // Tomar últimos 6 productos
        const recentProducts = this.products.slice(0, 6);
        
        if (recentProducts.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #718096;">
                    <i class="fas fa-box-open" style="font-size: 3rem; margin-bottom: 15px;"></i>
                    <p>No hay productos aún</p>
                    <button class="btn btn-primary" onclick="window.app.showPage('nuevo-producto')" style="margin-top: 15px;">
                        <i class="fas fa-plus"></i> Crear Primer Producto
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = recentProducts.map(product => `
            <div class="product-card" onclick="window.app.showProductDetails('${product.id}')">
                <div class="product-image">
                    <i class="fas fa-${this.getProductIcon(product.categoria)}" style="font-size: 3rem;"></i>
                </div>
                <div class="product-content">
                    <div class="product-title">${product.nombre}</div>
                    <div style="color: #718096; font-size: 0.9rem; margin-bottom: 10px;">
                        ${product.categoria} • ${product.marca || 'Sin marca'}
                    </div>
                    <div style="font-size: 0.8rem; color: #4a5568; margin-bottom: 15px;">
                        SKU: <strong>${product.sku || 'No asignado'}</strong>
                    </div>
                    <div class="product-meta">
                        <div class="product-price">
                            $${product.precio ? product.precio.toFixed(2) : '0.00'}
                        </div>
                        <span class="stock-badge ${this.getStockClass(product.stock, product.stock_minimo)}">
                            ${this.getStockText(product.stock, product.stock_minimo)}
                        </span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    updateAlerts() {
        const container = document.getElementById('alerts-container');
        if (!container) return;
        
        const alerts = [];
        
        // Verificar stock bajo
        const lowStockProducts = this.products.filter(p => 
            p.stock > 0 && p.stock <= p.stock_minimo
        );
        
        if (lowStockProducts.length > 0) {
            alerts.push(`
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    <div>
                        <strong>Stock Bajo</strong>
                        <p>${lowStockProducts.length} producto(s) tienen stock por debajo del mínimo</p>
                    </div>
                    <button class="btn btn-secondary" onclick="window.app.showPage('stock')">
                        Ver
                    </button>
                </div>
            `);
        }
        
        // Verificar productos agotados
        const outOfStockProducts = this.products.filter(p => p.stock === 0);
        
        if (outOfStockProducts.length > 0) {
            alerts.push(`
                <div class="alert alert-danger">
                    <i class="fas fa-times-circle"></i>
                    <div>
                        <strong>Productos Agotados</strong>
                        <p>${outOfStockProducts.length} producto(s) están completamente agotados</p>
                    </div>
                    <button class="btn btn-secondary" onclick="window.app.showPage('stock')">
                        Ver
                    </button>
                </div>
            `);
        }
        
        // Si no hay alertas
        if (alerts.length === 0) {
            alerts.push(`
                <div style="text-align: center; padding: 20px; color: #718096;">
                    <i class="fas fa-check-circle" style="font-size: 2rem; margin-bottom: 10px; color: #48bb78;"></i>
                    <p>No hay alertas en este momento</p>
                </div>
            `);
        }
        
        container.innerHTML = alerts.join('');
        
        // Actualizar contador de notificaciones
        const notificationCount = document.getElementById('notification-count');
        if (notificationCount) {
            const totalAlerts = lowStockProducts.length + outOfStockProducts.length;
            notificationCount.textContent = totalAlerts;
            notificationCount.style.display = totalAlerts > 0 ? 'block' : 'none';
        }
    }

    getProductIcon(category) {
        const icons = {
            // Pesca
            'Anzuelos': 'anchor',
            'Cañas': 'fishing-rod',
            'Carretes': 'cog',
            'Líneas': 'stream',
            'Señuelos': 'fish',
            'Accesorios': 'tools',
            'Carnadas': 'bug',
            'Indumentaria': 'tshirt',
            'Equipamiento': 'campground',
            'Plomos': 'PLO',
            'Reels': 'REL',
            'Boyas': 'BOY',
            // Camping
            'Carpas': 'tent',
            'Bolsas de dormir': 'bed',
            'Colchonetas': 'bed', // Reemplazo
            'Mochilas': 'backpack',
            'Linternas': 'flashlight',
            'Cocinas': 'fire', // Reemplazo
            'Utensilios': 'utensils',
            'Termos': 'flask',
            'Sillas': 'chair',
            'Mesas': 'table'
        };
        return icons[category] || 'box';
    }

    getStockClass(stock, minStock) {
        if (stock === 0) return 'stock-agotado';
        if (stock <= minStock) return 'stock-bajo';
        return 'stock-normal';
    }

    getStockText(stock, minStock) {
        if (stock === 0) return 'Agotado';
        if (stock <= minStock) return `Bajo (${stock})`;
        return `Stock: ${stock}`;
    }

    showPage(pageName) {
        // Ocultar todas las páginas
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        
        // Actualizar menú activo
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Mostrar página solicitada
        const pageElement = document.getElementById(`${pageName}-page`);
        if (pageElement) {
            pageElement.classList.add('active');
            
            // Actualizar menú
            const menuItem = document.querySelector(`[data-page="${pageName}"]`);
            if (menuItem) {
                menuItem.classList.add('active');
            }
            
            this.currentPage = pageName;
            
            // Cargar contenido específico de la página
            this.loadPageContent(pageName);
        }
    }

    async loadPageContent(pageName) {
        switch(pageName) {
            case 'dashboard':
                await this.loadInitialData();
                break;
                
            case 'productos':
                await this.loadProductsPage();
                break;
                
            case 'nuevo-producto':
                await this.loadNewProductPage();
                break;
                
            case 'stock':
                await this.loadStockPage();
                break;
        }
    }

    async loadProductsPage() {
        const container = document.getElementById('productos-container');
        if (!container) return;
        
        // Mostrar loading
        container.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <i class="fas fa-spinner fa-spin fa-2x" style="color: #1a8c8a;"></i>
                <p>Cargando productos...</p>
            </div>
        `;
        
        try {
            // Recargar productos
            this.products = await window.api.getAllProducts();
            
            // Renderizar tabla
            container.innerHTML = `
                <div style="background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                    <div style="padding: 20px; border-bottom: 1px solid #e2e8f0;">
                        <h3 style="color: #1a8c8a; margin: 0;">
                            <i class="fas fa-boxes"></i> Lista de Productos (${this.products.length})
                        </h3>
                    </div>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f7fafc; border-bottom: 2px solid #e2e8f0;">
                                <th style="padding: 15px; text-align: left;">Producto</th>
                                <th style="padding: 15px; text-align: left;">Categoría</th>
                                <th style="padding: 15px; text-align: left;">SKU</th>
                                <th style="padding: 15px; text-align: left;">Precio</th>
                                <th style="padding: 15px; text-align: left;">Stock</th>
                                <th style="padding: 15px; text-align: left;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="products-table-body">
                            <!-- Rows will be inserted here -->
                        </tbody>
                    </table>
                </div>
            `;
            
            // Llenar tabla
            const tbody = document.getElementById('products-table-body');
            if (this.products.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="padding: 40px; text-align: center; color: #718096;">
                            <i class="fas fa-box-open" style="font-size: 2rem; margin-bottom: 10px;"></i>
                            <p>No hay productos registrados</p>
                            <button class="btn btn-primary" onclick="window.app.showPage('nuevo-producto')" style="margin-top: 15px;">
                                <i class="fas fa-plus"></i> Crear Primer Producto
                            </button>
                        </td>
                    </tr>
                `;
            } else {
                tbody.innerHTML = this.products.map(product => `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 15px;">
                            <div style="font-weight: 600;">${product.nombre}</div>
                            <small style="color: #718096;">${product.marca || 'Sin marca'}</small>
                        </td>
                        <td style="padding: 15px;">
                            <span class="stock-badge stock-normal" style="background: #e2e8f0; color: #4a5568;">
                                ${product.categoria}
                            </span>
                        </td>
                        <td style="padding: 15px; font-family: monospace; font-weight: 600; color: #1a8c8a;">
                            ${product.sku || 'N/A'}
                        </td>
                        <td style="padding: 15px; font-weight: 600;">
                            $${product.precio ? product.precio.toFixed(2) : '0.00'}
                        </td>
                        <td style="padding: 15px;">
                            <span class="stock-badge ${this.getStockClass(product.stock, product.stock_minimo)}">
                                ${this.getStockText(product.stock, product.stock_minimo)}
                            </span>
                        </td>
                        <td style="padding: 15px;">
                            <button class="btn btn-secondary" onclick="window.app.showProductDetails('${product.id}')" 
                                    style="padding: 5px 10px; font-size: 0.9rem; margin-right: 5px;">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-secondary" onclick="window.app.editProduct('${product.id}')" 
                                    style="padding: 5px 10px; font-size: 0.9rem; margin-right: 5px;">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-secondary" onclick="window.app.confirmDeleteProduct('${product.id}', '${product.nombre}')" 
                                    style="padding: 5px 10px; font-size: 0.9rem; background: #f56565; color: white;">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');
            }
            
        } catch (error) {
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle"></i>
                    Error cargando los productos. Intenta nuevamente.
                </div>
            `;
        }
    }

    // ============ BÚSQUEDA EN TIEMPO REAL ============

    async searchProducts(query) {
        try {
            if (!query || query.trim() === '') {
                // Si la búsqueda está vacía, mostrar todos los productos
                if (this.currentPage === 'productos') {
                    await this.loadProductsPage();
                }
                return;
            }
            
            // Realizar búsqueda en la base de datos
            const resultados = await window.api.searchProducts(query);
            
            // Si estamos en la página de productos, actualizar la tabla
            if (this.currentPage === 'productos') {
                const container = document.getElementById('productos-container');
                if (!container) return;
                
                if (resultados.length === 0) {
                    container.innerHTML = `
                        <div style="background: white; border-radius: 15px; padding: 40px; text-align: center;">
                            <i class="fas fa-search" style="font-size: 3rem; color: #a0aec0; margin-bottom: 20px;"></i>
                            <h3 style="color: #4a5568; margin-bottom: 10px;">No se encontraron resultados</h3>
                            <p style="color: #718096;">No hay productos que coincidan con: <strong>"${query}"</strong></p>
                            <button class="btn btn-secondary" onclick="window.app.loadProductsPage()" style="margin-top: 20px;">
                                <i class="fas fa-undo"></i> Volver a todos los productos
                            </button>
                        </div>
                    `;
                    return;
                }
                
                // Mostrar resultados de búsqueda
                container.innerHTML = `
                    <div style="background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                        <div style="padding: 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h3 style="color: #1a8c8a; margin: 0;">
                                    <i class="fas fa-search"></i> Resultados de búsqueda
                                </h3>
                                <p style="color: #718096; margin: 5px 0 0 0;">
                                    ${resultados.length} producto(s) encontrados para: <strong>"${query}"</strong>
                                </p>
                            </div>
                            <button class="btn btn-secondary" onclick="window.app.loadProductsPage()">
                                <i class="fas fa-times"></i> Limpiar búsqueda
                            </button>
                        </div>
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #f7fafc; border-bottom: 2px solid #e2e8f0;">
                                    <th style="padding: 15px; text-align: left;">Producto</th>
                                    <th style="padding: 15px; text-align: left;">Categoría</th>
                                    <th style="padding: 15px; text-align: left;">SKU</th>
                                    <th style="padding: 15px; text-align: left;">Precio</th>
                                    <th style="padding: 15px; text-align: left;">Stock</th>
                                    <th style="padding: 15px; text-align: left;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="search-results-body">
                                <!-- Search results will be inserted here -->
                            </tbody>
                        </table>
                    </div>
                `;
                
                // Llenar tabla con resultados
                const tbody = document.getElementById('search-results-body');
                tbody.innerHTML = resultados.map(product => `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 15px;">
                            <div style="font-weight: 600;">${product.nombre}</div>
                            <small style="color: #718096;">${product.marca || 'Sin marca'}</small>
                        </td>
                        <td style="padding: 15px;">
                            <span class="stock-badge stock-normal" style="background: #e2e8f0; color: #4a5568;">
                                ${product.categoria}
                            </span>
                        </td>
                        <td style="padding: 15px; font-family: monospace; font-weight: 600; color: #1a8c8a;">
                            ${product.sku || 'N/A'}
                        </td>
                        <td style="padding: 15px; font-weight: 600;">
                            $${product.precio ? product.precio.toFixed(2) : '0.00'}
                        </td>
                        <td style="padding: 15px;">
                            <span class="stock-badge ${this.getStockClass(product.stock, product.stock_minimo)}">
                                ${this.getStockText(product.stock, product.stock_minimo)}
                            </span>
                        </td>
                        <td style="padding: 15px;">
                            <button class="btn btn-secondary" onclick="window.app.showProductDetails('${product.id}')" 
                                    style="padding: 5px 10px; font-size: 0.9rem; margin-right: 5px;">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-secondary" onclick="window.app.editProduct('${product.id}')" 
                                    style="padding: 5px 10px; font-size: 0.9rem; margin-right: 5px;">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-secondary" onclick="window.app.confirmDeleteProduct('${product.id}', '${product.nombre}')" 
                                    style="padding: 5px 10px; font-size: 0.9rem; background: #f56565; color: white;">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');
            }
            
        } catch (error) {
            this.showError('Error al buscar productos');
        }
    }

    // ============ DETALLES DEL PRODUCTO ============

    async showProductDetails(productId) {
        try {
            const product = await window.api.getProductById(productId);
            if (!product) {
                this.showError('Producto no encontrado');
                return;
            }
            
            // Mostrar modal con detalles
            const modal = document.getElementById('product-modal');
            const modalBody = document.getElementById('modal-body');
            
            modalBody.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 30px;">
                    <div>
                        <div style="height: 200px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: #f8f9fa; overflow: hidden;">
                            <i class="fas fa-${this.getProductIcon(product.categoria)}" style="font-size: 4rem; color: #1a8c8a;"></i>
                        </div>
                    </div>
                    <div>
                        <h3 style="margin-bottom: 10px;">${product.nombre}</h3>
                        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                            <span class="stock-badge ${this.getStockClass(product.stock, product.stock_minimo)}">
                                ${this.getStockText(product.stock, product.stock_minimo)}
                            </span>
                            <span class="stock-badge stock-normal" style="background: #e2e8f0; color: #4a5568;">
                                ${product.categoria}
                            </span>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <div style="font-size: 2rem; font-weight: bold; color: #1a8c8a;">
                                $${product.precio ? product.precio.toFixed(2) : '0.00'}
                            </div>
                            <small style="color: #718096;">Precio de venta</small>
                        </div>
                        
                        <div style="background: #f7fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <h4 style="margin-bottom: 10px;">Información del Producto</h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <div>
                                    <strong>SKU:</strong><br>
                                    <code style="font-size: 1.1rem; color: #1a8c8a;">${product.sku || 'No asignado'}</code>
                                </div>
                                <div>
                                    <strong>Marca:</strong><br>
                                    ${product.marca || 'No especificada'}
                                </div>
                                <div>
                                    <strong>Stock Mínimo:</strong><br>
                                    ${product.stock_minimo || 5} unidades
                                </div>
                                <div>
                                    <strong>Costo:</strong><br>
                                    $${product.costo ? product.costo.toFixed(2) : '0.00'}
                                </div>
                                <div>
                                    <strong>Stock Actual:</strong><br>
                                    ${product.stock || 0} unidades
                                </div>
                                <div>
                                    <strong>Fecha Creación:</strong><br>
                                    ${new Date(product.fecha_creacion).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                        
                        ${product.descripcion ? `
                            <div style="margin-bottom: 20px;">
                                <h4>Descripción</h4>
                                <p style="color: #4a5568;">${product.descripcion}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: 30px; justify-content: flex-end;">
                    <button class="btn btn-secondary" onclick="window.app.closeModal()">
                        Cerrar
                    </button>
                    <button class="btn btn-primary" onclick="window.app.editProduct('${product.id}')">
                        <i class="fas fa-edit"></i> Editar Producto
                    </button>
                </div>
            `;
            
            modal.classList.add('active');
            
        } catch (error) {
            this.showError('Error al cargar los detalles del producto');
        }
    }

    // ============ EDITAR PRODUCTO ============

    async editProduct(productId) {
        try {
            const product = await window.api.getProductById(productId);
            if (!product) {
                this.showError('Producto no encontrado');
                return;
            }
            
            // Cargar categorías
            this.categories = await window.api.getCategories();
            
            // Cerrar modal si está abierto
            this.closeModal();
            
            // Crear formulario de edición
            const container = document.getElementById('nuevo-producto-page');
            if (!container) return;
            
            container.innerHTML = `
                <div style="max-width: 800px; margin: 0 auto;">
                    <div style="background: white; border-radius: 15px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                        <h2 style="color: #1a8c8a; margin-bottom: 30px; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-edit"></i> Editar Producto
                        </h2>
                        
                        <form id="edit-product-form" data-product-id="${productId}">
                            <!-- Sección de SKU (solo lectura) -->
                            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 25px; border-left: 4px solid #1a8c8a;">
                                <h3 style="color: #1a8c8a; margin-bottom: 15px;">
                                    <i class="fas fa-barcode"></i> Código SKU
                                </h3>
                                <div class="form-group">
                                    <label class="form-label">SKU (No editable)</label>
                                    <input type="text" class="form-control" id="edit-product-sku" readonly 
                                           style="background: #e9ecef; font-weight: bold; font-family: monospace; font-size: 1.1rem;"
                                           value="${product.sku || ''}">
                                    <small style="color: #6c757d; display: block; margin-top: 5px;">
                                        El SKU no puede modificarse una vez asignado
                                    </small>
                                </div>
                            </div>
                            
                            <!-- Información Básica -->
                            <div class="form-group">
                                <label class="form-label">Nombre del Producto *</label>
                                <input type="text" class="form-control" id="edit-product-name" required 
                                       value="${product.nombre || ''}"
                                       placeholder="Ej: Anzuelo Triple Premium #4">
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                                <div class="form-group">
                                    <label class="form-label">Categoría *</label>
                                    <select class="form-control" id="edit-product-category" required>
                                        <option value="">Seleccionar categoría...</option>
                                        ${this.categories.map(cat => `
                                            <option value="${cat.nombre}" ${cat.nombre === product.categoria ? 'selected' : ''}>
                                                ${cat.nombre}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">Marca</label>
                                    <input type="text" class="form-control" id="edit-product-brand" 
                                           value="${product.marca || ''}"
                                           placeholder="Ej: Owner, Daiwa, Shimano">
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                                <div class="form-group">
                                    <label class="form-label">Precio de Venta ($) *</label>
                                    <input type="number" class="form-control" id="edit-product-price" required 
                                           min="0" step="0.01" value="${product.precio || 0}"
                                           placeholder="0.00">
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">Costo ($)</label>
                                    <input type="number" class="form-control" id="edit-product-cost" 
                                           min="0" step="0.01" value="${product.costo || 0}"
                                           placeholder="0.00">
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                                <div class="form-group">
                                    <label class="form-label">Stock Actual</label>
                                    <input type="number" class="form-control" id="edit-product-stock" 
                                           min="0" value="${product.stock || 0}">
                                    <small style="color: #6c757d;">Para modificar stock, usa "Control Stock"</small>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">Stock Mínimo *</label>
                                    <input type="number" class="form-control" id="edit-product-min-stock" 
                                           min="1" value="${product.stock_minimo || 5}" required>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">Proveedor</label>
                                <input type="text" class="form-control" id="edit-product-supplier" 
                                       value="${product.proveedor || ''}"
                                       placeholder="Nombre del proveedor">
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">Descripción</label>
                                <textarea class="form-control" id="edit-product-description" rows="3" 
                                          placeholder="Describe el producto...">${product.descripcion || ''}</textarea>
                            </div>
                            
                            <div style="display: flex; gap: 15px; margin-top: 30px;">
                                <button type="button" class="btn btn-secondary" onclick="window.app.showPage('productos')">
                                    <i class="fas fa-times"></i> Cancelar
                                </button>
                                <button type="submit" class="btn btn-primary" id="btn-actualizar">
                                    <i class="fas fa-save"></i> Actualizar Producto
                                </button>
                                <button type="button" class="btn btn-danger" onclick="window.app.confirmDeleteProduct('${productId}', '${product.nombre}')">
                                    <i class="fas fa-trash"></i> Eliminar Producto
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            
            // Configurar eventos del formulario de edición
            this.setupEditProductForm(productId);
            
            // Mostrar la página de edición
            this.showPage('nuevo-producto');
            
        } catch (error) {
            this.showError('Error al cargar el formulario de edición');
        }
    }

    setupEditProductForm(productId) {
        const form = document.getElementById('edit-product-form');
        if (!form) return;
        
        // Evento submit del formulario
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.updateProduct(productId);
        });
    }

    async updateProduct(productId) {
        try {
            // Obtener valores del formulario
            const producto = {
                nombre: document.getElementById('edit-product-name').value,
                categoria: document.getElementById('edit-product-category').value,
                marca: document.getElementById('edit-product-brand').value,
                precio: parseFloat(document.getElementById('edit-product-price').value) || 0,
                costo: parseFloat(document.getElementById('edit-product-cost').value) || 0,
                stock: parseInt(document.getElementById('edit-product-stock').value) || 0,
                stock_minimo: parseInt(document.getElementById('edit-product-min-stock').value) || 5,
                proveedor: document.getElementById('edit-product-supplier').value,
                descripcion: document.getElementById('edit-product-description').value
            };
            
            // Validaciones
            if (!producto.nombre || !producto.categoria || !producto.precio) {
                this.showError('Completa los campos obligatorios (*)');
                return;
            }
            
            if (!producto.stock_minimo || producto.stock_minimo < 1) {
                this.showError('El stock mínimo debe ser al menos 1');
                return;
            }
            
            // Mostrar loading
            const submitBtn = document.getElementById('btn-actualizar');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
            submitBtn.disabled = true;
            
            // Actualizar en base de datos
            await window.api.updateProduct(productId, producto);
            
            // Mostrar éxito
            this.showSuccess(`
                <div style="text-align: center;">
                    <i class="fas fa-check-circle" style="font-size: 2rem; color: #48bb78; margin-bottom: 10px;"></i>
                    <p><strong>¡Producto actualizado exitosamente!</strong></p>
                </div>
            `);
            
            // Volver a la lista de productos después de 2 segundos
            setTimeout(() => {
                this.showPage('productos');
                this.loadInitialData();
            }, 2000);
            
        } catch (error) {
            this.showError('Error al actualizar el producto');
        } finally {
            // Restaurar botón
            const submitBtn = document.getElementById('btn-actualizar');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Actualizar Producto';
                submitBtn.disabled = false;
            }
        }
    }

    // ============ ELIMINAR PRODUCTO ============

    async confirmDeleteProduct(productId, productName) {
        const confirmed = confirm(`¿Estás seguro de eliminar el producto "${productName}"?\n\nEsta acción no se puede deshacer.`);
        
        if (confirmed) {
            await this.deleteProduct(productId);
        }
    }

    async deleteProduct(productId) {
        try {
            // Mostrar loading
            this.showSuccess('<i class="fas fa-spinner fa-spin"></i> Eliminando producto...');
            
            // Eliminar de la base de datos
            await window.api.deleteProduct(productId);
            
            // Mostrar éxito
            this.showSuccess(`
                <div style="text-align: center;">
                    <i class="fas fa-check-circle" style="font-size: 2rem; color: #48bb78; margin-bottom: 10px;"></i>
                    <p><strong>¡Producto eliminado exitosamente!</strong></p>
                </div>
            `);
            
            // Recargar datos
            await this.loadInitialData();
            
            // Si estamos en la página de productos, recargarla
            if (this.currentPage === 'productos') {
                await this.loadProductsPage();
            }
            
            // Cerrar modal si está abierto
            this.closeModal();
            
        } catch (error) {
            this.showError('Error al eliminar el producto');
        }
    }

    // ============ NUEVO PRODUCTO ============

    async loadNewProductPage() {
        const container = document.getElementById('nuevo-producto-page');
        if (!container) return;
        
        try {
            // Obtener categorías
            this.categories = await window.api.getCategories();
            
            container.innerHTML = `
                <div style="max-width: 800px; margin: 0 auto;">
                    <div style="background: white; border-radius: 15px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                        <h2 style="color: #1a8c8a; margin-bottom: 30px; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-plus-circle"></i> Agregar Nuevo Producto
                        </h2>
                        
                        <form id="new-product-form">
                            <!-- Sección de SKU -->
                            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 25px; border-left: 4px solid #1a8c8a;">
                                <h3 style="color: #1a8c8a; margin-bottom: 15px;">
                                    <i class="fas fa-barcode"></i> Código SKU
                                </h3>
                                <div class="form-group">
                                    <label class="form-label">SKU Automático</label>
                                    <div style="display: flex; gap: 10px;">
                                        <input type="text" class="form-control" id="product-sku" readonly 
                                               style="flex: 1; background: #e9ecef; font-weight: bold; font-family: monospace; font-size: 1.1rem;"
                                               placeholder="Se generará automáticamente">
                                        <button type="button" class="btn btn-secondary" id="btn-generar-sku" 
                                                style="white-space: nowrap;">
                                            <i class="fas fa-sync-alt"></i> Generar
                                        </button>
                                    </div>
                                    <small style="color: #6c757d; display: block; margin-top: 5px;">
                                        El SKU se genera automáticamente cuando seleccionas categoría y marca
                                    </small>
                                </div>
                            </div>
                            
                            <!-- Información Básica -->
                            <div class="form-group">
                                <label class="form-label">Nombre del Producto *</label>
                                <input type="text" class="form-control" id="product-name" required 
                                       placeholder="Ej: Anzuelo Triple Premium #4">
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                                <div class="form-group">
                                    <label class="form-label">Categoría *</label>
                                    <select class="form-control" id="product-category" required>
                                        <option value="">Seleccionar categoría...</option>
                                        ${this.categories.map(cat => `
                                            <option value="${cat.nombre}">${cat.nombre}</option>
                                        `).join('')}
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">Marca</label>
                                    <input type="text" class="form-control" id="product-brand" 
                                           placeholder="Ej: Owner, Daiwa, Shimano">
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                                <div class="form-group">
                                    <label class="form-label">Precio de Venta ($) *</label>
                                    <input type="number" class="form-control" id="product-price" required 
                                           min="0" step="0.01" placeholder="0.00">
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">Costo ($)</label>
                                    <input type="number" class="form-control" id="product-cost" 
                                           min="0" step="0.01" placeholder="0.00">
                                    <small style="color: #6c757d;">Dejar vacío para calcular automáticamente (60% del precio)</small>
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                                <div class="form-group">
                                    <label class="form-label">Stock Inicial</label>
                                    <input type="number" class="form-control" id="product-stock" min="0" value="0">
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">Stock Mínimo *</label>
                                    <input type="number" class="form-control" id="product-min-stock" min="1" value="5" required>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">Proveedor</label>
                                <input type="text" class="form-control" id="product-supplier" 
                                       placeholder="Nombre del proveedor">
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">Descripción</label>
                                <textarea class="form-control" id="product-description" rows="3" 
                                          placeholder="Describe el producto..."></textarea>
                            </div>
                            
                            <div style="display: flex; gap: 15px; margin-top: 30px;">
                                <button type="button" class="btn btn-secondary" id="btn-cancelar">
                                    <i class="fas fa-times"></i> Cancelar
                                </button>
                                <button type="submit" class="btn btn-primary" id="btn-guardar">
                                    <i class="fas fa-save"></i> Guardar Producto
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            
            // Configurar eventos del formulario
            this.setupNewProductForm();
            
        } catch (error) {
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    Error cargando el formulario. Intenta nuevamente.
                </div>
            `;
        }
    }

    setupNewProductForm() {
        const form = document.getElementById('new-product-form');
        if (!form) return;
        
        // Evento submit del formulario
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveNewProduct();
        });
        
        // Botón cancelar
        const btnCancelar = document.getElementById('btn-cancelar');
        if (btnCancelar) {
            btnCancelar.addEventListener('click', (e) => {
                e.preventDefault();
                this.showPage('dashboard');
            });
        }
        
        // Configurar eventos para SKU
        const categoriaSelect = document.getElementById('product-category');
        const marcaInput = document.getElementById('product-brand');
        const btnGenerarSKU = document.getElementById('btn-generar-sku');
        
        if (categoriaSelect) {
            categoriaSelect.addEventListener('change', async () => {
                await this.updateSKUPreview();
            });
        }
        
        if (marcaInput) {
            marcaInput.addEventListener('input', async () => {
                await this.updateSKUPreview();
            });
        }
        
        if (btnGenerarSKU) {
            btnGenerarSKU.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.updateSKUPreview();
            });
        }
        
        // Calcular costo automático
        const precioInput = document.getElementById('product-price');
        const costoInput = document.getElementById('product-cost');
        
        if (precioInput && costoInput) {
            precioInput.addEventListener('input', (e) => {
                const precio = parseFloat(e.target.value) || 0;
                
                // Solo calcular si el campo de costo está vacío o es 0
                if (!costoInput.value || parseFloat(costoInput.value) === 0) {
                    const costoCalculado = precio * 0.6;
                    costoInput.value = costoCalculado.toFixed(2);
                }
            });
        }
    }

    async updateSKUPreview() {
        try {
            const categoriaSelect = document.getElementById('product-category');
            const marcaInput = document.getElementById('product-brand');
            
            const categoria = categoriaSelect.value;
            const marca = marcaInput ? marcaInput.value.trim() : '';
            
            if (!categoria) {
                const skuInput = document.getElementById('product-sku');
                if (skuInput) {
                    skuInput.value = 'Selecciona categoría primero';
                    skuInput.style.color = '#f56565';
                }
                return;
            }
            
            // Mostrar "Generando..." mientras se procesa
            const skuInput = document.getElementById('product-sku');
            if (skuInput) {
                skuInput.value = 'Generando...';
                skuInput.style.color = '#f6ad55';
            }
            
            const sku = await window.api.getNextSKU(categoria, marca);
            
            if (sku && skuInput) {
                skuInput.value = sku;
                skuInput.style.color = '#1a8c8a';
            }
            
        } catch (error) {
            const skuInput = document.getElementById('product-sku');
            if (skuInput) {
                skuInput.value = 'Error generando SKU';
                skuInput.style.color = '#f56565';
            }
        }
    }

    async saveNewProduct() {
        try {
            // Obtener valores del formulario
            const producto = {
                nombre: document.getElementById('product-name').value,
                sku: document.getElementById('product-sku').value,
                categoria: document.getElementById('product-category').value,
                marca: document.getElementById('product-brand').value,
                precio: parseFloat(document.getElementById('product-price').value) || 0,
                costo: parseFloat(document.getElementById('product-cost').value) || null,
                stock: parseInt(document.getElementById('product-stock').value) || 0,
                stock_minimo: parseInt(document.getElementById('product-min-stock').value) || 5,
                proveedor: document.getElementById('product-supplier').value,
                descripcion: document.getElementById('product-description').value
            };
            
            // Validaciones
            if (!producto.nombre || !producto.categoria || !producto.precio) {
                this.showError('Completa los campos obligatorios (*)');
                return;
            }
            
            if (!producto.sku || producto.sku === 'Generando...' || producto.sku === 'Selecciona categoría primero') {
                this.showError('Primero genera un SKU para el producto');
                return;
            }
            
            // Mostrar loading
            const submitBtn = document.getElementById('btn-guardar');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
            submitBtn.disabled = true;
            
            // Guardar en base de datos
            const savedProduct = await window.api.createProduct(producto);
            
            // Mostrar éxito
            this.showSuccess(`
                <div style="text-align: center;">
                    <i class="fas fa-check-circle" style="font-size: 2rem; color: #48bb78; margin-bottom: 10px;"></i>
                    <p><strong>¡Producto creado exitosamente!</strong></p>
                    <p>SKU: <strong>${savedProduct.sku}</strong></p>
                </div>
            `);
            
            // Resetear formulario
            document.getElementById('new-product-form').reset();
            
            // Volver al dashboard después de 3 segundos
            setTimeout(() => {
                this.showPage('dashboard');
                this.loadInitialData();
            }, 3000);
            
        } catch (error) {
            this.showError('Error al guardar el producto');
        } finally {
            // Restaurar botón
            const submitBtn = document.getElementById('btn-guardar');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Producto';
                submitBtn.disabled = false;
            }
        }
    }

    // ============ EVENT LISTENERS ============

    setupEventListeners() {
        // Navegación del sidebar
        document.querySelectorAll('.nav-item[data-page]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.showPage(page);
            });
        });
        
        // Botón para abrir Punto de Venta
        const btnAbrirPuntoVenta = document.getElementById('btn-abrir-punto-venta');
        if (btnAbrirPuntoVenta) {
            btnAbrirPuntoVenta.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    await window.api.openPuntoVenta();
                } catch (error) {
                    this.showError('No se pudo abrir el punto de venta');
                }
            });
        }
        
        // Botones del dashboard
        const btnNuevo = document.getElementById('btn-nuevo-producto');
        if (btnNuevo) {
            btnNuevo.addEventListener('click', (e) => {
                e.preventDefault();
                this.showPage('nuevo-producto');
            });
        }
        
        const btnStock = document.getElementById('btn-ver-stock');
        if (btnStock) {
            btnStock.addEventListener('click', () => {
                this.showPage('stock');
            });
        }
        
        const btnRefreshDashboard = document.getElementById('btn-refresh-dashboard');
        if (btnRefreshDashboard) {
            btnRefreshDashboard.addEventListener('click', () => {
                this.loadInitialData();
                this.showSuccess('Dashboard actualizado');
            });
        }
        
        const btnRefreshGlobal = document.getElementById('btn-refresh-global');
        if (btnRefreshGlobal) {
            btnRefreshGlobal.addEventListener('click', () => {
                this.loadInitialData();
                this.showSuccess('Datos actualizados');
            });
        }
        
        const btnVerTodos = document.getElementById('btn-ver-todos');
        if (btnVerTodos) {
            btnVerTodos.addEventListener('click', () => {
                this.showPage('productos');
            });
        }
        
        // Botón en página de productos
        const btnAddProduct = document.getElementById('btn-add-product');
        if (btnAddProduct) {
            btnAddProduct.addEventListener('click', () => {
                this.showPage('nuevo-producto');
            });
        }
        
        // Cerrar modal
        const closeModalBtn = document.getElementById('close-modal');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }
        
        // Buscar productos
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchProducts(e.target.value);
            });
        }
    }

    closeModal() {
        document.getElementById('product-modal').classList.remove('active');
    }

    async loadStockPage() {
        const container = document.getElementById('stock-page');
        if (!container) return;
        
        try {
            // Obtener productos con stock bajo
            const lowStockProducts = await window.api.getLowStock();
            
            container.innerHTML = `
                <div style="background: white; border-radius: 15px; padding: 30px;">
                    <h3 style="color: #1a8c8a; margin-bottom: 20px;">
                        <i class="fas fa-warehouse"></i> Control de Stock
                    </h3>
                    
                    ${lowStockProducts.length === 0 ? `
                        <div style="text-align: center; padding: 40px; color: #718096;">
                            <i class="fas fa-check-circle" style="font-size: 3rem; color: #48bb78; margin-bottom: 20px;"></i>
                            <p>No hay productos con stock bajo</p>
                        </div>
                    ` : `
                        <div style="overflow-x: auto;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr style="background: #f7fafc; border-bottom: 2px solid #e2e8f0;">
                                        <th style="padding: 15px; text-align: left;">Producto</th>
                                        <th style="padding: 15px; text-align: left;">SKU</th>
                                        <th style="padding: 15px; text-align: left;">Stock Actual</th>
                                        <th style="padding: 15px; text-align: left;">Stock Mínimo</th>
                                        <th style="padding: 15px; text-align: left;">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${lowStockProducts.map(product => `
                                        <tr style="border-bottom: 1px solid #e2e8f0;">
                                            <td style="padding: 15px;">
                                                <div style="font-weight: 600;">${product.nombre}</div>
                                                <small style="color: #718096;">${product.categoria}</small>
                                            </td>
                                            <td style="padding: 15px; font-family: monospace; color: #1a8c8a;">
                                                ${product.sku}
                                            </td>
                                            <td style="padding: 15px;">
                                                <span class="stock-badge ${this.getStockClass(product.stock, product.stock_minimo)}">
                                                    ${product.stock}
                                                </span>
                                            </td>
                                            <td style="padding: 15px;">
                                                ${product.stock_minimo}
                                            </td>
                                            <td style="padding: 15px;">
                                                <button class="btn btn-secondary" onclick="window.app.showProductDetails('${product.id}')" 
                                                        style="padding: 5px 10px; font-size: 0.9rem;">
                                                    <i class="fas fa-eye"></i> Ver
                                                </button>
                                                <button class="btn btn-secondary" onclick="window.app.editProduct('${product.id}')" 
                                                        style="padding: 5px 10px; font-size: 0.9rem; margin-left: 5px;">
                                                    <i class="fas fa-edit"></i> Editar
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            `;
            
        } catch (error) {
            container.innerHTML = `
                <div style="background: white; border-radius: 15px; padding: 30px;">
                    <h3 style="color: #1a8c8a; margin-bottom: 20px;">
                        <i class="fas fa-warehouse"></i> Control de Stock
                    </h3>
                    <p>Error cargando la información de stock. Intenta nuevamente.</p>
                </div>
            `;
        }
    }

    showError(message) {
        const alert = document.createElement('div');
        alert.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f56565;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease;
            max-width: 400px;
        `;
        alert.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        
        document.body.appendChild(alert);
        
        setTimeout(() => {
            alert.remove();
        }, 5000);
    }

    showSuccess(message) {
        const alert = document.createElement('div');
        alert.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #48bb78;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease;
            max-width: 400px;
        `;
        alert.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
        
        document.body.appendChild(alert);
        
        setTimeout(() => {
            alert.remove();
        }, 5000);
    }
}

// Iniciar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TiendaPescaApp();
});