# ============================================================
#  Contacol - Proxy SIIGO Nube  (proxy_siigo.ps1)
#  Coloque este archivo en la misma carpeta que iniciar_contacol
#  Puerto: http://localhost:3100
# ============================================================

$ErrorActionPreference = "SilentlyContinue"
$port = 3100
$targetBase = "https://api.siigo.com"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   CONTACOL - Proxy SIIGO Nube" -ForegroundColor Cyan
Write-Host "   Puerto : http://localhost:$port" -ForegroundColor Cyan
Write-Host "   Destino: $targetBase" -ForegroundColor Cyan
Write-Host "   Presione Ctrl+C para detener" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "[OK] Proxy iniciado. Esperando conexiones..." -ForegroundColor Green
} catch {
    Write-Host "[ERROR] No se pudo iniciar el proxy: $_" -ForegroundColor Red
    Write-Host "Intente ejecutar PowerShell como Administrador." -ForegroundColor Yellow
    Read-Host "Presione Enter para cerrar"
    exit 1
}

while ($listener.IsListening) {
    try {
        $context  = $listener.GetContext()
        $request  = $context.Request
        $response = $context.Response

        # --- CORS preflight ---
        $response.Headers.Add("Access-Control-Allow-Origin",  "*")
        $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization, Partner-Id, x-api-key")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 204
            $response.Close()
            continue
        }

        $targetUrl = $targetBase + $request.Url.PathAndQuery
        Write-Host "  -> $($request.HttpMethod) $($request.Url.PathAndQuery)" -ForegroundColor DarkGray

        # --- Construir peticion hacia SIIGO ---
        $webReq = [System.Net.WebRequest]::Create($targetUrl)
        $webReq.Method  = $request.HttpMethod
        $webReq.Timeout = 30000
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

        $skipHeaders = @("Host","Content-Length","Transfer-Encoding","Connection","Expect")
        foreach ($h in $request.Headers.AllKeys) {
            if ($h -notin $skipHeaders) {
                try { $webReq.Headers[$h] = $request.Headers[$h] } catch {}
            }
        }

        if ($request.HasEntityBody) {
            $webReq.ContentType = $request.ContentType
            $buf = New-Object byte[] 65536
            $reqStream = $webReq.GetRequestStream()
            $inStream  = $request.InputStream
            while (($read = $inStream.Read($buf, 0, $buf.Length)) -gt 0) {
                $reqStream.Write($buf, 0, $read)
            }
            $reqStream.Close()
        }

        # --- Leer respuesta de SIIGO ---
        try {
            $webResp = $webReq.GetResponse()
        } catch [System.Net.WebException] {
            $webResp = $_.Exception.Response
        }

        if ($webResp) {
            $response.StatusCode  = [int]$webResp.StatusCode
            $response.ContentType = $webResp.ContentType
            $respStream = $webResp.GetResponseStream()
            $respStream.CopyTo($response.OutputStream)
            $webResp.Close()
        } else {
            $response.StatusCode = 502
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes('{"error":"No response from SIIGO"}')
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }

    } catch {
        try {
            $response.StatusCode = 500
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("{`"error`":`"$_`"}")
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        } catch {}
    } finally {
        try { $response.Close() } catch {}
    }
}
