@echo off
echo 🧙‍♂️ TESTING AGENT ZERO + LOCAL OLLAMA CONNECTION
echo.
echo ✅ Container Status:
docker ps | findstr oracle-working
echo.
echo ✅ Ollama Connection Test:
docker exec oracle-working curl -s http://host.docker.internal:11434/api/tags | findstr "llama3.2"
echo.
echo ✅ Environment Variables:
docker exec oracle-working cat /a0/.env | grep OLLAMA
echo.
echo 🎯 Agent Zero URL: http://localhost:32802
echo.
echo 📝 Test with: "Hello, what model are you using?"
echo.
echo 🚀 If you still see errors, use the interface to:
echo    1. Go to Settings/Configuration
echo    2. Select "Ollama" as provider
echo    3. Set URL to: http://host.docker.internal:11434
echo    4. Choose model: llama3.2:latest
echo.
pause
