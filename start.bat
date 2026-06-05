@echo off
REM ===========================================
REM START HONEYPOT SOC
REM Reanuda todos los contenedores del SOC
REM ===========================================
echo Iniciando el SOC de Honeypots...
docker compose start
if %errorlevel% equ 0 (
    echo.
    echo [OK] Todos los contenedores iniciados.
    echo.
    echo Accesos:
    echo   - n8n:       http://localhost:5678
    echo   - Grafana:   http://localhost:3000
    echo   - Nginx:     http://localhost
    echo.
    echo Para ver el estado: docker compose ps
) else (
    echo [ERROR] Hubo un problema al iniciar los contenedores.
    echo Revise con: docker compose logs
)
pause
