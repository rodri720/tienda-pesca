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

// ============ VENTANA PRINCIPAL ============
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true // Esto solo habilita la capacidad, no las abre
    },
    show: false,
    backgroundColor: '#f0f2f5'
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // ELIMINADO: mainWindow.webContents.openDevTools();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Limpiar caché al iniciar
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

    puntoVentaWindow = new BrowserWindow({
      width: 1300,
      height: 850,
      icon: path.join(__dirname, 'assets', 'icon.ico'),
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
      // ELIMINADO: puntoVentaWindow.webContents.openDevTools({ mode: 'detach' });
    });

    puntoVentaWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      // Error silencioso, no mostramos en consola
    });

    puntoVentaWindow.on('closed', () => {
      puntoVentaWindow = null;
    });

    puntoVentaWindow.on('unresponsive', () => {
      // Silencioso
    });

    puntoVentaWindow.on('responsive', () => {
      // Silencioso
    });

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

  // ============ PRODUCTOS ============
  ipcMain.handle('db:getAllProducts', async () => {
    try { return await db.getAllProducts(); } 
    catch { return []; }
  });

  ipcMain.handle('db:getProductById', async (e, id) => {
    try { return await db.getProductById(id); } 
    catch { return null; }
  });

  ipcMain.handle('db:createProduct', async (e, producto) => {
    try { return await db.createProduct(producto); } 
    catch (e) { throw e; }
  });

  ipcMain.handle('db:updateProduct', async (e, id, producto) => {
    try { return await db.updateProduct(id, producto); } 
    catch (e) { throw e; }
  });

  ipcMain.handle('db:deleteProduct', async (e, id) => {
    try { return await db.deleteProduct(id); } 
    catch (e) { throw e; }
  });

  ipcMain.handle('db:searchProducts', async (e, query) => {
    try { return await db.searchProducts(query); } 
    catch { return []; }
  });

  // ============ CATEGORÍAS ============
  ipcMain.handle('db:getCategories', async () => {
    try { return await db.getCategories(); } 
    catch { return []; }
  });

  // ============ SKU ============
  ipcMain.handle('db:getNextSKU', async (e, categoria, marca) => {
    try { return await db.getNextSKU(categoria, marca); } 
    catch { return 'GEN-0001'; }
  });

  // ============ ESTADÍSTICAS ============
  ipcMain.handle('db:getStats', async () => {
    try { return await db.getStatistics(); } 
    catch { return db.getDefaultStats(); }
  });

  // ============ STOCK ============
  ipcMain.handle('db:updateStock', async (e, id, cantidad, operacion) => {
    try { return await db.updateStock(id, cantidad, operacion); } 
    catch (e) { throw e; }
  });

  ipcMain.handle('db:getLowStock', async () => {
    try { return await db.getLowStockProducts(); } 
    catch { return []; }
  });

  // ============ PUNTO DE VENTA ============
  ipcMain.handle('app:openPuntoVenta', async () => {
    const window = createPuntoVentaWindow();
    return { success: window !== null };
  });

  ipcMain.handle('db:getPriceList', async (e, search) => {
    try { return await db.getPriceList(search); } 
    catch { return []; }
  });

  // ============ GASTOS ============
  ipcMain.handle('db:createGasto', async (e, gasto) => {
    try { return await db.createGasto(gasto); } 
    catch (e) { throw e; }
  });

  ipcMain.handle('db:getTodayGastos', async () => {
    try { return await db.getTodayGastos(); } 
    catch { return []; }
  });
}

// ============ INICIALIZACIÓN ============
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

// Manejo de errores no capturados (silencioso pero con diálogo si es necesario)
process.on('uncaughtException', (error) => {
  dialog.showErrorBox('Error Inesperado', 
    `Se produjo un error:\n\n${error.message}`
  );
});

process.on('unhandledRejection', (reason) => {
  // No hacemos nada con promesas rechazadas no manejadas
});