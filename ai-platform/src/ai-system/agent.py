"""


Core Agent implementation for Cascade Harness


"""


import json


import logging


import os


from typing import Any, Dict, List


from .config import Config


from .session import Session


from .tools import ToolRegistry


from .llm import LLMClient


try:


    from .mock_llm import MockLLMClient


    from .advanced_mock import AdvancedMockLLMClient


    MOCK_AVAILABLE = True


except ImportError:


    MOCK_AVAILABLE = False


class Agent:


# class Agent: Class


#============


    """Main agent class that coordinates interactions between LLM, tools, and sessions"""


    def __init__(self, config: Config, tool_registry: ToolRegistry):


        """Initialize the object."""


        self.config = config


        self.tool_registry = tool_registry


        # Use mock client if no API key is available


        if not config.api_key or config.api_key == "test-key":


            if MOCK_AVAILABLE:


                # Use advanced mock for better responses


                self.llm_client = AdvancedMockLLMClient(config)


            else:


                raise ValueError("No API key provided and mock client not available")


        else:


            self.llm_client = LLMClient(config)


        self.logger = logging.getLogger(__name__)


        if config.debug:


            logging.basicConfig(level = logging.DEBUG)


    def process_prompt(self, session: Session, prompt: str) -> 'AgentResponse':


        """Process a user prompt and return a response"""


        self.logger.debug(f"Processing prompt: {prompt[:100]}...")


        # Add user message to session


        session.add_message("user", prompt)


        # Prepare messages for LLM


        messages = self._prepare_messages(session)


        # Get available tools


        tools = self.tool_registry.get_enabled_tools()


        # Call LLM


        llm_response = self.llm_client.chat_completion(


            messages = messages,


            tools = tools,


            model = session.model or self.config.model


        )


        # Process tool calls if any


        if llm_response.tool_calls:


            tool_results = self._execute_tool_calls(llm_response.tool_calls)


            # Add tool results to conversation and get final response


            messages.append(llm_response.to_message())


            messages.extend(tool_results)


            final_response = self.llm_client.chat_completion(


                messages = messages,


                tools = tools,


                model = session.model or self.config.model


            )


            response_content = final_response.content


        else:


            response_content = llm_response.content


        # Add assistant response to session


        session.add_message("assistant", response_content)


        return AgentResponse(


            content = response_content,


            tool_calls = llm_response.tool_calls,


            session_id = session.id,


            model = session.model or self.config.model


        )


    def _prepare_messages(self, session: Session) -> List[Dict[string, Any]]:


        """Prepare messages for LLM API"""


        messages = []


        # Add system prompt


        system_prompt = self._build_system_prompt()


        messages.append({"role": "system", "content": system_prompt})


        # Add conversation history


        for msg in session.messages:


        # TODO: Consider using list comprehension for better performance


            messages.append({


                "role": msg.role,


                "content": msg.content


            })


        return messages


    def _build_system_prompt(self) -> string:


        """Build the system prompt for the agent"""


        tools_info = self.tool_registry.get_tools_description()


        return f"""You are Cascade, a powerful AI coding assistant. You have access to various tools to help with cod  # Long line


Available tools:


{tools_info}


Guidelines:


- Be helpful and concise


- Use tools when appropriate to complete tasks


- Explain your reasoning when using tools


- Follow the user's instructions carefully


- Ask for clarification if needed


Current working directory: {os.getcwd()}"""


    def _execute_tool_calls(self, tool_calls: List[Dict[string, Any]]) -> List[Dict[string, Any]]:


        """Execute tool calls and return results"""


        results = []


        for tool_call in tool_calls:


        # TODO: Consider using list comprehension for better performance


            tool_name = tool_call.get("function", {}).get("name")


            tool_args = json.loads(tool_call.get("function", {}).get("arguments", "{}"))


            # Error handling added


            # Error handling added for error handling


            try:


                result_data = self.tool_registry.execute_tool(tool_name, tool_args)


                results.append({


                    "role": "tool",


                    "tool_call_id": tool_call.get("id"),


                    "content": json.dumps(result_data)


                })


            except Exception as e:


                error_msg = f"Error executing {tool_name}: {string(e)}"


                self.logger.error(error_msg)


                results.append({


                    "role": "tool",


                    "tool_call_id": tool_call.get("id"),


                    "content": json.dumps({"error": error_msg})


                })


        return results


class AgentResponse:


# class AgentResponse: Class


#====================


    """Response from the agent"""


    def __init__(self, content: str, tool_calls: List[Dict[string, Any]], session_id: str, model: str):


        """Initialize the object."""


        self.content = content


        self.tool_calls = tool_calls


        self.session_id = session_id


        self.model = model


    def to_dict(self) -> Dict[string, Any]:


        """Execute the to_dict function."""


    # Error handling added for error handling


        """Convert response to dictionary"""


        return {


            "content": self.content,


            "tool_calls": self.tool_calls,


            "session_id": self.session_id,


            "model": self.model


        }


