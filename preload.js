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
  getGastosDelDia: () => ipcRenderer.invoke('db:getGastosDelDia'),      // alias
  getGastosByDate: (fecha) => ipcRenderer.invoke('db:getGastosByDate', fecha),
  getGastosSummary: (fecha) => ipcRenderer.invoke('db:getGastosSummary', fecha),
  deleteGasto: (id) => ipcRenderer.invoke('db:deleteGasto', id),
  
  // ============ VENTAS ============
  createVenta: (venta) => ipcRenderer.invoke('db:createVenta', venta),
  getVentasDelDia: () => ipcRenderer.invoke('db:getVentasDelDia'),
  getVentasByDate: (fecha) => ipcRenderer.invoke('db:getVentasByDate', fecha),
  
  // ============ CIERRES ============
  createCierre: (cierre) => ipcRenderer.invoke('db:createCierre', cierre),
  getCierres: (limit) => ipcRenderer.invoke('db:getCierres', limit),
  
  // ============ CAJA DIARIA ============
  saveCajaDiaria: (resumen) => ipcRenderer.invoke('db:saveCajaDiaria', resumen),
  getCajaDiaria: (fecha) => ipcRenderer.invoke('db:getCajaDiaria', fecha),
  getHistorialCaja: (limit) => ipcRenderer.invoke('db:getHistorialCaja', limit),
  
  // ============ PROVEEDORES ============
  getAllProveedores: () => ipcRenderer.invoke('db:getAllProveedores'),
  getProveedorById: (id) => ipcRenderer.invoke('db:getProveedorById', id),
  createProveedor: (proveedor) => ipcRenderer.invoke('db:createProveedor', proveedor),
  updateProveedor: (id, proveedor) => ipcRenderer.invoke('db:updateProveedor', id, proveedor),
  deleteProveedor: (id) => ipcRenderer.invoke('db:deleteProveedor', id),
  
  // ============ PAGOS A PROVEEDORES ============
  getAllPagosProveedores: () => ipcRenderer.invoke('db:getAllPagosProveedores'),
  getPagosByProveedor: (proveedorId) => ipcRenderer.invoke('db:getPagosByProveedor', proveedorId),
  createPagoProveedor: (pago) => ipcRenderer.invoke('db:createPagoProveedor', pago),
  deletePagoProveedor: (id) => ipcRenderer.invoke('db:deletePagoProveedor', id)
});