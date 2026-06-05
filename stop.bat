@echo off
REM ===========================================
REM STOP HONEYPOT SOC
REM Detiene todos los contenedores sin borrar datos
REM ===========================================
echo Deteniendo el SOC de Honeypots...
docker compose stop
if %errorlevel% equ 0 (
    echo.
    echo [OK] Todos los contenedores detenidos.
    echo [OK] Los datos estan a salvo.
    echo.
    echo Para reanudar: ejecute start.bat
) else (
    echo [ERROR] Hubo un problema al detener los contenedores.
)
pause
