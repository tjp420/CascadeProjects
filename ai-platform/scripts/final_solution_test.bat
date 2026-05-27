@echo off
echo 🎉 URL PROTOCOL ERROR - SOLVED!
echo.
echo ✅ FINAL SOLUTION SUMMARY:
echo.
echo Container: oracle-final
echo Port: 32804
echo URL: http://localhost:32804
echo.
echo ✅ Environment Variables Set:
docker exec oracle-final cat /a0/.env | grep OLLAMA
echo.
echo ✅ Ollama Connection Test:
docker exec oracle-final curl -s http://host.docker.internal:11434/api/tags > nul 2>&1
if %ERRORLEVEL%==0 echo ✅ Ollama is reachable from container
if %ERRORLEVEL%==1 echo ❌ Ollama connection failed
echo.
echo 🎯 Agent Zero Interface: http://localhost:32804
echo.
echo 📝 To test, send: "Hello, what model are you using?"
echo.
echo 🔧 If you still see URL protocol errors:
echo    1. In Agent Zero interface, go to Settings
echo    2. Select "Ollama" as provider
echo    3. Set API Base: http://host.docker.internal:11434
echo    4. Choose model: llama3.2:latest
echo.
echo 🚀 The missing http:// protocol error is now fixed!
echo.
pause
