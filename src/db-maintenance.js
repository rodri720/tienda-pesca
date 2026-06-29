// Mantenimiento automático de la base de datos
const dbMaintenance = {
  // Ejecutar periódicamente (ej: cada 100 ventas)
  optimizarDB: async () => {
    try {
      // 1. VACUUM - Recupera espacio eliminado
      await window.api.dbExecute('VACUUM');
      
      // 2. ANALYZE - Optimiza consultas
      await window.api.dbExecute('ANALYZE');
      
      // 3. Limpiar registros temporales
      await window.api.dbExecute(`
        DELETE FROM sesiones_temporales 
        WHERE fecha < datetime('now', '-7 days')
      `);
      
      console.log('✅ Base de datos optimizada');
    } catch (error) {
      console.error('Error en mantenimiento:', error);
    }
  },

  // Respaldos automáticos
  crearBackup: async () => {
    const fs = require('fs');
    const path = require('path');
    
    const dbPath = window.api.getDatabasePath();
    const backupDir = path.join(path.dirname(dbPath), 'backups');
    
    // Crear directorio de backups si no existe
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const fecha = new Date().toISOString().slice(0, 10);
    const backupPath = path.join(backupDir, `backup_${fecha}.db`);
    
    // Copiar archivo de base de datos
    fs.copyFileSync(dbPath, backupPath);
    console.log(`✅ Backup creado: ${backupPath}`);
  },

  // Rotar backups - mantener solo últimos 30 días
  rotarBackups: async () => {
    const fs = require('fs');
    const path = require('path');
    
    const backupDir = path.join(path.dirname(window.api.getDatabasePath()), 'backups');
    
    if (fs.existsSync(backupDir)) {
      const archivos = fs.readdirSync(backupDir);
      const hoy = new Date();
      
      archivos.forEach(archivo => {
        const archivoPath = path.join(backupDir, archivo);
        const stats = fs.statSync(archivoPath);
        const dias = (hoy - stats.mtime) / (1000 * 60 * 60 * 24);
        
        if (dias > 30) {
          fs.unlinkSync(archivoPath);
          console.log(`🗑️  Backup eliminado: ${archivo} (${dias.toFixed(0)} días)`);
        }
      });
    }
  }
};

// Exportar para uso
window.dbMaintenance = dbMaintenance;