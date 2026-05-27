#!/bin/bash

# Create the method content
cat > /tmp/method.txt << 'EOF'
    async def _direct_ollama_call(self, model, messages, **kwargs):
        import requests
        import asyncio
        
        # Convert messages to Ollama format
        ollama_messages = []
        for msg in messages:
            if isinstance(msg, dict):
                role = msg.get("role", "user")
                content = msg.get("content", "")
            else:
                role = "user"
                content = str(msg)
            ollama_messages.append({"role": role, "content": content})
        
        # Handle model name
        if model.startswith(("openrouter/", "anthropic/", "openai/")):
            model = "llama3.2:latest"
        
        payload = {
            "model": model,
            "messages": ollama_messages,
            "stream": False,
            "options": {
                "temperature": kwargs.get("temperature", 0.7),
                "num_predict": kwargs.get("max_tokens", 2048)
            }
        }
        
        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: requests.post("http://host.docker.internal:11434/api/chat", json=payload, timeout=30)
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result.get("message", {}).get("content", "")
                
                class Response:
                    def __init__(self, content):
                        self.choices = [{"message": {"content": content}}]
                
                return Response(content)
            else:
                error_msg = f"Ollama error: {response.status_code}"
                class Response:
                    def __init__(self):
                        self.choices = [{"message": {"content": error_msg}}]
                return Response()
        except Exception as e:
            error_msg = f"Error: {str(e)}"
            class Response:
                def __init__(self):
                    self.choices = [{"message": {"content": error_msg}}]
            return Response()

EOF

# Copy the method file to container
docker cp /tmp/method.txt agent-zero-working:/tmp/method.txt

# Find the line number of unified_call
LINE_NUM=$(docker exec agent-zero-working grep -n "async def unified_call" /a0/models.py | cut -d: -f1)

# Insert the method before unified_call
docker exec agent-zero-working sh -c "head -n $((LINE_NUM - 1)) /a0/models.py > /tmp/models_before.py"
docker exec agent-zero-working sh -c "cat /tmp/method.txt >> /tmp/models_before.py"
docker exec agent-zero-working sh -c "tail -n +$LINE_NUM /a0/models.py >> /tmp/models_before.py"

# Replace the file
docker exec agent-zero-working sh -c "mv /tmp/models_before.py /a0/models.py"

echo "✅ Method added successfully!"
docker restart agent-zero-working
