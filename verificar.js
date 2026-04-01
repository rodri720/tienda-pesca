const fs = require('fs');
const path = require('path');

console.log('Ì¥ç Verificando build...');
const checks = [
  { file: 'package.json', required: true },
  { file: 'main.js', required: true },
  { file: 'database.js', required: true },
  { file: 'src/index.html', required: true },
  { file: 'src/punto-venta.html', required: true },
  { file: 'build/icon.ico', required: false, warn: '‚ö†Ô∏è  Sin icono, se usar√° uno por defecto' }
];

let allOk = true;
checks.forEach(check => {
  const exists = fs.existsSync(check.file);
  if (check.required && exists === false) {
    console.log('‚ùå FALTANTE:', check.file);
    allOk = false;
  } else if (exists === false && check.warn) {
    console.log(check.warn);
  } else {
    console.log('‚úÖ', check.file);
  }
});

if (allOk) {
  console.log('\nÌæØ ¬°TODO LISTO PARA BUILD!');
  console.log('Ejecuta: npm run build');
} else {
  console.log('\n‚ö†Ô∏è  Corrige los archivos faltantes primero');
}
