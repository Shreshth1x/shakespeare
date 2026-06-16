# Shakespeare PowerShell integration.
#
# Dot-source this file from your PowerShell profile, then press the configured
# chord while editing a command line to rewrite the current PSReadLine buffer
# through the Shakespeare backend.

$Script:ShakespeareRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

if (-not $env:SHAKESPEARE_COMPILE_BIN) {
  $env:SHAKESPEARE_COMPILE_BIN = Join-Path $Script:ShakespeareRoot "scripts\compile-prompt.mjs"
}

if (-not $env:SHAKESPEARE_POWERSHELL_KEY) {
  $env:SHAKESPEARE_POWERSHELL_KEY = "Ctrl+x,Ctrl+p"
}

function Invoke-ShakespearePromptRewrite {
  [CmdletBinding()]
  param()

  $line = $null
  $cursor = 0
  [Microsoft.PowerShell.PSConsoleReadLine]::GetBufferState([ref]$line, [ref]$cursor)

  if ([string]::IsNullOrWhiteSpace($line)) {
    [Microsoft.PowerShell.PSConsoleReadLine]::Ding()
    return
  }

  if (-not (Test-Path $env:SHAKESPEARE_COMPILE_BIN)) {
    [Microsoft.PowerShell.PSConsoleReadLine]::Ding()
    return
  }

  $node = if ($env:SHAKESPEARE_NODE) { $env:SHAKESPEARE_NODE } else { "node" }
  $mode = if ($env:SHAKESPEARE_PROMPT_MODE) { $env:SHAKESPEARE_PROMPT_MODE } else { "coding_agent" }
  $optimization = if ($env:SHAKESPEARE_OPTIMIZATION_MODE) { $env:SHAKESPEARE_OPTIMIZATION_MODE } else { "speed" }

  $processInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $processInfo.FileName = $node
  $processInfo.RedirectStandardInput = $true
  $processInfo.RedirectStandardOutput = $true
  $processInfo.RedirectStandardError = $true
  $processInfo.UseShellExecute = $false
  $processInfo.CreateNoWindow = $true
  [void]$processInfo.ArgumentList.Add($env:SHAKESPEARE_COMPILE_BIN)
  [void]$processInfo.ArgumentList.Add("--active-app")
  [void]$processInfo.ArgumentList.Add("PowerShell")
  [void]$processInfo.ArgumentList.Add("--window-title")
  [void]$processInfo.ArgumentList.Add((Get-Location).Path)
  [void]$processInfo.ArgumentList.Add("--mode")
  [void]$processInfo.ArgumentList.Add($mode)
  [void]$processInfo.ArgumentList.Add("--optimization")
  [void]$processInfo.ArgumentList.Add($optimization)

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $processInfo

  try {
    [void]$process.Start()
    $process.StandardInput.Write($line)
    $process.StandardInput.Close()

    if (-not $process.WaitForExit(7000)) {
      $process.Kill()
      [Microsoft.PowerShell.PSConsoleReadLine]::Ding()
      return
    }

    $optimized = $process.StandardOutput.ReadToEnd().TrimEnd([char[]]"`r`n")
    if ($process.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($optimized)) {
      [Microsoft.PowerShell.PSConsoleReadLine]::Ding()
      return
    }

    Set-ShakespearePromptBuffer $line $optimized
  } catch {
    [Microsoft.PowerShell.PSConsoleReadLine]::Ding()
  } finally {
    $process.Dispose()
  }
}

function Set-ShakespearePromptBuffer {
  param(
    [Parameter(Mandatory = $true)][string]$Original,
    [Parameter(Mandatory = $true)][string]$Replacement
  )

  try {
    [Microsoft.PowerShell.PSConsoleReadLine]::Replace(0, $Original.Length, $Replacement)
  } catch {
    [Microsoft.PowerShell.PSConsoleReadLine]::SetCursorPosition(0)
    [Microsoft.PowerShell.PSConsoleReadLine]::Delete($Original.Length)
    [Microsoft.PowerShell.PSConsoleReadLine]::Insert($Replacement)
  }
}

Set-PSReadLineKeyHandler `
  -Chord $env:SHAKESPEARE_POWERSHELL_KEY `
  -BriefDescription "ShakespeareRewrite" `
  -LongDescription "Rewrite the current prompt buffer with Shakespeare." `
  -ScriptBlock { Invoke-ShakespearePromptRewrite }
