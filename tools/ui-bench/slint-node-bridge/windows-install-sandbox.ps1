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
    $routes = (& node $bridge routes | Out-String) | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or
        $routes.schema -ne 'challenger.native.review-routes.v1' -or
        $routes.platform -ne 'win32' -or $routes.arch -ne 'x64' -or
        @($routes.ids).Count -gt 15 -or
        $routes.ids -notcontains 'curated:solvespace' -or
        $routes.ids -notcontains 'managed:pdfcraft' -or
        $routes.ids -contains 'research:pdfcraft' -or
        $routes.ids -contains 'managed:compositor') {
        throw 'Native review filter does not match real Windows reviewed adapters'
    }
    Write-Output 'NATIVE_WINDOWS_REVIEW_ROUTES_PASS'
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
        $result[0].historyPersisted -ne $true -or
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
    $history = (& node $bridge history | Out-String) | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or
        $history.schema -ne 'challenger.native.install-history.v1' -or
        @($history.entries | Where-Object {
            $_.projectId -eq 'curated:solvespace' -and $_.state -eq 'COMPLETED' -and
            $_.sha256 -eq $plan.sha256
        }).Count -ne 1) {
        throw 'First approved install not recorded as a verified durable completion'
    }
    # Exercise Native host -> bridge stdin -> worker cancel, only BEFORE
    # package commit. A cancel request must not kill an installer during swap.
    $beforeCancel = Get-Content -LiteralPath $meta -Raw
    $cancelScript = Join-Path $PSScriptRoot 'native-cancel-sandbox.mjs'
    if (-not (Test-Path $cancelScript)) { throw 'Missing native cancel QA harness' }
    $cancelOutput = & node $cancelScript $plan.approvalToken | Out-String
    if ($LASTEXITCODE -ne 0 -or $cancelOutput -notmatch 'NATIVE_COOPERATIVE_CANCEL_PASS') {
        throw 'End-to-end Native cooperative cancellation did not complete'
    }
    $afterCancelHash = (Get-FileHash -LiteralPath $installed.installedPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $lockPath = Join-Path $env:LOCALAPPDATA 'ChallengerNativePreview\install-state\.install.lock'
    if ($afterCancelHash -ne $bytesHash -or
        (Get-Content -LiteralPath $meta -Raw) -ne $beforeCancel -or
        (Test-Path -LiteralPath $lockPath)) {
        throw 'Cancelled install modified the previous app or left an orphaned lock'
    }
    $history = (& node $bridge history | Out-String) | ConvertFrom-Json
    if (@($history.entries | Where-Object {
        $_.projectId -eq 'curated:solvespace' -and $_.state -eq 'CANCELED'
    }).Count -ne 1) {
        throw 'Canceled approved attempt missing from durable history'
    }
    Write-Output 'WINDOWS_NATIVE_COOPERATIVE_CANCEL_PASS'
    # Inject a metadata-write failure into a SECOND reviewed SolveSpace install.
    # This fault is denied outside a disposable GitHub Windows runner. The prior
    # owned executable and managed-state bytes must be restored byte-for-byte.
    $priorState = Get-Content -LiteralPath $meta -Raw
    $env:CHALLENGER_CI_FAIL_STATE_WRITE = '1'
    try {
        $failureOutput = & node $bridge install 'curated:solvespace' $plan.approvalToken 2>&1 | Out-String
        $failureExit = $LASTEXITCODE
    } finally {
        Remove-Item Env:CHALLENGER_CI_FAIL_STATE_WRITE -ErrorAction SilentlyContinue
    }
    if ($failureExit -eq 0 -or $failureOutput -notmatch 'rolled-back' -or
        $failureOutput -notmatch 'CI-only injected managed install state-write failure' -or
        $failureOutput -match 'challenger.native.install-result.v1') {
        throw 'Injected metadata failure failed to trigger managed application rollback'
    }
    $restored = (Get-FileHash -LiteralPath $installed.installedPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($restored -ne $bytesHash -or (Get-Content -LiteralPath $meta -Raw) -ne $priorState) {
        throw 'Previous verified app or managed record was changed by failed install'
    }
    $history = (& node $bridge history | Out-String) | ConvertFrom-Json
    if (@($history.entries | Where-Object {
        $_.projectId -eq 'curated:solvespace' -and $_.state -eq 'FAILED'
    }).Count -ne 1) {
        throw 'Failed approved attempt missing from durable history'
    }
    Write-Output 'WINDOWS_NATIVE_INSTALL_ROLLBACK_PASS'
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
    # The actual Windows release must emit verifiable, pre-completion stage
    # events, including monotonic received-byte percentages (never a fake timer).
    $pdfStages = @($pdfRecords | Where-Object { $_.state -eq 'worker' } | ForEach-Object {
        try { $_.detail | ConvertFrom-Json } catch { $null }
    } | Where-Object { $null -ne $_ })
    $progress = @($pdfStages | Where-Object { $_.state -eq 'download-progress' } | ForEach-Object {
        [int]$_.detail
    })
    if ($progress.Count -lt 1 -or
        @($pdfStages | Where-Object { $_.state -eq 'verified' }).Count -lt 1 -or
        @($pdfStages | Where-Object { $_.state -eq 'installed' }).Count -lt 1) {
        throw 'PdfCraft installer lost its verified live progress events'
    }
    $last = 0
    foreach ($percent in $progress) {
        if ($percent -le $last -or $percent -gt 90 -or ($percent % 10) -ne 0) {
            throw 'PdfCraft byte progress must increase in exact bounded steps'
        }
        $last = $percent
    }
    if ($pdfResult.Count -ne 1 -or $pdfResult[0].state -ne 'success' -or
        $pdfResult[0].historyPersisted -ne $true -or
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
    $history = (& node $bridge history | Out-String) | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or
        @($history.entries | Where-Object {
            $_.projectId -eq 'managed:pdfcraft' -and $_.state -eq 'COMPLETED' -and
            $_.sha256 -eq $pdfPlan.sha256
        }).Count -ne 1 -or
        $history.incomplete -ne $false) {
        throw 'PdfCraft user-approved install not persisted in durable history'
    }
    $historyRaw = Get-Content -LiteralPath (Join-Path $env:LOCALAPPDATA 'ChallengerNativePreview\install-state\install-history.jsonl') -Raw
    if ($historyRaw.Contains($plan.approvalToken) -or $historyRaw.Contains($pdfPlan.approvalToken)) {
        throw 'Installer approval token leaked into the durable history file'
    }
    Write-Output 'WINDOWS_NATIVE_INSTALL_HISTORY_PASS'
    # Distinguish a real vetted worker commit from failure to publish the
    # separate native-user managed record. Never claim this is an ordinary
    # failed installation, nor emit a false completed result.
    $nativePrior = Get-Content -LiteralPath $meta -Raw
    $env:CHALLENGER_CI_FAIL_NATIVE_PUBLISH = '1'
    try {
        $publishOutput = & node $bridge install 'curated:solvespace' $plan.approvalToken 2>&1 | Out-String
        $publishExit = $LASTEXITCODE
    } finally {
        Remove-Item Env:CHALLENGER_CI_FAIL_NATIVE_PUBLISH -ErrorAction SilentlyContinue
    }
    if ($publishExit -eq 0 -or
        $publishOutput -notmatch 'NATIVE_INSTALL_NEEDS_REVIEW' -or
        $publishOutput -match 'challenger.native.install-result.v1') {
        throw 'Post-commit native state failure was incorrectly classified as success or ordinary failure'
    }
    $history = (& node $bridge history | Out-String) | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or @($history.entries | Where-Object {
        $_.projectId -eq 'curated:solvespace' -and
        $_.state -eq 'NEEDS_REVIEW' -and $_.sha256 -eq $plan.sha256
    }).Count -ne 1 -or
        (Get-Content -LiteralPath $meta -Raw) -ne $nativePrior -or
        (Get-FileHash -LiteralPath $installed.installedPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $bytesHash -or
        (Test-Path -LiteralPath $lockPath)) {
        throw 'Post-commit uncertainty changed managed state, lost previous EXE or lock persists'
    }
    Write-Output 'WINDOWS_NATIVE_POSTCOMMIT_UNCERTAINTY_PASS'
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
