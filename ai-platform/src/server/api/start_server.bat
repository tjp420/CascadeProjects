@echo off
echo Starting AI Code Analysis API Server...
echo.
echo API Server will be available at:
echo   - Code Structure: http://localhost:8080/api/code-structure
echo   - File Structure: http://localhost:8080/api/file-structure  
echo   - AI Recommendations: http://localhost:8080/api/ai-recommendations
echo   - Health Check: http://localhost:8080/api/health
echo.
echo Press Ctrl+C to stop the server
echo.

python server.py

pause
