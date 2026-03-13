@echo off
title AgentXL Setup
echo.
echo  ┌──────────────────────────────────────┐
echo  │         AgentXL Quick Setup          │
echo  └──────────────────────────────────────┘
echo.

:: ── Step 1: Check Node.js ─────────────────────────────────────────────
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo  ❌ Node.js not found. Install Node.js 20+ from https://nodejs.org
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo  ✅ Node.js %NODE_VER%

:: ── Step 2: Install AgentXL ───────────────────────────────────────────
echo.
echo  📦 Installing AgentXL...
call npm install -g agentxl
if %ERRORLEVEL% neq 0 (
    echo  ❌ npm install failed
    pause
    exit /b 1
)
echo  ✅ AgentXL installed

:: ── Step 3: Find manifest path ────────────────────────────────────────
for /f "tokens=*" %%i in ('npm root -g') do set NPM_GLOBAL=%%i
set MANIFEST=%NPM_GLOBAL%\agentxl\manifest\manifest.xml
if not exist "%MANIFEST%" (
    echo  ❌ Could not find manifest at %MANIFEST%
    pause
    exit /b 1
)
echo  ✅ Manifest: %MANIFEST%

:: ── Step 4: Register add-in with Excel ────────────────────────────────
echo.
echo  📎 Registering AgentXL with Excel...
set ENABLE_SCRIPT=%NPM_GLOBAL%\agentxl\scripts\enable-excel-addin.mjs
if exist "%ENABLE_SCRIPT%" (
    node "%ENABLE_SCRIPT%" "%MANIFEST%"
    echo  ✅ Add-in registered
) else (
    echo  ⚠️  enable-excel-addin.mjs not found, skipping auto-registration
    echo     You can manually add the manifest folder to Excel Trust Center:
    echo     %NPM_GLOBAL%\agentxl\manifest
)

:: ── Step 5: Start server ──────────────────────────────────────────────
echo.
echo  🚀 Starting AgentXL server...
echo  ─────────────────────────────────────────
echo.
call agentxl start
