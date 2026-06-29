@echo off
echo 🎣 Tienda de Pesca - Sistema de Gestión
echo ========================================
echo.

REM Verificar archivos .exe
if exist "dist\Tienda de Pesca Pro-1.0.0-portable.exe" (
    echo [1] Ejecutar versión PORTABLE (sin instalar)
    echo.
)

if exist "dist\Tienda de Pesca Pro Setup 1.0.0.exe" (
    echo [2] Instalar versión COMPLETA
    echo.
)

if exist "dist\win-unpacked\Tienda de Pesca Pro.exe" (
    echo [3] Ejecutar desde win-unpacked/
    echo.
)

echo [4] Abrir carpeta dist/
echo [5] Salir
echo.

set /p opcion="Elige una opción (1-5): "

if "%opcion%"=="1" (
    echo Abriendo versión portable...
    start "" "dist\Tienda de Pesca Pro-1.0.0-portable.exe"
) else if "%opcion%"=="2" (
    echo Iniciando instalador...
    start "" "dist\Tienda de Pesca Pro Setup 1.0.0.exe"
) else if "%opcion%"=="3" (
    echo Ejecutando desde win-unpacked...
    start "" "dist\win-unpacked\Tienda de Pesca Pro.exe"
) else if "%opcion%"=="4" (
    echo Abriendo carpeta dist...
    explorer "dist"
) else (
    echo Saliendo...
)

pause