# Corre la suite de tests de soc-api de forma autocontenida.
#
# Uso (desde cualquier ubicacion):
#   powershell -ExecutionPolicy Bypass -File api\run-tests.ps1
#
# Que hace:
#   1. Crea el venv (.venv) e instala requirements-dev.txt si no existe.
#   2. Levanta el contenedor desechable soc-test-postgres (127.0.0.1:54329)
#      si no esta corriendo; lo reutiliza si ya existe.
#   3. Espera a Postgres y ejecuta pytest con el interprete del venv.
#
# NOTA: las credenciales del contenedor de test estan hardcodeadas a proposito
# en tests/conftest.py (solo test, nunca produccion).

$ErrorActionPreference = "Stop"
$apiDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# --- 1. Venv ---
$venvPython = Join-Path $apiDir ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Host "[1/3] Creando venv e instalando dependencias..." -ForegroundColor Cyan
    & python -m venv (Join-Path $apiDir ".venv")
    & $venvPython -m pip install --quiet --upgrade pip
    & $venvPython -m pip install --quiet -r (Join-Path $apiDir "requirements-dev.txt")
} else {
    Write-Host "[1/3] venv existente OK" -ForegroundColor Green
}

# --- 2. Contenedor Postgres de pruebas ---
Write-Host "[2/3] Asegurando soc-test-postgres..." -ForegroundColor Cyan
$running = docker ps --format "{{.Names}}" | Select-String -Quiet "^soc-test-postgres$"
if (-not $running) {
    $exists = docker ps -a --format "{{.Names}}" | Select-String -Quiet "^soc-test-postgres$"
    if ($exists) {
        docker start soc-test-postgres | Out-Null
    } else {
        docker run -d --name soc-test-postgres `
            -e POSTGRES_USER=soc_test `
            -e POSTGRES_PASSWORD=soc_test_pw `
            -e POSTGRES_DB=soc_test `
            -p 127.0.0.1:54329:5432 `
            postgres:16-alpine | Out-Null
    }
}

# Esperar a que acepte conexiones (max 30s)
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    $h = docker exec soc-test-postgres pg_isready -U soc_test 2>$null
    if ("$h" -match "accepting connections") { $ready = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $ready) { throw "soc-test-postgres no respondio en 30s" }
Write-Host "      Postgres de pruebas listo" -ForegroundColor Green

# --- 3. pytest ---
Write-Host "[3/3] Corriendo pytest..." -ForegroundColor Cyan
Push-Location $apiDir
try {
    & $venvPython -m pytest @args
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
