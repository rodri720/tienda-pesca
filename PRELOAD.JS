const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Base de datos
  getAllProducts: () => ipcRenderer.invoke('db:getAllProducts'),
  getProductById: (id) => ipcRenderer.invoke('db:getProductById', id),
  createProduct: (producto) => ipcRenderer.invoke('db:createProduct', producto),
  getCategories: () => ipcRenderer.invoke('db:getCategories'),
  getStats: () => ipcRenderer.invoke('db:getStats'),
  updateStock: (id, cantidad, operacion) => ipcRenderer.invoke('db:updateStock', id, cantidad, operacion),
  getLowStock: () => ipcRenderer.invoke('db:getLowStock'),
  searchProducts: (query) => ipcRenderer.invoke('db:searchProducts', query),
  
  // SKU Generation
  getNextSKU: (categoria, marca) => ipcRenderer.invoke('db:getNextSKU', categoria, marca),
  
  // Manejo de imágenes
  selectImage: () => ipcRenderer.invoke('file:selectImage'),
  saveImage: (imagePath) => ipcRenderer.invoke('file:saveImage', imagePath),
  
  // Eventos del menú
  onMenuNavigate: (callback) => {
    ipcRenderer.on('navigate:to', (event, page) => callback(page));
  },
  openPuntoVenta: () => ipcRenderer.invoke('app:open-punto-venta'),
  navigateTo: (page) => ipcRenderer.send('navigate:to', page),
  
  // Info del sistema
  getAppInfo: () => ({
    version: '1.0.0',
    name: 'Tienda de Pesca',
    developer: 'Software Personalizado'
  })
});

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform
});