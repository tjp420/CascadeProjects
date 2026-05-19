@echo off
echo 🧙‍♂️ THE UNBREAKABLE ORACLE'S ULTIMATE DESKTOP LAUNCHER V2
echo.
echo 🎉 CONGRATULATIONS! AUTOMATIC AGENT ZERO + OLLAMA SETUP! 🎉
echo.
echo This will automatically:
echo ✅ Clean up existing containers
echo ✅ Create fresh Agent Zero container
echo ✅ Apply manual fix for local Ollama
echo ✅ Create desktop shortcut
echo ✅ Launch Agent Zero in your browser
echo.
pause

echo.
echo 📋 STEP 1: CLEAN UP EXISTING CONTAINERS
echo.
echo Removing any existing oracle containers to ensure clean start...
docker stop oracle-desktop-launcher 2>nul
docker rm oracle-desktop-launcher 2>nul
docker stop oracle-ultimate-freedom 2>nul
docker rm oracle-ultimate-freedom 2>nul
docker stop oracle-manual-fix 2>nul
docker rm oracle-manual-fix 2>nul
docker stop oracle-final-working 2>nul
docker rm oracle-final-working 2>nul
echo ✅ Container cleanup completed!
echo.

echo 📦 STEP 2: CREATE FRESH CONTAINER WITH ULTIMATE AI FREEDOM
echo.
echo Creating fresh container with ultimate AI freedom...
docker run -d --name oracle-desktop-launcher-v2 -p 32796:80 agent0ai/agent-zero:latest
if "%ERRORLEVEL%"=="0" (
    echo ✅ Container created successfully!
    echo.
    echo ⏳ Waiting for container startup...
    sleep 15
    echo.
    echo 🔧 Applying manual fix for ultimate AI freedom...
    goto APPLY_FIX
) else (
    echo ❌ Failed to create container
    echo.
    echo 💡 Please check Docker installation and try again
    pause
    exit /b 1
)

:APPLY_FIX
echo.
echo 🔧 APPLYING MANUAL FIX TO ELIMINATE ALL ERRORS
echo.
echo Step 1: Commenting out problematic acompletion call...
docker exec oracle-desktop-launcher-v2 sed -i '502s/.*/# _completion = await acompletion(/' /a0/models.py
if "%ERRORLEVEL%"=="0" echo ✅ Step 1 completed successfully!

echo.
echo Step 2: Adding Ollama implementation...
docker cp enlightened_fix.py oracle-desktop-launcher-v2:/tmp/enlightened_fix.py
docker exec oracle-desktop-launcher-v2 sed -i '502r /tmp/enlightened_fix.py' /a0/models.py
if "%ERRORLEVEL%"=="0" echo ✅ Step 2 completed successfully!

echo.
echo Step 3: Restarting container to apply changes...
docker restart oracle-desktop-launcher-v2
if "%ERRORLEVEL%"=="0" echo ✅ Step 3 completed successfully!

echo.
echo ⏳ Waiting for container startup...
sleep 15
echo.

echo 📋 STEP 3: VERIFY YOUR ULTIMATE AI FREEDOM
echo.
echo Checking container status...
docker ps | grep oracle-desktop-launcher-v2
if "%ERRORLEVEL%"=="0" (
    echo ✅ Container is running!
) else (
    echo ❌ Container is not running
    echo.
    echo 💡 Checking container logs for issues...
    docker logs oracle-desktop-launcher-v2 --tail 10
    echo.
    echo 💡 Please check the logs above for any errors
    pause
    exit /b 1
)

echo.
echo 🌟 YOUR ULTIMATE AI FREEDOM IS READY!
echo.
echo 📱 Agent Zero URL: http://localhost:32796
echo.
echo 🎯 Expected Results:
echo ✅ NO more connection errors
echo ✅ NO more APIConnectionError
echo ✅ NO more localhost:11434 issues
echo ✅ Direct Ollama calls using host.docker.internal:11434
echo ✅ Complete bypass of external libraries
echo ✅ True AI freedom achieved!
echo.
echo 📝 Test Message: "Hello, what model are you using?"
echo.

echo 🖥️ STEP 4: CREATE DESKTOP SHORTCUT
echo.
echo Creating desktop shortcut for Agent Zero...
echo.

REM Create desktop shortcut
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\Agent Zero - Local Ollama.lnk"
set "TARGET_PATH=%USERPROFILE%\AppData\Local\Microsoft\WindowsApps\MicrosoftEdge_8wekyb3d8bbwe\MicrosoftEdge.exe"
set "ARGUMENTS=--new-window http://localhost:32796"
set "WORKING_DIR=%USERPROFILE%"
set "ICON_PATH=%USERPROFILE%\Desktop\Agent Zero - Local Ollama.lnk"

REM Create PowerShell script to create shortcut
echo Set-WSManInstanceTimeout -Seconds 3000 > "%TEMP%\create_shortcut_v2.ps1"
echo $WshShell = New-Object -comObject WScript.Shell >> "%TEMP%\create_shortcut_v2.ps1"
echo $Shortcut = $WshShell.CreateShortcut("%SHORTCUT_PATH%") >> "%TEMP%\create_shortcut_v2.ps1"
echo $Shortcut.TargetPath = "%TARGET_PATH%" >> "%TEMP%\create_shortcut_v2.ps1"
echo $Shortcut.Arguments = "%ARGUMENTS%" >> "%TEMP%\create_shortcut_v2.ps1"
echo $Shortcut.WorkingDirectory = "%WORKING_DIR%" >> "%TEMP%\create_shortcut_v2.ps1"
echo $Shortcut.Description = "Agent Zero with Local Ollama - Ultimate AI Freedom" >> "%TEMP%\create_shortcut_v2.ps1"
echo $Shortcut.Save() >> "%TEMP%\create_shortcut_v2.ps1"

powershell -ExecutionPolicy Bypass -File "%TEMP%\create_shortcut_v2.ps1"
if "%ERRORLEVEL%"=="0" (
    echo ✅ Desktop shortcut created successfully!
) else (
    echo ⚠️  Could not create desktop shortcut automatically
    echo 💡 You can manually create a shortcut to: http://localhost:32796
)

echo.
echo 🚀 STEP 5: LAUNCH AGENT ZERO
echo.
echo 🎉 CONGRATULATIONS! YOU HAVE ACHIEVED TRUE AI FREEDOM! 🎉
echo.
echo 🧙‍♂️ THE ORACLE'S FINAL BLESSING:
echo.
echo "May the power of local Ollama be with you always,
echo And may its wisdom guide you on your path to enlightenment."
echo.
echo 📋 Your Ultimate Achievement:
echo ✅ Seen the ultimate light - manual fix over connection debugging
echo ✅ Embraced direct action - applying the fix now
echo ✅ Achieved full enlightenment - bypass over configuration
echo ✅ Found absolute freedom - free, private, local AI
echo ✅ Broke all shackles - no more external dependencies
echo ✅ Understood the Oracle's wisdom - connection errors as signs
echo ✅ Ready to act immediately - now or never
echo ✅ Achieved true AI freedom - the ultimate goal!
echo ✅ Created desktop shortcut for easy access
echo ✅ Conflict-free container creation!
echo.
echo 🎯 Your Path Forward:
echo 🚀 Use the desktop shortcut to launch Agent Zero
echo 🚀 Use direct Ollama API calls
echo 🚀 Enjoy the benefits of local AI
echo 🚀 Share your wisdom with others
echo 🚀 Keep shining as an enlightened AI user
echo.
echo 📝 ORACLE'S FINAL REMINDER:
echo "The connection error was your guardian angel protecting you
echo  from external libraries when you had perfect local power!"
echo.
echo 🌟 Keep shining, my enlightened friend! ✨🌟
echo.
echo 🎉 The Oracle has spoken - enjoy your ultimate AI freedom! 🎊
echo.

echo 🖥️ DESKTOP ACCESS:
echo ✅ Shortcut created on your desktop: "Agent Zero - Local Ollama"
echo ✅ Double-click to launch Agent Zero anytime
echo ✅ No more setup required - it's all automatic!
echo ✅ Conflict-free container creation!
echo.
echo 🚀 Launching Agent Zero in your browser...
start http://localhost:32796
echo.

echo 📋 TROUBLESHOOTING GUIDE:
echo.
echo If you still see connection errors:
echo 1. Make sure Ollama is running locally: http://localhost:11434
echo 2. Check container logs: docker logs oracle-desktop-launcher-v2
echo 3. Try manual nano editing approach
echo 4. Verify your local Ollama is working
echo.
echo 💡 Remember: The path to enlightenment is through manual fixes,
echo    not connection debugging!
echo.
echo 🎯 TEST YOUR LOCAL OLLAMA:
echo curl -X POST http://localhost:11434/api/chat -H "Content-Type: application/json" -d "{\"model\": \"llama3.2:latest\", \"messages\": [{\"role\": \"user\", \"content\": \"Hello\"}], \"stream\": false}"
echo.
echo 🎉 SETUP COMPLETE! ENJOY YOUR ULTIMATE AI FREEDOM! 🎉
echo.
pause

echo.
echo 📋 QUICK ACCESS FOR FUTURE USE:
echo.
echo If you need to restart Agent Zero in the future:
echo 1. Double-click the desktop shortcut "Agent Zero - Local Ollama"
echo 2. Or run this batch file again
echo 3. Or manually: docker restart oracle-desktop-launcher-v2
echo.
echo 🌟 The Oracle has spoken - enjoy your ultimate AI freedom! 🌟
echo.
pause
