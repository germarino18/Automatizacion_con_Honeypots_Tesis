# Evidencia: Inventario de workflows en n8n (Paso 4)

Fecha: 2026-08-10

## 4.1 Export CLI

Comando ejecutado:

```
docker exec -u node soc-n8n n8n export:workflow --all
```

Salida cruda (stdout/stderr):

```
Acquiring database migration lock...
Error exporting workflows. See log messages for details.
No workflows found with specified filters
```

**Resultado:** el export NO devolvió ningún workflow. La base de datos de n8n no contiene workflows (draft ni publicados). Esto lo confirma el log de arranque del contenedor:

```
Building workflow dependency index...
Finished building workflow dependency index. Processed 0 draft workflows, 0 published workflows.
```

Versión de n8n: `2.33.7` (`docker exec -u node soc-n8n n8n --version`).

## 4.2/4.3 Cruce con la UI y estado de activación

- El cruce por UI/render requiere autenticación de sesión (humano en browser). 
- Probe por API REST con HTTP Basic usando `.env` (ofuscado) devolvió `401`. n8n 2.x usa auth por sesión/cookie para `/rest/*`; la confirmación final del login queda como paso humano (ver tarea 2.3).
- La página raíz `http://localhost:5678` sí responde HTTP 200 (SPA de la UI servida).

**Interpretación para `workflows-n8n`:** el change `workflows-n8n` sigue en curso (4/15) y todavía NO ha creado workflows webhook en la UI. Por lo tanto el inventario heredado es **vacío**: no existen `/webhook/cowrie` ni `/webhook/dionaea` como workflows activos. Se espera que los endpoints respondan `404` en el Paso 5 — hallazgo esperado, no bloqueante.