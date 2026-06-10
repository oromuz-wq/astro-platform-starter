@echo off
setlocal
cd /d "%~dp0"
title CONTACOL - Facturacion Electronica

cls
echo.
echo  =============================================
echo     CONTACOL - Facturacion Electronica COL
echo  =============================================
echo.

REM ---- Verificar contacol.html ----
if not exist contacol.html (
    echo  ERROR: contacol.html no encontrado en:
    echo  %CD%
    echo.
    echo  Descargue contacol.html y coloquelo en esta misma carpeta.
    echo.
    pause
    exit /b 1
)

REM ---- Proxy DIAN (puerto 3101) ----
echo  [1/3] Iniciando Proxy DIAN   ^(puerto 3101^)...
if exist proxy_dian.ps1 (
    start "Contacol - Proxy DIAN  :3101" powershell.exe -ExecutionPolicy Bypass -NoExit -File "%~dp0proxy_dian.ps1"
    echo        OK
) else (
    echo        FALTA proxy_dian.ps1  -  Las llamadas DIAN pueden fallar por CORS
)

REM ---- Proxy SIIGO (puerto 3100) ----
echo  [2/3] Iniciando Proxy SIIGO  ^(puerto 3100^)...
if exist proxy_siigo.ps1 (
    start "Contacol - Proxy SIIGO :3100" powershell.exe -ExecutionPolicy Bypass -NoExit -File "%~dp0proxy_siigo.ps1"
    echo        OK
) else (
    echo        FALTA proxy_siigo.ps1  -  SIIGO no funcionara desde PC
)

REM ---- Servidor Web (puerto 8080) ----
echo  [3/3] Iniciando Servidor Web ^(puerto 8080^)...

python3 --version >nul 2>&1
if %errorlevel% == 0 goto usar_python3

python --version >nul 2>&1
if %errorlevel% == 0 goto usar_python

goto sin_python

:usar_python3
start "Contacol - Servidor  :8080" cmd /c "python3 -m http.server 8080 2>&1 & pause"
goto servidor_ok

:usar_python
start "Contacol - Servidor  :8080" cmd /c "python -m http.server 8080 2>&1 & pause"
goto servidor_ok

:sin_python
echo        Python no instalado.
echo        Abriendo contacol.html sin servidor local...
echo.
echo  NOTA: Sin Python, DIAN y SIIGO podrian tener errores CORS.
echo  Instale Python desde python.org para mejor funcionamiento.
echo.
timeout /t 4 /nobreak >nul
start "" "%~dp0contacol.html"
echo  Listo. Cierre las ventanas de proxy cuando termine.
echo.
pause
exit /b

:servidor_ok
echo        OK
echo.

REM ---- Esperar que inicie el servidor ----
echo  Esperando que inicie el servidor...
timeout /t 3 /nobreak >nul

REM ---- Abrir navegador ----
start "" http://localhost:8080/contacol.html

echo.
echo  =============================================
echo   Contacol corriendo en:
echo   http://localhost:8080/contacol.html
echo.
echo   Proxies activos:
echo     DIAN  -> localhost:3101
echo     SIIGO -> localhost:3100
echo.
echo   Para CERRAR todo:
echo   Cierre esta ventana + las ventanas de proxy
echo  =============================================
echo.
pause
