const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

class Database {
    constructor(dbPath = null) {
        this.dbPath = dbPath || path.join(process.cwd(), 'tienda-pesca.db');
        
        console.log('📁 Ruta de base de datos:', this.dbPath);
        
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('❌ Error conectando a SQLite:', err.message);
            } else {
                console.log('✅ Conectado a SQLite correctamente');
                this.initDatabase();
            }
        });
        
        this.db.on('error', (err) => {
            console.error('❌ Error de SQLite:', err.message);
        });
    }

    initDatabase() {
        console.log('🔧 Inicializando base de datos...');
        
        // Tabla productos
        this.db.run(`
            CREATE TABLE IF NOT EXISTS productos (
                id TEXT PRIMARY KEY,
                sku TEXT UNIQUE,
                nombre TEXT NOT NULL,
                descripcion TEXT,
                categoria TEXT,
                marca TEXT,
                precio REAL DEFAULT 0,
                costo REAL DEFAULT 0,
                stock INTEGER DEFAULT 0,
                stock_minimo INTEGER DEFAULT 5,
                imagen TEXT,
                caracteristicas TEXT,
                proveedor TEXT,
                fecha_creacion TEXT DEFAULT CURRENT_TIMESTAMP,
                fecha_actualizacion TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('❌ Error creando tabla productos:', err.message);
            } else {
                console.log('✅ Tabla productos creada/verificada');
                this.verificarColumnas();
            }
        });

        // Tabla categorías
        this.db.run(`
            CREATE TABLE IF NOT EXISTS categorias (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT UNIQUE,
                codigo TEXT UNIQUE
            )
        `, (err) => {
            if (err) {
                console.error('❌ Error creando tabla categorias:', err.message);
            } else {
                console.log('✅ Tabla categorias creada/verificada');
                this.insertDefaultCategories();
            }
        });
    }

    verificarColumnas() {
        console.log('🔍 Verificando columnas de la tabla productos...');
        
        const columnasNecesarias = [
            { nombre: 'costo', tipo: 'REAL DEFAULT 0' },
            { nombre: 'proveedor', tipo: 'TEXT' },
            { nombre: 'fecha_actualizacion', tipo: 'TEXT DEFAULT CURRENT_TIMESTAMP' },
            { nombre: 'imagen', tipo: 'TEXT' },
            { nombre: 'caracteristicas', tipo: 'TEXT' }
        ];
        
        columnasNecesarias.forEach(col => {
            this.db.get(
                `SELECT COUNT(*) as existe FROM pragma_table_info('productos') WHERE name = ?`,
                [col.nombre],
                (err, row) => {
                    if (err) {
                        console.error(`❌ Error verificando columna ${col.nombre}:`, err.message);
                        return;
                    }
                    
                    if (!row || row.existe === 0) {
                        console.log(`➕ Agregando columna faltante: ${col.nombre}`);
                        
                        this.db.run(
                            `ALTER TABLE productos ADD COLUMN ${col.nombre} ${col.tipo}`,
                            (err) => {
                                if (err) {
                                    console.error(`❌ Error agregando columna ${col.nombre}:`, err.message);
                                } else {
                                    console.log(`✅ Columna ${col.nombre} agregada correctamente`);
                                }
                            }
                        );
                    }
                }
            );
        });
    }

    insertDefaultCategories() {
        console.log('📝 Insertando categorías por defecto...');
        
        const categorias = [
            { nombre: 'Anzuelos', codigo: 'ANZ' },
            { nombre: 'Cañas', codigo: 'CÑA' },
            { nombre: 'Carretes', codigo: 'CAR' },
            { nombre: 'Líneas', codigo: 'LIN' },
            { nombre: 'Señuelos', codigo: 'SEN' },
            { nombre: 'Accesorios', codigo: 'ACC' },
            { nombre: 'Carnadas', codigo: 'CRN' },
            { nombre: 'Indumentaria', codigo: 'IND' },
            { nombre: 'Equipamiento', codigo: 'EQP' }
        ];

        categorias.forEach((cat) => {
            this.db.run(
                `INSERT OR IGNORE INTO categorias (nombre, codigo) VALUES (?, ?)`,
                [cat.nombre, cat.codigo],
                function(err) {
                    if (err) {
                        console.error(`❌ Error insertando ${cat.nombre}:`, err.message);
                    }
                }
            );
        });
    }

    // ============ MÉTODOS PÚBLICOS ============

    generateSKU(categoria, marca = '') {
        return new Promise((resolve, reject) => {
            console.log(`🔧 Generando SKU para: ${categoria} - ${marca}`);
            
            this.db.get(
                `SELECT codigo FROM categorias WHERE nombre = ?`,
                [categoria],
                (err, row) => {
                    if (err) {
                        console.error('❌ Error obteniendo código de categoría:', err.message);
                        resolve('GEN-0001');
                        return;
                    }
                    
                    const catCode = row ? row.codigo : 'GEN';
                    const marcaCode = marca ? marca.substring(0, 3).toUpperCase().replace(/\s/g, '') : '';
                    
                    // Buscar el último número para esta combinación
                    const prefijo = marcaCode ? `${catCode}-${marcaCode}` : `${catCode}-`;
                    
                    this.db.get(
                        `SELECT sku FROM productos 
                         WHERE sku LIKE ? 
                         ORDER BY sku DESC 
                         LIMIT 1`,
                        [`${prefijo}%`],
                        (err, lastRow) => {
                            if (err) {
                                console.error('❌ Error buscando último SKU:', err.message);
                                const numero = '0001';
                                const sku = marcaCode ? `${catCode}-${marcaCode}${numero}` : `${catCode}-${numero}`;
                                console.log(`📦 SKU generado (fallback): ${sku}`);
                                resolve(sku);
                                return;
                            }
                            
                            let siguienteNumero = 1;
                            
                            if (lastRow && lastRow.sku) {
                                const ultimoSKU = lastRow.sku;
                                const match = ultimoSKU.match(/(\d+)$/);
                                if (match) {
                                    siguienteNumero = parseInt(match[1], 10) + 1;
                                }
                            }
                            
                            const numero = siguienteNumero.toString().padStart(4, '0');
                            const sku = marcaCode ? `${catCode}-${marcaCode}${numero}` : `${catCode}-${numero}`;
                            
                            console.log(`📦 SKU generado: ${sku}`);
                            resolve(sku);
                        }
                    );
                }
            );
        });
    }

    getNextSKU(categoria, marca = '') {
        return this.generateSKU(categoria, marca);
    }

    createProduct(producto) {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('➕ Creando producto:', producto.nombre);
                
                if (!producto.sku || producto.sku === '') {
                    console.log('🔄 Generando SKU automáticamente...');
                    producto.sku = await this.generateSKU(producto.categoria || 'Anzuelos', producto.marca || '');
                }

                const id = uuidv4();
                console.log(`📦 Producto SKU: ${producto.sku}`);

                const query = `
                    INSERT INTO productos 
                    (id, sku, nombre, descripcion, categoria, marca, precio, costo, stock, stock_minimo, imagen, caracteristicas, proveedor)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

                const params = [
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
                    producto.imagen || '',
                    typeof producto.caracteristicas === 'string' ? producto.caracteristicas : JSON.stringify(producto.caracteristicas || {}),
                    producto.proveedor || ''
                ];

                this.db.run(query, params, function(err) {
                    if (err) {
                        console.error('❌ Error insertando producto:', err.message);
                        reject(err);
                        return;
                    }
                    
                    console.log(`✅ Producto creado ID: ${id}, SKU: ${producto.sku}`);
                    
                    resolve({ 
                        id, 
                        ...producto,
                        fecha_creacion: new Date().toISOString()
                    });
                });
            } catch (error) {
                console.error('❌ Error en createProduct:', error.message);
                reject(error);
            }
        });
    }

    getAllProducts() {
        return new Promise((resolve, reject) => {
            console.log('📋 Obteniendo todos los productos...');
            
            this.db.all(`
                SELECT *, 
                       CASE 
                         WHEN stock = 0 THEN 'agotado'
                         WHEN stock <= stock_minimo THEN 'bajo'
                         ELSE 'normal'
                       END as estado_stock
                FROM productos
                ORDER BY fecha_creacion DESC
            `, [], (err, rows) => {
                if (err) {
                    console.error('❌ Error obteniendo productos:', err.message);
                    resolve([]);
                    return;
                }
                
                console.log(`✅ Encontrados ${rows?.length || 0} productos`);
                
                const productos = rows.map(row => {
                    try {
                        return {
                            ...row,
                            caracteristicas: row.caracteristicas ? JSON.parse(row.caracteristicas) : {},
                            precio: row.precio || 0,
                            costo: row.costo || 0
                        };
                    } catch {
                        return {
                            ...row,
                            caracteristicas: {},
                            precio: row.precio || 0,
                            costo: row.costo || 0
                        };
                    }
                });
                
                resolve(productos);
            });
        });
    }

    getProductById(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM productos WHERE id = ?', [id], (err, row) => {
                if (err) {
                    console.error('❌ Error obteniendo producto:', err.message);
                    resolve(null);
                    return;
                }
                
                if (row) {
                    try {
                        row.caracteristicas = JSON.parse(row.caracteristicas || '{}');
                    } catch {
                        row.caracteristicas = {};
                    }
                }
                
                resolve(row);
            });
        });
    }

    updateProduct(id, producto) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE productos 
                SET nombre = ?, descripcion = ?, categoria = ?, marca = ?,
                    precio = ?, costo = ?, stock = ?, stock_minimo = ?,
                    imagen = ?, caracteristicas = ?, proveedor = ?,
                    fecha_actualizacion = CURRENT_TIMESTAMP
                WHERE id = ?
            `;

            this.db.run(query, [
                producto.nombre,
                producto.descripcion,
                producto.categoria,
                producto.marca,
                producto.precio,
                producto.costo,
                producto.stock,
                producto.stock_minimo,
                producto.imagen,
                JSON.stringify(producto.caracteristicas || {}),
                producto.proveedor,
                id
            ], function(err) {
                if (err) {
                    console.error('❌ Error actualizando producto:', err.message);
                    reject(err);
                    return;
                }
                
                console.log(`✅ Producto actualizado ID: ${id}`);
                resolve({ id, ...producto });
            });
        });
    }

    deleteProduct(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM productos WHERE id = ?', [id], function(err) {
                if (err) {
                    console.error('❌ Error eliminando producto:', err.message);
                    reject(err);
                    return;
                }
                
                console.log(`✅ Producto eliminado ID: ${id}`);
                resolve(true);
            });
        });
    }

    getCategories() {
        return new Promise((resolve, reject) => {
            console.log('🏷️ Obteniendo categorías...');
            
            this.db.all('SELECT * FROM categorias ORDER BY nombre', [], (err, rows) => {
                if (err) {
                    console.error('❌ Error obteniendo categorías:', err.message);
                    resolve([]);
                    return;
                }
                
                console.log(`✅ Encontradas ${rows?.length || 0} categorías`);
                resolve(rows || []);
            });
        });
    }

    getStatistics() {
        return new Promise((resolve, reject) => {
            console.log('📊 Obteniendo estadísticas...');
            
            this.db.get(`
                SELECT 
                  COUNT(*) as total_productos,
                  COALESCE(SUM(stock), 0) as total_stock,
                  COALESCE(SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END), 0) as agotados,
                  COALESCE(SUM(CASE WHEN stock <= stock_minimo AND stock > 0 THEN 1 ELSE 0 END), 0) as bajo_stock,
                  COUNT(DISTINCT categoria) as categorias,
                  COUNT(DISTINCT marca) as marcas
                FROM productos
            `, [], (err, stats) => {
                if (err) {
                    console.error('❌ Error obteniendo estadísticas:', err.message);
                    resolve(this.getDefaultStats());
                    return;
                }
                
                this.db.get(`
                    SELECT COALESCE(SUM(precio * stock), 0) as valor_inventario
                    FROM productos
                    WHERE stock > 0
                `, [], (err, valor) => {
                    if (err) {
                        console.error('❌ Error obteniendo valor inventario:', err.message);
                        resolve({
                            ...stats,
                            valor_inventario: 0
                        });
                        return;
                    }
                    
                    const result = {
                        total_productos: stats.total_productos || 0,
                        total_stock: stats.total_stock || 0,
                        agotados: stats.agotados || 0,
                        bajo_stock: stats.bajo_stock || 0,
                        categorias: stats.categorias || 0,
                        marcas: stats.marcas || 0,
                        valor_inventario: valor?.valor_inventario || 0
                    };
                    
                    console.log('✅ Estadísticas obtenidas:', result);
                    resolve(result);
                });
            });
        });
    }

    getDefaultStats() {
        return {
            total_productos: 0,
            total_stock: 0,
            agotados: 0,
            bajo_stock: 0,
            categorias: 0,
            marcas: 0,
            valor_inventario: 0
        };
    }

    searchProducts(query) {
        return new Promise((resolve, reject) => {
            if (!query || query.trim() === '') {
                return this.getAllProducts();
            }
            
            this.db.all(
                `SELECT * FROM productos 
                 WHERE nombre LIKE ? OR sku LIKE ? OR categoria LIKE ? OR marca LIKE ?
                 ORDER BY nombre`,
                [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`],
                (err, rows) => {
                    if (err) {
                        console.error('❌ Error buscando productos:', err.message);
                        resolve([]);
                        return;
                    }
                    
                    resolve(rows || []);
                }
            );
        });
    }

    updateStock(id, cantidad, operacion) {
        return new Promise((resolve, reject) => {
            const operador = operacion === 'incrementar' ? '+' : '-';
            const query = `
                UPDATE productos 
                SET stock = stock ${operador} ?, 
                    fecha_actualizacion = CURRENT_TIMESTAMP
                WHERE id = ?
            `;

            this.db.run(query, [Math.abs(cantidad), id], function(err) {
                if (err) {
                    console.error('❌ Error actualizando stock:', err.message);
                    reject(err);
                    return;
                }
                
                console.log(`✅ Stock actualizado para producto ${id}: ${operacion} ${cantidad}`);
                resolve(true);
            });
        });
    }

    getLowStockProducts() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT * FROM productos 
                WHERE stock <= stock_minimo 
                ORDER BY stock ASC, nombre
            `, [], (err, rows) => {
                if (err) {
                    console.error('❌ Error obteniendo productos con stock bajo:', err.message);
                    resolve([]);
                    return;
                }
                
                resolve(rows || []);
            });
        });
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('❌ Error cerrando base de datos:', err.message);
                } else {
                    console.log('✅ Base de datos cerrada correctamente');
                }
            });
        }
    }
}

module.exports = Database;