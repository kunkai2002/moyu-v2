<#
  魔芋一夏 · 隧道常駐
  1) 確保本機服務在 47821 跑著
  2) 起 cloudflared quick tunnel
  3) 從 log 抓出公開網址，寫進 data\tunnel-url.txt
  保持執行直到被關掉。
#>
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$dataDir = Join-Path $root 'data'
$log = Join-Path $dataDir 'tunnel.log'
$urlFile = Join-Path $dataDir 'tunnel-url.txt'
$cf = Join-Path $root 'tools\bin\cloudflared.exe'
$port = 47821

if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Force $dataDir | Out-Null }

# 1) 服務
$listening = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
if (-not $listening) {
  Start-Process -FilePath 'node' -ArgumentList 'server.js', "--port=$port", "--data=$dataDir" `
    -WorkingDirectory $root -WindowStyle Hidden
  Start-Sleep -Seconds 2
}

# 2) 隧道
if (-not (Test-Path $cf)) { exit 1 }
Remove-Item $log -Force -ErrorAction SilentlyContinue
$proc = Start-Process -FilePath $cf `
  -ArgumentList 'tunnel','--url',"http://127.0.0.1:$port",'--no-autoupdate','--logfile',$log,'--loglevel','info' `
  -PassThru -WindowStyle Hidden

# 3) 抓網址
$url = $null
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path $log) {
    $m = Select-String -Path $log -Pattern 'https://[a-z0-9\-]+\.trycloudflare\.com' -AllMatches |
         Select-Object -First 1
    if ($m) { $url = $m.Matches[0].Value; break }
  }
}
if ($url) {
  "$url/m/" | Set-Content -Path $urlFile -Encoding utf8 -NoNewline
}

# 4) 常駐
$proc.WaitForExit()
Remove-Item $urlFile -Force -ErrorAction SilentlyContinue
