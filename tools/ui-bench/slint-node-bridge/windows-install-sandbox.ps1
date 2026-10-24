# Real Windows e2e installation in an EPHEMERAL GitHub-hosted runner only.
# Do not run on a workstation or an existing D:\Velvet directory.
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows' -or
    -not $env:RUNNER_TEMP -or -not $env:GITHUB_RUN_ID) {
    throw 'Windows installer QA is restricted to GitHub-hosted Windows CI'
}
if (-not (Test-Path 'D:\')) { throw 'Expected Windows CI D: drive unavailable' }
if (Test-Path 'D:\Velvet') {
    throw 'Refusing a runner with pre-existing D:\Velvet'
}
$bridge = Join-Path $PSScriptRoot 'install-bridge.mjs'
if (-not (Test-Path $bridge)) { throw 'Native installer bridge missing' }
$working = Join-Path $env:RUNNER_TEMP ('challenger-native-install-' + $env:GITHUB_RUN_ID)
if (Test-Path $working) { throw 'Refusing pre-existing CI sandbox folder' }
$originalLocalAppData = $env:LOCALAPPDATA
$createdDriveRoot = $false
try {
    New-Item -ItemType Directory -Path $working | Out-Null
    $env:LOCALAPPDATA = Join-Path $working 'native-state'
    New-Item -ItemType Directory -Path $env:LOCALAPPDATA | Out-Null
    New-Item -ItemType Directory -Path 'D:\Velvet' | Out-Null
    $createdDriveRoot = $true
    $planText = & node $bridge plan 'curated:solvespace' | Out-String
    if ($LASTEXITCODE -ne 0) { throw 'Official SolveSpace install plan refused' }
    $plan = $planText | ConvertFrom-Json
    if ($plan.projectId -ne 'curated:solvespace' -or
        $plan.repository -ne 'solvespace/solvespace' -or
        $plan.assetName -ne 'solvespace_x64.exe' -or
        $plan.platform -ne 'win32' -or
        $plan.requiresUserApproval -ne $true -or
        $plan.approvalToken -notmatch '^[a-f0-9]{64}$') {
        throw 'Untrusted Windows portable install plan'
    }
    # Explicit test-only approval on a disposable runner; never on a user PC.
    $output = & node $bridge install 'curated:solvespace' $plan.approvalToken | Out-String
    if ($LASTEXITCODE -ne 0) { throw 'Vetted Windows install worker failed' }
    $records = $output.Trim() -split '[\r\n]+' | ForEach-Object {
        try { $_ | ConvertFrom-Json } catch { $null }
    }
    $result = @($records | Where-Object { $_.schema -eq 'challenger.native.install-result.v1' })
    if ($result.Count -ne 1 -or $result[0].state -ne 'success' -or
        $result[0].sourceDigestVerified -ne $true -or
        $result[0].projectId -ne $plan.projectId -or
        $result[0].sha256 -ne $plan.sha256) {
        throw 'Windows native installation did not match approved SHA-256 plan'
    }
    $meta = Join-Path $env:LOCALAPPDATA 'ChallengerNativePreview\install-state\managed-installs.json'
    if (-not (Test-Path $meta)) { throw 'Isolated install record missing' }
    $installed = (Get-Content -LiteralPath $meta -Raw | ConvertFrom-Json).installed.solvespace
    $expected = 'D:\Velvet\Installers\ChallengerHub\Managed\solvespace\'
    if ($installed.repository -ne $plan.repository -or
        $installed.sha256 -ne $plan.sha256 -or
        $installed.version -ne $plan.tag -or
        $installed.managed -ne $true -or
        (-not $installed.installedPath.StartsWith($expected,[StringComparison]::OrdinalIgnoreCase)) -or
        (-not (Test-Path -LiteralPath $installed.installedPath))) {
        throw 'Windows installed executable does not match approved source'
    }
    # The reviewed exe-portable adapter copies the verified EXE byte-for-byte.
    $bytesHash = (Get-FileHash -LiteralPath $installed.installedPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($bytesHash -ne $plan.sha256) { throw 'Installed EXE SHA-256 mismatch' }
    # Exercise PdfCraft's new managed route on the disposable runner only.
    # It must never silently become a generic installer for all 14 managed apps.
    $pdfPlanText = & node $bridge plan 'managed:pdfcraft' | Out-String
    if ($LASTEXITCODE -ne 0) { throw 'Verified PdfCraft plan refused' }
    $pdfPlan = $pdfPlanText | ConvertFrom-Json
    if ($pdfPlan.projectId -ne 'managed:pdfcraft' -or
        $pdfPlan.repository -ne 'storytold/pdfcraft' -or
        $pdfPlan.kind -ne 'zip' -or
        $pdfPlan.assetName -notmatch '^pdfcraft-[0-9.]+-windows-x64-portable\.zip$' -or
        $pdfPlan.sha256 -notmatch '^[a-f0-9]{64}$' -or
        $pdfPlan.approvalToken -notmatch '^[a-f0-9]{64}$' -or
        $pdfPlan.requiresUserApproval -ne $true -or
        $pdfPlan.sourceDigestVerifiedAfterDownload -ne $false) {
        throw 'PdfCraft plan is not exact-source and portable-asset verified'
    }
    $pdfOutput = & node $bridge install 'managed:pdfcraft' $pdfPlan.approvalToken | Out-String
    if ($LASTEXITCODE -ne 0) { throw 'PdfCraft verified portable install failed' }
    $pdfRecords = $pdfOutput.Trim() -split '[\r\n]+' | ForEach-Object {
        try { $_ | ConvertFrom-Json } catch { $null }
    }
    $pdfResult = @($pdfRecords | Where-Object { $_.schema -eq 'challenger.native.install-result.v1' })
    if ($pdfResult.Count -ne 1 -or $pdfResult[0].state -ne 'success' -or
        $pdfResult[0].sourceDigestVerified -ne $true -or
        $pdfResult[0].projectId -ne $pdfPlan.projectId -or
        $pdfResult[0].sha256 -ne $pdfPlan.sha256) {
        throw 'PdfCraft installed result does not match user-review-equivalent approval'
    }
    $pdfInstalled = (Get-Content -LiteralPath $meta -Raw | ConvertFrom-Json).installed.pdfcraft
    $pdfExpected = 'D:\Velvet\Installers\ChallengerHub\Managed\pdfcraft\'
    if ($pdfInstalled.repository -ne 'storytold/pdfcraft' -or
        $pdfInstalled.sha256 -ne $pdfPlan.sha256 -or
        $pdfInstalled.version -ne $pdfPlan.tag -or
        $pdfInstalled.managed -ne $true -or
        $pdfInstalled.installedPath -notlike ($pdfExpected + '*') -or
        -not (Test-Path -LiteralPath $pdfInstalled.installedPath)) {
        throw 'PdfCraft tracked portable EXE missing or outside isolated app root'
    }
    Write-Output ('PDFCRAFT_NATIVE_INSTALL_SANDBOX_PASS ' + (@{
        projectId=$pdfPlan.projectId; tag=$pdfPlan.tag; sha256=$pdfPlan.sha256;
        verifiedInstalledExecutable=$true; isolatedMetadata=$true;
        appInstalledOnUsersDevice=$false; ciOnly=$true
    } | ConvertTo-Json -Compress))
    Write-Output ('WINDOWS_NATIVE_INSTALL_SANDBOX_PASS ' + (@{
        projectId=$plan.projectId; tag=$plan.tag; sha256=$bytesHash;
        verifiedInstalledExecutable=$true; isolatedMetadata=$true;
        appInstalledOnUsersDevice=$false; ciOnly=$true
    } | ConvertTo-Json -Compress))
} finally {
    $env:LOCALAPPDATA = $originalLocalAppData
    if ($createdDriveRoot -and (Test-Path 'D:\Velvet')) {
        Remove-Item 'D:\Velvet' -Recurse -Force -ErrorAction Stop
    }
    if (Test-Path $working) { Remove-Item $working -Recurse -Force }
}
