const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const Database = require('./database.js');

let mainWindow;
let puntoVentaWindow = null;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true,
      enableRemoteModule: false,
      webSecurity: true
    },
    show: false,
    backgroundColor: '#f0f2f5'
  });

  mainWindow.loadFile('src/index.html');
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  createMenu();
}

function createPuntoVentaWindow() {
  if (puntoVentaWindow && !puntoVentaWindow.isDestroyed()) {
    puntoVentaWindow.focus();
    return puntoVentaWindow;
  }
  
  puntoVentaWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true,
      enableRemoteModule: false,
      webSecurity: true
    },
    show: true,
    backgroundColor: '#f0f2f5'
  });

  const puntoVentaPath = path.join(__dirname, 'src', 'punto-venta.html');
  
  if (!fsSync.existsSync(puntoVentaPath)) {
    dialog.showErrorBox('Error', `No se encuentra el archivo:\n${puntoVentaPath}`);
    return null;
  }
  
  puntoVentaWindow.loadFile(puntoVentaPath);
  
  puntoVentaWindow.on('closed', () => {
    puntoVentaWindow = null;
  });
  
  return puntoVentaWindow;
}

function createMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Nuevo Producto',
          accelerator: 'Ctrl+N',
          click: () => mainWindow.webContents.send('menu:nuevo-producto')
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
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Productos',
      submenu: [
        {
          label: 'Ver Todos los Productos',
          accelerator: 'Ctrl+P',
          click: () => mainWindow.webContents.send('menu:ver-productos')
        }
      ]
    },
    {
      label: 'Ventana',
      submenu: [
        {
          label: 'Recargar',
          accelerator: 'Ctrl+R',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) focusedWindow.reload();
          }
        }
        // La opción F12 ha sido eliminada para evitar apertura accidental
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'tienda-pesca.db');

app.whenReady().then(async () => {
  try {
    db = new Database(dbPath);
    await db.initDatabase();
    createWindow();
  } catch (error) {
    dialog.showErrorBox('Error Crítico', 
      `No se pudo inicializar la base de datos:\n${error.message}`
    );
    app.quit();
  }
});

// IPC Handlers (sin console.log)
ipcMain.handle('db:getAllProducts', async () => {
  try { return await db.getAllProducts(); } catch { return []; }
});
ipcMain.handle('db:getProductById', async (event, id) => {
  try { return await db.getProductById(id); } catch { return null; }
});
ipcMain.handle('db:createProduct', async (event, producto) => {
  try { return await db.createProduct(producto); } catch (error) { throw error; }
});
ipcMain.handle('db:getCategories', async () => {
  try { return await db.getCategories(); } catch { return []; }
});
ipcMain.handle('db:getNextSKU', async (event, categoria, marca = '') => {
  try { return await db.getNextSKU(categoria, marca); } catch { return 'GEN-0001'; }
});
ipcMain.handle('db:getStats', async () => {
  try { return await db.getStatistics(); } catch { return { total_productos: 0, total_stock: 0, agotados: 0, bajo_stock: 0, valor_inventario: 0 }; }
});
ipcMain.handle('db:searchProducts', async (event, query) => {
  try { return await db.searchProducts(query); } catch { return []; }
});
ipcMain.handle('db:updateStock', async (event, id, cantidad, operacion) => {
  try { return await db.updateStock(id, cantidad, operacion); } catch (error) { throw error; }
});
ipcMain.handle('db:getLowStock', async () => {
  try { return await db.getLowStockProducts(); } catch { return []; }
});
ipcMain.handle('file:selectImage', async () => {
  try {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Seleccionar imagen',
      filters: [{ name: 'Imágenes', extensions: ['jpg','jpeg','png','gif','webp'] }, { name: 'Todos', extensions: ['*'] }],
      properties: ['openFile']
    });
    return filePaths?.[0] || null;
  } catch { return null; }
});
ipcMain.handle('file:saveImage', async (event, imagePath) => {
  try {
    if (!imagePath || !fsSync.existsSync(imagePath)) return '';
    const uploadsPath = path.join(userDataPath, 'uploads');
    if (!fsSync.existsSync(uploadsPath)) fsSync.mkdirSync(uploadsPath, { recursive: true });
    const filename = `producto_${Date.now()}_${Math.random().toString(36).substring(7)}${path.extname(imagePath)}`;
    await fs.copyFile(imagePath, path.join(uploadsPath, filename));
    return filename;
  } catch { return ''; }
});
ipcMain.handle('app:open-punto-venta', async () => {
  try { return { success: !!createPuntoVentaWindow() }; } catch (error) { return { success: false, error: error.message }; }
});
ipcMain.handle('dialog:show', async (event, options) => {
  try {
    if (options.type !== 'input') return null;
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: options.title || 'Entrada',
      message: options.message || '',
      buttons: ['Aceptar', 'Cancelar'],
      defaultId: 0,
      cancelId: 1,
      inputs: [{ type: 'text', value: options.defaultValue || '', placeholder: options.placeholder || '' }]
    });
    return result.response === 0 ? { value: result.inputs[0], confirmed: true } : { value: null, confirmed: false };
  } catch { return null; }
});
ipcMain.handle('dialog:messageBox', async (event, options) => {
  try {
    const result = await dialog.showMessageBox(mainWindow, {
      type: options.type || 'info',
      title: options.title || 'Mensaje',
      message: options.message || '',
      buttons: options.buttons || ['OK'],
      defaultId: 0,
      cancelId: 1
    });
    return { response: result.response, confirmed: result.response === 0 };
  } catch { return { response: 0, confirmed: false }; }
});

ipcMain.on('menu:nuevo-producto', () => {
  if (mainWindow) mainWindow.webContents.send('navigate:to', 'nuevo-producto');
});
ipcMain.on('menu:ver-productos', () => {
  if (mainWindow) mainWindow.webContents.send('navigate:to', 'productos');
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (db) db.close();
    app.quit();
  }
});
process.on('uncaughtException', (error) => {
  if (mainWindow) dialog.showErrorBox('Error Inesperado', `Se produjo un error:\n\n${error.message}`);
  if (db) db.close();
  app.quit();
});