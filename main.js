const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const Database = require('./database.js');

let mainWindow;
let puntoVentaWindow = null;  // Variable para la ventana de punto de venta
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
    console.log('✅ Ventana principal cargada correctamente');
  });

  createMenu();

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// FUNCIÓN CORREGIDA para crear ventana de punto de venta
function createPuntoVentaWindow() {
  console.log('🛒 Creando ventana de Punto de Venta...');
  
  // Si ya existe una ventana, enfocarla en lugar de crear otra
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
      preload: path.join(__dirname, 'preload.js'),  // ¡IMPORTANTE!
      sandbox: true,
      enableRemoteModule: false,
      webSecurity: true
    },
    show: true,
    backgroundColor: '#f0f2f5'
  });

  // Construir la ruta correcta
  const puntoVentaPath = path.join(__dirname, 'src', 'punto-venta.html');
  console.log('📁 Cargando punto de venta desde:', puntoVentaPath);
  
  // Verificar si el archivo existe
  if (!fsSync.existsSync(puntoVentaPath)) {
    console.error('❌ Archivo no encontrado:', puntoVentaPath);
    dialog.showErrorBox('Error', `No se encuentra el archivo:\n${puntoVentaPath}`);
    return null;
  }
  
  puntoVentaWindow.loadFile(puntoVentaPath);
  
  puntoVentaWindow.once('ready-to-show', () => {
    console.log('✅ Punto de Venta cargado correctamente');
  });
  
  // Limpiar referencia cuando se cierre la ventana
  puntoVentaWindow.on('closed', () => {
    puntoVentaWindow = null;
    console.log('📪 Ventana de Punto de Venta cerrada');
  });
  
  // Abrir DevTools para debug
  if (process.env.NODE_ENV === 'development') {
    puntoVentaWindow.webContents.openDevTools();
  }
  
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
            if (focusedWindow) {
              focusedWindow.reload();
            }
          }
        },
        {
          label: 'Herramientas de Desarrollo',
          accelerator: 'F12',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.toggleDevTools();
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ============ INICIALIZACIÓN ============

console.log('🚀 Iniciando aplicación Tienda de Pesca...');

const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'tienda-pesca.db');

console.log(`📁 Ruta de datos: ${userDataPath}`);
console.log(`🗃️ Base de datos: ${dbPath}`);

// Inicializar base de datos
app.whenReady().then(async () => {
  try {
    db = new Database(dbPath);
    console.log('🎣 Aplicación lista, creando ventana...');
    createWindow();
  } catch (error) {
    console.error('❌ Error crítico inicializando base de datos:', error.message);
    dialog.showErrorBox('Error Crítico', 
      `No se pudo inicializar la base de datos:\n${error.message}`
    );
    app.quit();
  }
});

// ============ IPC HANDLERS ============

// Productos
ipcMain.handle('db:getAllProducts', async () => {
  try {
    return await db.getAllProducts();
  } catch (error) {
    console.error('❌ Error en getAllProducts:', error.message);
    return [];
  }
});

ipcMain.handle('db:getProductById', async (event, id) => {
  try {
    return await db.getProductById(id);
  } catch (error) {
    console.error('❌ Error en getProductById:', error.message);
    return null;
  }
});

ipcMain.handle('db:createProduct', async (event, producto) => {
  try {
    console.log('📝 Recibiendo producto para crear:', producto.nombre);
    return await db.createProduct(producto);
  } catch (error) {
    console.error('❌ Error en createProduct:', error.message);
    throw error;
  }
});

ipcMain.handle('db:getCategories', async () => {
  try {
    return await db.getCategories();
  } catch (error) {
    console.error('❌ Error en getCategories:', error.message);
    return [];
  }
});

// SKU Generation
ipcMain.handle('db:getNextSKU', async (event, categoria, marca = '') => {
  try {
    console.log(`🎯 IPC: Generando SKU para "${categoria}" - "${marca}"`);
    const sku = await db.getNextSKU(categoria, marca);
    console.log(`🎯 IPC: SKU generado: "${sku}"`);
    return sku;
  } catch (error) {
    console.error('❌ Error en getNextSKU:', error.message);
    return 'GEN-0001';
  }
});

ipcMain.handle('db:getStats', async () => {
  try {
    return await db.getStatistics();
  } catch (error) {
    console.error('❌ Error en getStats:', error.message);
    return {
      total_productos: 0,
      total_stock: 0,
      agotados: 0,
      bajo_stock: 0,
      valor_inventario: 0
    };
  }
});

ipcMain.handle('db:searchProducts', async (event, query) => {
  try {
    return await db.searchProducts(query);
  } catch (error) {
    console.error('❌ Error en searchProducts:', error.message);
    return [];
  }
});

// Stock
ipcMain.handle('db:updateStock', async (event, id, cantidad, operacion) => {
  try {
    return await db.updateStock(id, cantidad, operacion);
  } catch (error) {
    console.error('❌ Error en updateStock:', error.message);
    throw error;
  }
});

ipcMain.handle('db:getLowStock', async () => {
  try {
    return await db.getLowStockProducts();
  } catch (error) {
    console.error('❌ Error en getLowStock:', error.message);
    return [];
  }
});

// Imágenes
ipcMain.handle('file:selectImage', async () => {
  try {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Seleccionar imagen del producto',
      filters: [
        { name: 'Imágenes', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
        { name: 'Todos los archivos', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (filePaths && filePaths.length > 0) {
      return filePaths[0];
    }
    return null;
  } catch (error) {
    console.error('❌ Error seleccionando imagen:', error);
    return null;
  }
});

ipcMain.handle('file:saveImage', async (event, imagePath) => {
  try {
    if (imagePath && fsSync.existsSync(imagePath)) {
      const uploadsPath = path.join(userDataPath, 'uploads');
      if (!fsSync.existsSync(uploadsPath)) {
        fsSync.mkdirSync(uploadsPath, { recursive: true });
      }
      
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const ext = path.extname(imagePath);
      const filename = `producto_${timestamp}_${random}${ext}`;
      const destination = path.join(uploadsPath, filename);
      
      await fs.copyFile(imagePath, destination);
      console.log(`📷 Imagen guardada: ${filename}`);
      
      return filename;
    }
    return '';
  } catch (error) {
    console.error('❌ Error guardando imagen:', error);
    return '';
  }
});

// Handler para abrir punto de venta DESDE EL RENDERER
ipcMain.handle('app:open-punto-venta', async () => {
  try {
    const window = createPuntoVentaWindow();
    if (window) {
      return { success: true };
    } else {
      return { success: false, error: 'No se pudo crear la ventana' };
    }
  } catch (error) {
    console.error('❌ Error en open-punto-venta:', error.message);
    return { success: false, error: error.message };
  }
});

// Eventos del menú
ipcMain.on('menu:nuevo-producto', () => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('navigate:to', 'nuevo-producto');
  }
});

ipcMain.on('menu:ver-productos', () => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('navigate:to', 'productos');
  }
});

// ============ EVENTOS DE LA APP ============

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  console.log('👋 Cerrando aplicación...');
  if (process.platform !== 'darwin') {
    if (db) {
      db.close();
    }
    app.quit();
  }
});

// Manejo de errores
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error);
  if (mainWindow) {
    dialog.showErrorBox('Error Inesperado', 
      `Se produjo un error inesperado:\n\n${error.message}`
    );
  }
  if (db) {
    db.close();
  }
  app.quit();
});

console.log('✨ Tienda de Pesca - Sistema inicializado correctamente');