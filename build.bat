@echo off
:: Build script Windows — crée la distribution autonome monewe-windows-x64
:: Prérequis : Node.js, npm, Python 3, node-gyp (npm install -g node-gyp)
setlocal enabledelayedexpansion

set APP=monewe
set DIST=dist

echo =^> Build %APP% standalone Windows
if not exist %DIST% mkdir %DIST%

:: ------------------------------------------------------------------
:: Étape 1 : Bundle JS avec esbuild
:: ------------------------------------------------------------------
echo --^> Bundle esbuild...
call npx --yes esbuild server.js ^
  --bundle ^
  --platform=node ^
  --format=cjs ^
  --target=node18 ^
  --outfile=%DIST%\server.cjs ^
  --external:better-sqlite3 ^
  "--banner:js=var __import_meta_url=require('url').pathToFileURL(__filename);" ^
  "--define:import.meta.url=__import_meta_url"
if errorlevel 1 ( echo ERREUR esbuild & exit /b 1 )

:: ------------------------------------------------------------------
:: Étape 2 : Créer la structure de distribution
:: ------------------------------------------------------------------
set DIR=%DIST%\%APP%-windows-x64
if exist "%DIR%" rmdir /s /q "%DIR%"
mkdir "%DIR%\node_modules\better-sqlite3\build\Release"
mkdir "%DIR%\node_modules\better-sqlite3\lib"
mkdir "%DIR%\node_modules\bindings"
mkdir "%DIR%\node_modules\file-uri-to-path"

for /f "tokens=*" %%i in ('where node') do set NODE_EXE=%%i
copy "%NODE_EXE%" "%DIR%\node.exe"

copy "%DIST%\server.cjs" "%DIR%\server.cjs"

copy "node_modules\better-sqlite3\build\Release\better_sqlite3.node" ^
     "%DIR%\node_modules\better-sqlite3\build\Release\better_sqlite3.node"
xcopy /e /q "node_modules\better-sqlite3\lib"          "%DIR%\node_modules\better-sqlite3\lib\"
copy        "node_modules\better-sqlite3\package.json" "%DIR%\node_modules\better-sqlite3\"
xcopy /e /q "node_modules\bindings"                    "%DIR%\node_modules\bindings\"
xcopy /e /q "node_modules\file-uri-to-path"            "%DIR%\node_modules\file-uri-to-path\"

xcopy /e /q "public" "%DIR%\public\"
copy ".env.example" "%DIR%\.env.example"

(
  echo @echo off
  echo cd /d "%%~dp0"
  echo echo Demarrage de monewe...
  echo echo Ouvrez http://localhost:3000 dans votre navigateur
  echo node.exe server.cjs
  echo pause
) > "%DIR%\start.bat"

powershell -Command "Compress-Archive -Path '%DIR%' -DestinationPath '%DIST%\%APP%-windows-x64.zip' -Force"
echo     Pret : %DIST%\%APP%-windows-x64.zip

echo.
echo =^> Termine !
