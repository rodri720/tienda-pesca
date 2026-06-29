// crear-icono.js
const fs = require('fs');
const { execSync } = require('child_process');
const { createCanvas } = require('canvas');

console.log('🎨 Creando icono para Tienda de Pesca...');

// 1. Crear carpeta build si no existe
if (!fs.existsSync('build')) {
  fs.mkdirSync('build', { recursive: true });
}

// 2. Crear icono PNG
const canvas = createCanvas(256, 256);
const ctx = canvas.getContext('2d');

// Fondo
ctx.fillStyle = '#1a8c8a';
ctx.fillRect(0, 0, 256, 256);

// Texto/icono
ctx.fillStyle = 'white';
ctx.font = 'bold 120px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('🎣', 128, 128);

// Guardar PNG
const pngBuffer = canvas.toBuffer('image/png');
fs.writeFileSync('build/icon.png', pngBuffer);
console.log('✅ PNG creado: build/icon.png');

// 3. Intentar convertir a ICO (si tienes ImageMagick)
try {
  // Verificar si ImageMagick está instalado
  execSync('magick --version', { stdio: 'ignore' });
  
  // Convertir PNG a ICO
  execSync('magick convert build/icon.png -define icon:auto-resize=256,128,64,48,32,16 build/icon.ico');
  console.log('✅ ICO creado: build/icon.ico');
  
} catch (error) {
  console.log('\n⚠️  ImageMagick no está instalado.');
  console.log('📝 Sigue estos pasos:');
  console.log('   1. Ve a: https://convertio.co/es/png-ico/');
  console.log('   2. Sube build/icon.png');
  console.log('   3. Descarga como icon.ico');
  console.log('   4. Colócalo en: build/icon.ico');
  console.log('\n🎯 O instala ImageMagick:');
  console.log('   https://imagemagick.org/script/download.php');
}