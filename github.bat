@echo off
set /p msg="Digite a mensagem do commit: "
if "%msg%"=="" set msg="update: sincronizacao automatica via github.bat"

echo.
echo === Iniciando Sincronizacao ===
git add .
git commit -m "%msg%"
git push origin main

echo.
echo === Concluido com Sucesso! ===
pause
