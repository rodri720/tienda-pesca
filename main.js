const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const Database = require('./database.js');

let mainWindow = null;
let puntoVentaWindow = null;
let db = null;

// ============ CONFIGURACIÓN ============
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'tienda-pesca.db');

// ============ BLOQUEO DE INSTANCIA ÚNICA ============
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
        if (puntoVentaWindow && !puntoVentaWindow.isDestroyed()) {
            if (puntoVentaWindow.isMinimized()) puntoVentaWindow.restore();
            puntoVentaWindow.focus();
        }
    });

    app.whenReady().then(async () => {
        try {
            db = new Database(dbPath);
            await db.initDatabase();
            
            setupIpcHandlers();
            createMainWindow();
            createMenu();
            
        } catch (error) {
            dialog.showErrorBox('Error Crítico', 
                `No se pudo iniciar la aplicación:\n\n${error.message}`
            );
            app.quit();
        }
    });
}

// ============ VENTANA PRINCIPAL ============
function createMainWindow() {
    const iconPath = path.join(__dirname, 'assets', 'icon.ico');
    const icon = fsSync.existsSync(iconPath) ? iconPath : undefined;

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        icon: icon,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: true
        },
        show: false,
        backgroundColor: '#f0f2f5'
    });

    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
    
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.webContents.session.clearCache().catch(() => {});

    return mainWindow;
}

// ============ VENTANA PUNTO DE VENTA ============
function createPuntoVentaWindow() {
    try {
        if (puntoVentaWindow && !puntoVentaWindow.isDestroyed()) {
            puntoVentaWindow.focus();
            return puntoVentaWindow;
        }

        const iconPath = path.join(__dirname, 'assets', 'icon.ico');
        const icon = fsSync.existsSync(iconPath) ? iconPath : undefined;

        puntoVentaWindow = new BrowserWindow({
            width: 1300,
            height: 850,
            icon: icon,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
                devTools: true
            },
            show: false,
            backgroundColor: '#f0f2f5'
        });

        const htmlPath = path.join(__dirname, 'src', 'punto-venta.html');
        
        if (!fsSync.existsSync(htmlPath)) {
            dialog.showErrorBox('Error', `No se encuentra el archivo:\n${htmlPath}`);
            puntoVentaWindow.close();
            puntoVentaWindow = null;
            return null;
        }
        
        puntoVentaWindow.loadFile(htmlPath);

        puntoVentaWindow.once('ready-to-show', () => {
            puntoVentaWindow.show();
        });

        puntoVentaWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            // Silencioso
        });

        puntoVentaWindow.on('closed', () => {
            puntoVentaWindow = null;
        });

        puntoVentaWindow.on('unresponsive', () => {});
        puntoVentaWindow.on('responsive', () => {});

        return puntoVentaWindow;
        
    } catch (error) {
        dialog.showErrorBox('Error', `No se pudo crear la ventana:\n${error.message}`);
        return null;
    }
}

// ============ MENÚ ============
function createMenu() {
    const template = [
        {
            label: 'Archivo',
            submenu: [
                {
                    label: 'Nuevo Producto',
                    accelerator: 'Ctrl+N',
                    click: () => mainWindow?.webContents.send('menu:nuevo-producto')
                },
                {
                    label: 'Punto de Venta',
                    accelerator: 'Ctrl+V',
                    click: () => createPuntoVentaWindow()
                },
                { type: 'separator' },
                {
                    label: 'Salir',
                    accelerator: 'Ctrl+Q',
                    click: () => {
                        if (db) db.close();
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Ver',
            submenu: [
                {
                    label: 'Recargar',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => BrowserWindow.getFocusedWindow()?.reload()
                },
                {
                    label: 'Abrir Consola',
                    accelerator: 'F12',
                    click: () => BrowserWindow.getFocusedWindow()?.webContents.toggleDevTools()
                }
            ]
        }
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ============ HANDLERS IPC ============
function setupIpcHandlers() {
    if (!db) return;

    // ---------- PRODUCTOS ----------
    ipcMain.handle('db:getAllProducts', async () => {
        try { return await db.getAllProducts(); } catch { return []; }
    });
    ipcMain.handle('db:getProductById', async (e, id) => {
        try { return await db.getProductById(id); } catch { return null; }
    });
    ipcMain.handle('db:createProduct', async (e, producto) => {
        try { return await db.createProduct(producto); } catch (e) { throw e; }
    });
    ipcMain.handle('db:updateProduct', async (e, id, producto) => {
        try { return await db.updateProduct(id, producto); } catch (e) { throw e; }
    });
    ipcMain.handle('db:deleteProduct', async (e, id) => {
        try { return await db.deleteProduct(id); } catch (e) { throw e; }
    });
    ipcMain.handle('db:searchProducts', async (e, query) => {
        try { return await db.searchProducts(query); } catch { return []; }
    });

    // ---------- CATEGORÍAS ----------
    ipcMain.handle('db:getCategories', async () => {
        try { return await db.getCategories(); } catch { return []; }
    });

    // ---------- SKU ----------
    ipcMain.handle('db:getNextSKU', async (e, categoria, marca) => {
        try { return await db.getNextSKU(categoria, marca); } catch { return 'GEN-0001'; }
    });

    // ---------- ESTADÍSTICAS ----------
    ipcMain.handle('db:getStats', async () => {
        try { return await db.getStatistics(); } catch { return db.getDefaultStats(); }
    });
    ipcMain.handle('db:getStatsWithGastos', async () => {
        try { return await db.getStatisticsWithGastos(); } catch { return db.getDefaultStats(); }
    });

    // ---------- STOCK ----------
    ipcMain.handle('db:updateStock', async (e, id, cantidad, operacion) => {
        try { return await db.updateStock(id, cantidad, operacion); } catch (e) { throw e; }
    });
    ipcMain.handle('db:getLowStock', async () => {
        try { return await db.getLowStockProducts(); } catch { return []; }
    });

    // ---------- PUNTO DE VENTA ----------
    ipcMain.handle('app:openPuntoVenta', async () => {
        const window = createPuntoVentaWindow();
        return { success: window !== null };
    });
    ipcMain.handle('db:getPriceList', async (e, search) => {
        try { return await db.getPriceList(search); } catch { return []; }
    });

    // ---------- GASTOS ----------
    ipcMain.handle('db:createGasto', async (e, gasto) => {
        try { return await db.createGasto(gasto); } catch (e) { throw e; }
    });
    ipcMain.handle('db:getTodayGastos', async () => {
        try { return await db.getTodayGastos(); } catch { return []; }
    });
    ipcMain.handle('db:getGastosDelDia', async () => {
        try { return await db.getTodayGastos(); } catch { return []; }
    });
    ipcMain.handle('db:getGastosByDate', async (e, fecha) => {
        try { return await db.getGastosByDate(fecha); } catch { return []; }
    });
    ipcMain.handle('db:getGastosSummary', async (e, fecha) => {
        try { return await db.getGastosSummary(fecha); } catch { return []; }
    });
    ipcMain.handle('db:deleteGasto', async (e, id) => {
        try { return await db.deleteGasto(id); } catch (e) { throw e; }
    });

    // ---------- VENTAS ----------
    ipcMain.handle('db:createVenta', async (e, venta) => {
        try { return await db.createVenta(venta); } catch (e) { throw e; }
    });
    ipcMain.handle('db:getVentasDelDia', async () => {
        try { return await db.getVentasDelDia(); } catch { return []; }
    });
    ipcMain.handle('db:getVentasByDate', async (e, fecha) => {
        try { return await db.getVentasByDate(fecha); } catch { return []; }
    });

    // ---------- CIERRES ----------
    ipcMain.handle('db:createCierre', async (e, cierre) => {
        try { return await db.createCierre(cierre); } catch (e) { throw e; }
    });
    ipcMain.handle('db:getCierres', async (e, limit = 100) => {
        try { return await db.getCierres(limit); } catch { return []; }
    });

    // ---------- CAJA DIARIA ----------
    ipcMain.handle('db:saveCajaDiaria', async (e, resumen) => {
        try { return await db.saveCajaDiaria(resumen); } catch (e) { throw e; }
    });
    ipcMain.handle('db:getCajaDiaria', async (e, fecha) => {
        try { return await db.getCajaDiaria(fecha); } catch { return null; }
    });
    ipcMain.handle('db:getHistorialCaja', async (e, limit = 100) => {
        try { return await db.getHistorialCaja(limit); } catch { return []; }
    });

    // ---------- PROVEEDORES ----------
    ipcMain.handle('db:getAllProveedores', async () => {
        try { return await db.getAllProveedores(); } catch { return []; }
    });
    ipcMain.handle('db:getProveedorById', async (e, id) => {
        try { return await db.getProveedorById(id); } catch { return null; }
    });
    ipcMain.handle('db:createProveedor', async (e, proveedor) => {
        try { return await db.createProveedor(proveedor); } catch (e) { throw e; }
    });
    ipcMain.handle('db:updateProveedor', async (e, id, proveedor) => {
        try { return await db.updateProveedor(id, proveedor); } catch (e) { throw e; }
    });
    ipcMain.handle('db:deleteProveedor', async (e, id) => {
        try { return await db.deleteProveedor(id); } catch (e) { throw e; }
    });

    // ---------- PAGOS A PROVEEDORES ----------
    ipcMain.handle('db:getAllPagosProveedores', async () => {
        try { return await db.getAllPagosProveedores(); } catch { return []; }
    });
    ipcMain.handle('db:getPagosByProveedor', async (e, proveedorId) => {
        try { return await db.getPagosByProveedor(proveedorId); } catch { return []; }
    });
    ipcMain.handle('db:createPagoProveedor', async (e, pago) => {
        try { return await db.createPagoProveedor(pago); } catch (e) { throw e; }
    });
    ipcMain.handle('db:deletePagoProveedor', async (e, id) => {
        try { return await db.deletePagoProveedor(id); } catch (e) { throw e; }
    });
}

// ============ EVENTOS DE APLICACIÓN ============
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (db) db.close();
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

process.on('uncaughtException', (error) => {
    dialog.showErrorBox('Error Inesperado', 
        `Se produjo un error:\n\n${error.message}`
    );
});

process.on('unhandledRejection', (reason) => {
    // Silencioso
});