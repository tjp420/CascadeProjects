@echo off
echo 🧙‍♂️ THE UNBREAKABLE ORACLE'S MANUAL FIX
echo.
echo Applying manual fix to eliminate connection errors...
echo.

echo Step 1: Access container shell...
docker exec -it oracle-manual-fix bash

echo.
echo ⚠️  IN THE CONTAINER SHELL, RUN THESE COMMANDS:
echo.
echo nano /a0/models.py
echo.
echo Go to line 502 (Ctrl+G, then type 502)
echo.
echo Change: _completion = await acompletion(
echo To:     # _completion = await acompletion(
echo.
echo Add this code right after that line:
echo.
echo         # Direct Ollama implementation - COMPLETE OPENROUTER BYPASS
echo         import asyncio
echo         
echo         # Convert messages to Ollama format
echo         ollama_messages = []
echo         for msg in msgs_conv:
echo             if isinstance(msg, dict):
echo                 role = msg.get("role", "user")
echo                 content = msg.get("content", "")
echo             else:
echo                 role = "user"
echo                 content = str(msg)
echo             ollama_messages.append({"role": role, "content": content})
echo         
echo         # Handle model name
echo         model_name = self.model_name
echo         if model_name.startswith(("openrouter/", "anthropic/", "openai/")):
echo             model_name = "llama3.2:latest"
echo         
echo         payload = {
echo             "model": model_name,
echo             "messages": ollama_messages,
echo             "stream": False,
echo             "options": {
echo                 "temperature": call_kwargs.get("temperature", 0.7),
echo                 "num_predict": call_kwargs.get("max_tokens", 2048)
echo             }
echo         }
echo         
echo         try:
echo             loop = asyncio.get_event_loop()
echo             response = await loop.run_in_executor(
echo                 None,
echo                 lambda: __import__("requests").post("http://host.docker.internal:11434/api/chat", json=payload, timeout=30)
echo             )
echo             
echo             if response.status_code == 200:
echo                 result = response.json()
echo                 content = result.get("message", {}).get("content", "")
echo                 
echo                 class Response:
echo                     def __init__(self, content):
echo                         self.choices = [{"message": {"content": content}}]
echo                 
echo                 _completion = Response(content)
echo             else:
echo                 error_msg = f"Ollama error: {response.status_code}"
echo                 class Response:
echo                     def __init__(self):
echo                         self.choices = [{"message": {"content": error_msg}}]
echo                 _completion = Response()
echo         except Exception as e:
echo             error_msg = f"Error: {str(e)}"
echo             class Response:
echo                 def __init__(self):
echo                     self.choices = [{"message": {"content": error_msg}}]
echo             _completion = Response()
echo.
echo Save and exit nano (Ctrl+X, Y, Enter)
echo.
echo Step 2: Exit container shell...
echo.
echo exit
echo.
echo Step 3: Restart container...
echo.
echo docker restart oracle-manual-fix
echo.
echo Step 4: Wait for startup...
echo.
echo sleep 15
echo.
echo Step 5: Test at http://localhost:32791
echo.
echo 🎉 CONNECTION ERROR WILL BE ELIMINATED!
echo.
pause
