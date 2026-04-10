const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // ============ PRODUCTOS ============
  getAllProducts: () => ipcRenderer.invoke('db:getAllProducts'),
  getProductById: (id) => ipcRenderer.invoke('db:getProductById', id),
  createProduct: (producto) => ipcRenderer.invoke('db:createProduct', producto),
  updateProduct: (id, producto) => ipcRenderer.invoke('db:updateProduct', id, producto),
  deleteProduct: (id) => ipcRenderer.invoke('db:deleteProduct', id),
  searchProducts: (query) => ipcRenderer.invoke('db:searchProducts', query),
  
  // ============ CATEGORÍAS ============
  getCategories: () => ipcRenderer.invoke('db:getCategories'),
  
  // ============ SKU ============
  getNextSKU: (categoria, marca) => ipcRenderer.invoke('db:getNextSKU', categoria, marca),
  
  // ============ ESTADÍSTICAS ============
  getStats: () => ipcRenderer.invoke('db:getStats'),
  
  // ============ STOCK ============
  updateStock: (id, cantidad, operacion) => ipcRenderer.invoke('db:updateStock', id, cantidad, operacion),
  getLowStock: () => ipcRenderer.invoke('db:getLowStock'),
  
  // ============ PUNTO DE VENTA ============
  openPuntoVenta: () => ipcRenderer.invoke('app:openPuntoVenta'),
  getPriceList: (search) => ipcRenderer.invoke('db:getPriceList', search),
  
  // ============ GASTOS ============
  createGasto: (gasto) => ipcRenderer.invoke('db:createGasto', gasto),
  getTodayGastos: () => ipcRenderer.invoke('db:getTodayGastos'),
  
  // ============ VENTAS ============
  createVenta: (venta) => ipcRenderer.invoke('db:createVenta', venta),
  getVentasDelDia: () => ipcRenderer.invoke('db:getVentasDelDia'),
  getGastosDelDia: () => ipcRenderer.invoke('db:getGastosDelDia')
});