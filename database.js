const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

class Database {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = null;
    }

    async initDatabase() {
        return new Promise((resolve, reject) => {
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                this.createTables()
                    .then(() => resolve())
                    .catch(reject);
            });
        });
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            // Tabla categorias
            this.db.run(`
                CREATE TABLE IF NOT EXISTS categorias (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nombre TEXT UNIQUE NOT NULL,
                    codigo TEXT UNIQUE NOT NULL
                )
            `, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                this.insertDefaultCategories();
                
                // Tabla productos (con stock_apertura agregado)
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS productos (
                        id TEXT PRIMARY KEY,
                        sku TEXT UNIQUE NOT NULL,
                        nombre TEXT NOT NULL,
                        descripcion TEXT,
                        categoria TEXT NOT NULL,
                        marca TEXT,
                        precio REAL NOT NULL DEFAULT 0,
                        costo REAL DEFAULT 0,
                        stock INTEGER DEFAULT 0,
                        stock_minimo INTEGER DEFAULT 5,
                        stock_apertura INTEGER DEFAULT 0,
                        proveedor TEXT,
                        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
                        fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    // Verificar si falta la columna stock_apertura (migración)
                    this.db.all("PRAGMA table_info(productos)", (err, columns) => {
                        if (!err && columns) {
                            const hasStockApertura = columns.some(col => col.name === 'stock_apertura');
                            if (!hasStockApertura) {
                                this.db.run("ALTER TABLE productos ADD COLUMN stock_apertura INTEGER DEFAULT 0", (err) => {
                                    if (err) console.warn("No se pudo agregar stock_apertura:", err.message);
                                });
                            }
                            
                            // ========== NUEVO: Agregar columna margen ==========
                            const hasMargen = columns.some(col => col.name === 'margen');
                            if (!hasMargen) {
                                this.db.run("ALTER TABLE productos ADD COLUMN margen REAL DEFAULT 80", (err) => {
                                    if (err) console.warn("No se pudo agregar margen:", err.message);
                                    else console.log("✅ Columna 'margen' agregada a la tabla productos");
                                });
                            }
                        }
                    });
                    
                    // Tabla gastos
                    this.db.run(`
                        CREATE TABLE IF NOT EXISTS gastos (
                            id TEXT PRIMARY KEY,
                            tipo TEXT NOT NULL,
                            categoria TEXT NOT NULL,
                            descripcion TEXT,
                            monto REAL NOT NULL,
                            metodo_pago TEXT NOT NULL,
                            proveedor TEXT,
                            comprobante TEXT,
                            observaciones TEXT,
                            usuario TEXT,
                            fecha DATETIME DEFAULT CURRENT_TIMESTAMP
                        )
                    `, (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        // Verificar estructura de la tabla gastos (agregar columnas faltantes si es necesario)
                        this.db.all("PRAGMA table_info(gastos)", (err, columns) => {
                            if (!err && columns) {
                                // Lista de columnas esperadas
                                const expectedColumns = ['id', 'tipo', 'categoria', 'descripcion', 'monto', 'metodo_pago', 'proveedor', 'comprobante', 'observaciones', 'usuario', 'fecha'];
                                expectedColumns.forEach(col => {
                                    if (!columns.some(c => c.name === col)) {
                                        // Determinar tipo por defecto
                                        let colType = 'TEXT';
                                        if (col === 'monto') colType = 'REAL';
                                        if (col === 'fecha') colType = 'DATETIME';
                                        this.db.run(`ALTER TABLE gastos ADD COLUMN ${col} ${colType}`, (err) => {
                                            if (err) console.warn(`No se pudo agregar columna ${col}:`, err.message);
                                        });
                                    }
                                });
                            }
                        });
                        
                        // Tabla cierres
                        this.db.run(`
                            CREATE TABLE IF NOT EXISTS cierres (
                                id TEXT PRIMARY KEY,
                                fecha DATETIME NOT NULL,
                                fecha_formateada TEXT,
                                total_ventas REAL DEFAULT 0,
                                total_comisiones REAL DEFAULT 0,
                                total_gastos REAL DEFAULT 0,
                                neto_depositar REAL DEFAULT 0,
                                cantidad_ventas INTEGER DEFAULT 0,
                                cantidad_gastos INTEGER DEFAULT 0,
                                ventas_por_metodo TEXT,
                                fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
                            )
                        `, (err) => {
                            if (err) console.warn("Error creando tabla cierres:", err.message);
                        });
                        
                        // Tabla caja_diaria
                        this.db.run(`
                            CREATE TABLE IF NOT EXISTS caja_diaria (
                                id TEXT PRIMARY KEY,
                                fecha TEXT NOT NULL UNIQUE,
                                saldo_inicial REAL DEFAULT 0,
                                total_ingresos REAL DEFAULT 0,
                                total_egresos REAL DEFAULT 0,
                                saldo_final REAL DEFAULT 0,
                                movimientos TEXT,
                                fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
                            )
                        `, (err) => {
                            if (err) console.warn("Error creando tabla caja_diaria:", err.message);
                        });
                        
                        // ========== NUEVA TABLA: ventas ==========
                        this.db.run(`
                            CREATE TABLE IF NOT EXISTS ventas (
                                id TEXT PRIMARY KEY,
                                fecha DATETIME NOT NULL,
                                productos TEXT NOT NULL,
                                total REAL NOT NULL,
                                total_neto REAL,
                                comision_porcentaje REAL,
                                comision_monto REAL,
                                metodo_pago TEXT NOT NULL,
                                descuento_aplicado REAL,
                                recargo_aplicado REAL,
                                monto_recibido REAL,
                                vuelto REAL,
                                fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
                            )
                        `, (err) => {
                            if (err) console.warn("Error creando tabla ventas:", err.message);
                        });
                        
                        this.verificarCategorias();
                        resolve();
                    });
                });
            });
        });
    }

    insertDefaultCategories() {
        const categorias = [
            // Categorías de pesca
            { nombre: 'Anzuelos', codigo: 'ANZ' },
            { nombre: 'Cañas', codigo: 'CNA' },
            { nombre: 'Carretes', codigo: 'CAR' },
            { nombre: 'Líneas', codigo: 'LIN' },
            { nombre: 'Señuelos', codigo: 'SEN' },
            { nombre: 'Accesorios', codigo: 'ACC' },
            { nombre: 'Carnadas', codigo: 'CRN' },
            { nombre: 'Indumentaria', codigo: 'IND' },
            { nombre: 'Equipamiento', codigo: 'EQP' },
            // Nuevas categorías de camping
            { nombre: 'Carpas', codigo: 'CRP' },
            { nombre: 'Bolsas de dormir', codigo: 'DOR' },
            { nombre: 'Colchonetas', codigo: 'COL' },
            { nombre: 'Mochilas', codigo: 'MOC' },
            { nombre: 'Linternas', codigo: 'LUM' },
            { nombre: 'Cocinas', codigo: 'COC' },
            { nombre: 'Utensilios', codigo: 'UTI' },
            { nombre: 'Termos', codigo: 'TER' },
            { nombre: 'Sillas', codigo: 'SIL' },
            { nombre: 'Mesas', codigo: 'MES' },
            { nombre: 'Plomos', codigo: 'PLO' },
            { nombre: 'Reels', codigo: 'REL' },
            { nombre: 'Boyas', codigo: 'BOY' }
        ];

        categorias.forEach((cat) => {
            this.db.run(
                `INSERT OR REPLACE INTO categorias (nombre, codigo) VALUES (?, ?)`,
                [cat.nombre, cat.codigo],
                function(err) {
                    // Silenciamos errores
                }
            );
        });
    }

    verificarCategorias() {
        this.db.get('SELECT COUNT(*) as count FROM categorias', [], (err, row) => {
            // No mostramos nada
        });
    }

    // ============ CATEGORÍAS ============
    async getCategories() {
        return new Promise((resolve) => {
            this.db.all('SELECT * FROM categorias ORDER BY nombre', [], (err, rows) => {
                if (err) {
                    resolve([]);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    // ============ PRODUCTOS ============
    async getAllProducts() {
        return new Promise((resolve) => {
            this.db.all('SELECT * FROM productos ORDER BY fecha_creacion DESC', [], (err, rows) => {
                if (err) {
                    resolve([]);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    async getProductById(id) {
        return new Promise((resolve) => {
            this.db.get('SELECT * FROM productos WHERE id = ?', [id], (err, row) => {
                if (err) {
                    resolve(null);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async createProduct(producto) {
        return new Promise(async (resolve, reject) => {
            try {
                const id = uuidv4();
                
                if (!producto.sku) {
                    producto.sku = await this.generateSKU(producto.categoria || 'Anzuelos', producto.marca || '');
                }
                
                // Asegurar que margen tenga valor por defecto 80 si no se proporciona
                const margen = producto.margen !== undefined ? producto.margen : 80;

                this.db.run(
                    `INSERT INTO productos 
                     (id, sku, nombre, descripcion, categoria, marca, precio, costo, stock, stock_minimo, stock_apertura, proveedor, margen)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        id,
                        producto.sku,
                        producto.nombre || 'Sin nombre',
                        producto.descripcion || '',
                        producto.categoria || 'Anzuelos',
                        producto.marca || '',
                        producto.precio || 0,
                        producto.costo || (producto.precio ? producto.precio * 0.6 : 0),
                        producto.stock || 0,
                        producto.stock_minimo || 5,
                        producto.stock_apertura !== undefined ? producto.stock_apertura : 0,
                        producto.proveedor || '',
                        margen
                    ],
                    function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve({ id, ...producto, margen });
                        }
                    }
                );
            } catch (error) {
                reject(error);
            }
        });
    }

    async updateProduct(id, producto) {
        return new Promise((resolve, reject) => {
            // Asegurar margen (usar valor existente si no viene)
            const margen = producto.margen !== undefined ? producto.margen : 80;
            
            this.db.run(
                `UPDATE productos 
                 SET nombre = ?, descripcion = ?, categoria = ?, marca = ?,
                     precio = ?, costo = ?, stock = ?, stock_minimo = ?, stock_apertura = ?,
                     proveedor = ?, margen = ?, fecha_actualizacion = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [
                    producto.nombre,
                    producto.descripcion || '',
                    producto.categoria,
                    producto.marca || '',
                    producto.precio,
                    producto.costo || 0,
                    producto.stock || 0,
                    producto.stock_minimo || 5,
                    producto.stock_apertura !== undefined ? producto.stock_apertura : 0,
                    producto.proveedor || '',
                    margen,
                    id
                ],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                }
            );
        });
    }

    async deleteProduct(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM productos WHERE id = ?', [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    async searchProducts(query) {
        return new Promise((resolve) => {
            if (!query || query.trim() === '') {
                this.getAllProducts().then(resolve);
                return;
            }

            const searchTerm = `%${query}%`;
            this.db.all(
                `SELECT * FROM productos 
                 WHERE nombre LIKE ? OR sku LIKE ? OR categoria LIKE ? OR marca LIKE ?
                 ORDER BY nombre`,
                [searchTerm, searchTerm, searchTerm, searchTerm],
                (err, rows) => {
                    if (err) {
                        resolve([]);
                    } else {
                        resolve(rows || []);
                    }
                }
            );
        });
    }

    // ============ SKU ============
    async generateSKU(categoria, marca = '') {
        return new Promise((resolve) => {
            this.db.get(
                'SELECT codigo FROM categorias WHERE nombre = ?',
                [categoria],
                (err, row) => {
                    if (err || !row) {
                        const catCode = 'GEN';
                        const marcaCode = marca ? marca.substring(0, 3).toUpperCase() : '';
                        const prefijo = marcaCode ? `${catCode}-${marcaCode}` : `${catCode}-`;
                        
                        this.db.get(
                            'SELECT sku FROM productos WHERE sku LIKE ? ORDER BY sku DESC LIMIT 1',
                            [`${prefijo}%`],
                            (err, lastRow) => {
                                let num = 1;
                                if (lastRow && lastRow.sku) {
                                    const match = lastRow.sku.match(/(\d+)$/);
                                    if (match) num = parseInt(match[1], 10) + 1;
                                }
                                const sku = `${prefijo}${num.toString().padStart(4, '0')}`;
                                resolve(sku);
                            }
                        );
                    } else {
                        const catCode = row.codigo;
                        const marcaCode = marca ? marca.substring(0, 3).toUpperCase() : '';
                        const prefijo = marcaCode ? `${catCode}-${marcaCode}` : `${catCode}-`;
                        
                        this.db.get(
                            'SELECT sku FROM productos WHERE sku LIKE ? ORDER BY sku DESC LIMIT 1',
                            [`${prefijo}%`],
                            (err, lastRow) => {
                                let num = 1;
                                if (lastRow && lastRow.sku) {
                                    const match = lastRow.sku.match(/(\d+)$/);
                                    if (match) num = parseInt(match[1], 10) + 1;
                                }
                                const sku = `${prefijo}${num.toString().padStart(4, '0')}`;
                                resolve(sku);
                            }
                        );
                    }
                }
            );
        });
    }

    async getNextSKU(categoria, marca) {
        return this.generateSKU(categoria, marca);
    }

    // ============ ESTADÍSTICAS ============
    async getStatistics() {
        return new Promise((resolve) => {
            this.db.get(
                `SELECT 
                    COUNT(*) as total_productos,
                    COALESCE(SUM(stock), 0) as total_stock,
                    COALESCE(SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END), 0) as agotados,
                    COALESCE(SUM(CASE WHEN stock <= stock_minimo AND stock > 0 THEN 1 ELSE 0 END), 0) as bajo_stock,
                    COALESCE(SUM(precio * stock), 0) as valor_inventario
                 FROM productos`,
                [],
                (err, row) => {
                    if (err) {
                        resolve(this.getDefaultStats());
                    } else {
                        resolve(row || this.getDefaultStats());
                    }
                }
            );
        });
    }

    getDefaultStats() {
        return {
            total_productos: 0,
            total_stock: 0,
            agotados: 0,
            bajo_stock: 0,
            valor_inventario: 0
        };
    }

    // ============ STOCK ============
    async updateStock(id, cantidad, operacion) {
        return new Promise((resolve, reject) => {
            const signo = operacion === 'incrementar' ? '+' : '-';
            this.db.run(
                `UPDATE productos SET stock = stock ${signo} ? WHERE id = ?`,
                [Math.abs(cantidad), id],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                }
            );
        });
    }

    async getLowStockProducts() {
        return new Promise((resolve) => {
            this.db.all(
                'SELECT * FROM productos WHERE stock <= stock_minimo ORDER BY stock ASC',
                [],
                (err, rows) => {
                    if (err) {
                        resolve([]);
                    } else {
                        resolve(rows || []);
                    }
                }
            );
        });
    }

    // ============ PUNTO DE VENTA ============
    async getPriceList(search = '') {
        return new Promise((resolve) => {
            let query = 'SELECT sku, nombre, precio, stock, categoria, marca FROM productos';
            let params = [];
            
            if (search) {
                query += ' WHERE sku LIKE ? OR nombre LIKE ? OR categoria LIKE ? OR marca LIKE ?';
                const term = `%${search}%`;
                params = [term, term, term, term];
            }
            
            query += ' ORDER BY nombre ASC';
            
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    resolve([]);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    // ============ GASTOS ============
    async createGasto(gasto) {
        return new Promise((resolve, reject) => {
            // Respetar el ID que viene del front-end (si existe)
            const id = gasto.id || uuidv4();
            
            const tipo = (gasto.tipo || 'gasto').toLowerCase().trim();
            const categoria = (gasto.categoria || 'otros').toLowerCase().trim();
            const descripcion = (gasto.descripcion || '').trim();
            const monto = parseFloat(gasto.monto) || 0;
            const metodo_pago = (gasto.metodo_pago || 'efectivo').toLowerCase().replace(/\s+/g, '_');
            const proveedor = (gasto.proveedor || '').trim();
            const comprobante = (gasto.comprobante || '').trim();
            const observaciones = (gasto.observaciones || '').trim();
            const usuario = (gasto.usuario || 'sistema').trim();
            // Usar la fecha que viene del front-end, o la actual si no viene
            const fecha = gasto.fecha || new Date().toISOString();

            if (!categoria || categoria === '') {
                reject(new Error('La categoría no puede estar vacía'));
                return;
            }

            const query = `
                INSERT INTO gastos 
                (id, tipo, categoria, descripcion, monto, metodo_pago, proveedor, comprobante, observaciones, usuario, fecha)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const params = [
                id,
                tipo,
                categoria,
                descripcion,
                monto,
                metodo_pago,
                proveedor,
                comprobante,
                observaciones,
                usuario,
                fecha
            ];

            this.db.run(query, params, function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                
                resolve({ 
                    id, 
                    tipo, 
                    categoria, 
                    descripcion, 
                    monto, 
                    metodo_pago, 
                    proveedor, 
                    comprobante, 
                    observaciones, 
                    usuario,
                    fecha: fecha
                });
            });
        });
    }

    async getGastosByDate(fecha = null) {
        return new Promise((resolve) => {
            let query = `SELECT * FROM gastos`;
            let params = [];
            
            if (fecha) {
                let fechaStr;
                if (fecha instanceof Date) {
                    fechaStr = fecha.toISOString().split('T')[0];
                } else if (typeof fecha === 'string') {
                    fechaStr = fecha.split('T')[0];
                } else {
                    fechaStr = new Date().toISOString().split('T')[0];
                }
                
                query += ` WHERE DATE(fecha) = DATE(?)`;
                params.push(fechaStr);
            }
            
            query += ` ORDER BY fecha DESC`;
            
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    resolve([]);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    async getTodayGastos() {
        const today = new Date().toISOString().split('T')[0];
        return this.getGastosByDate(today);
    }

    async getGastosSummary(fecha = null) {
        return new Promise((resolve) => {
            let query = `
                SELECT 
                    categoria,
                    COUNT(*) as cantidad,
                    SUM(monto) as total
                FROM gastos
            `;
            let params = [];
            
            if (fecha) {
                let fechaStr;
                if (fecha instanceof Date) {
                    fechaStr = fecha.toISOString().split('T')[0];
                } else if (typeof fecha === 'string') {
                    fechaStr = fecha.split('T')[0];
                } else {
                    fechaStr = new Date().toISOString().split('T')[0];
                }
                
                query += ` WHERE DATE(fecha) = DATE(?)`;
                params.push(fechaStr);
            }
            
            query += ` GROUP BY categoria ORDER BY total DESC`;
            
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    resolve([]);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    async deleteGasto(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM gastos WHERE id = ?', [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    async getStatisticsWithGastos() {
        try {
            const stats = await this.getStatistics();
            const todayGastos = await this.getTodayGastos();
            const totalGastos = todayGastos.reduce((sum, gasto) => sum + gasto.monto, 0);
            const gastosByCategory = await this.getGastosSummary(new Date().toISOString().split('T')[0]);
            const gananciaNeta = stats.valor_inventario - totalGastos;
            
            return {
                ...stats,
                total_gastos: totalGastos,
                ganancia_neta: gananciaNeta,
                gastos_detalle: gastosByCategory,
                gastos_lista: todayGastos
            };
        } catch (error) {
            return this.getDefaultStats();
        }
    }

    // ============ CIERRES ============
    async createCierre(cierre) {
        return new Promise((resolve, reject) => {
            // Respetar el ID que viene del front-end (si existe)
            const id = cierre.id || uuidv4();
            const ventasPorMetodoJSON = JSON.stringify(cierre.ventasPorMetodo || {});
            
            this.db.run(
                `INSERT INTO cierres 
                 (id, fecha, fecha_formateada, total_ventas, total_comisiones, total_gastos, neto_depositar, cantidad_ventas, cantidad_gastos, ventas_por_metodo)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    cierre.fecha,
                    cierre.fechaFormateada,
                    cierre.totalVentas || 0,
                    cierre.totalComisiones || 0,
                    cierre.totalGastos || 0,
                    cierre.netoDepositar || 0,
                    cierre.cantidadVentas || 0,
                    cierre.cantidadGastos || 0,
                    ventasPorMetodoJSON
                ],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id, ...cierre });
                    }
                }
            );
        });
    }

    async getCierres(limit = 100) {
        return new Promise((resolve) => {
            this.db.all(
                `SELECT * FROM cierres ORDER BY fecha DESC LIMIT ?`,
                [limit],
                (err, rows) => {
                    if (err) {
                        resolve([]);
                    } else {
                        rows.forEach(row => {
                            try {
                                row.ventasPorMetodo = JSON.parse(row.ventas_por_metodo);
                            } catch(e) {
                                row.ventasPorMetodo = {};
                            }
                        });
                        resolve(rows || []);
                    }
                }
            );
        });
    }

    // ============ CAJA DIARIA (HISTORIAL DE CAJA) ============
    async saveCajaDiaria(resumen) {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            const fecha = resumen.fecha;
            const movimientosJSON = JSON.stringify(resumen.movimientos || []);
            
            this.db.run(
                `INSERT OR REPLACE INTO caja_diaria 
                 (id, fecha, saldo_inicial, total_ingresos, total_egresos, saldo_final, movimientos)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    fecha,
                    resumen.saldo_inicial || 0,
                    resumen.total_ingresos || 0,
                    resumen.total_egresos || 0,
                    resumen.saldo_final || 0,
                    movimientosJSON
                ],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id, ...resumen });
                    }
                }
            );
        });
    }

    async getCajaDiaria(fecha) {
        return new Promise((resolve) => {
            this.db.get(
                'SELECT * FROM caja_diaria WHERE fecha = ?',
                [fecha],
                (err, row) => {
                    if (err || !row) {
                        resolve(null);
                    } else {
                        try {
                            row.movimientos = JSON.parse(row.movimientos);
                        } catch(e) {
                            row.movimientos = [];
                        }
                        resolve(row);
                    }
                }
            );
        });
    }

    async getHistorialCaja(limit = 100) {
        return new Promise((resolve) => {
            this.db.all(
                'SELECT * FROM caja_diaria ORDER BY fecha DESC LIMIT ?',
                [limit],
                (err, rows) => {
                    if (err) {
                        resolve([]);
                    } else {
                        rows.forEach(row => {
                            try {
                                row.movimientos = JSON.parse(row.movimientos);
                            } catch(e) {
                                row.movimientos = [];
                            }
                        });
                        resolve(rows);
                    }
                }
            );
        });
    }

    // ============ VENTAS ============
    async createVenta(venta) {
        return new Promise((resolve, reject) => {
            // Respetar el ID que viene del front-end (si existe)
            const id = venta.id || uuidv4();
            const productosJSON = JSON.stringify(venta.productos);
            this.db.run(
                `INSERT INTO ventas 
                 (id, fecha, productos, total, total_neto, comision_porcentaje, comision_monto, metodo_pago, descuento_aplicado, recargo_aplicado, monto_recibido, vuelto)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    venta.fecha,
                    productosJSON,
                    venta.total,
                    venta.total_neto || venta.total,
                    venta.comision_porcentaje || 0,
                    venta.comision_monto || 0,
                    venta.metodo_pago,
                    venta.descuento_aplicado || 0,
                    venta.recargo_aplicado || 0,
                    venta.monto_recibido || null,
                    venta.vuelto || null
                ],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id, ...venta });
                }
            );
        });
    }

    async getVentasByDate(fecha) {
        return new Promise((resolve) => {
            // Usar DATE() para comparar solo la parte de fecha, sin importar la zona horaria
            this.db.all(
                `SELECT * FROM ventas WHERE DATE(fecha) = DATE(?) ORDER BY fecha ASC`,
                [fecha],
                (err, rows) => {
                    if (err) {
                        resolve([]);
                    } else {
                        rows.forEach(row => {
                            try {
                                row.productos = JSON.parse(row.productos);
                            } catch(e) { row.productos = []; }
                        });
                        resolve(rows);
                    }
                }
            );
        });
    }

    async getVentasDelDia() {
        const hoy = new Date().toISOString().split('T')[0];
        return this.getVentasByDate(hoy);
    }

    // Alias para mantener consistencia (ya existe getTodayGastos)
    async getGastosDelDia() {
        return this.getTodayGastos();
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = Database;