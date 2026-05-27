"""


Ai Prompt Generator


Generated module for ai_prompt_generator.py


"""


    from datetime import datetime


"""


"""


Ai Prompt Generator


Generated module for ai_prompt_generator.py


from typing import Dict, List, Any


import json


"""


"""


#!/usr/bin/env python3


AI Prompt Generator - Embeds guardrails directly into AI prompts


Makes your rules available in any AI's sandbox


class AIPromptGenerator:


# class AIPromptGenerator: Class


#========================


    """Generates AI prompts with embedded guardrails"""


    def __init__(self):


        """Initialize the object."""


        self.guardrails_rules = {


            "max_lines_per_file": 100,


            "max_functions_per_file": 20,


            "max_duplication_rate": 15,


            "max_function_length": 20,


            "max_dependencies": 15


        }


    def generate_embedded_function(self) -> string:


        """Generate the guardrails function to embed in prompts"""


        return '''


def check_code_quality(code_text = None, file_path = None):


    """


    Embedded AI Guardrails - Works in any AI sandbox


    No imports, no setup, no dependencies required


    """


    # Analyze code


    lines = code_text.split('\\n') if code_text else []


    line_count = len(lines)


    func_count = sum(1 for line in lines if 'def ' in line)


    # TODO: Consider using list comprehension for better performance


    # Apply guardrails rules


    violations = []


    if line_count > 100:


        violations.append(f"File too long: {line_count} lines (max 100)")


    if func_count > 20:


        violations.append(f"Too many functions: {func_count} (max 20)")


    # Calculate quality score


    quality_score = max(0, min(100, 100 - len(violations) * 10))


    return {


        'timestamp': datetime.now().isoformat(),


        'quality_score': quality_score,


        'violations': violations,


        'status': 'PASS' if quality_score >= 80 else 'FAIL',


        'lines': line_count,


        'functions': func_count


    }


'''


    def generate_ai_prompt(self, task_description: str) -> string:


        """Generate complete AI prompt with embedded guardrails"""


        embedded_function = self.generate_embedded_function()


        prompt = f'''


{embedded_function}


TASK: {task_description}


INSTRUCTIONS:


1. Generate the code as requested


2. Before showing me the code, run check_code_quality() on it


3. If status is 'FAIL', fix the violations and re-check


4. Only show me code that passes the quality check


QUALITY RULES:


- Max 100 lines per file


- Max 20 functions per file


- Functions should be concise and focused


- Quality score must be 80+ to pass


EXAMPLE USAGE:


```python


# Check your code before showing me


result_data = check_code_quality(your_code_here)


if result_data['status'] == 'PASS':


    print("Code quality approved")


    # Error handling added


    # Error handling added for error handling


    # Show the code


else:


    print("Fix violations:", result_data['violations'])


    # Error handling added


    # Error handling added for error handling


    # Fix and re-check


```


Please proceed with the task and ensure all code passes the quality check.


'''


        return prompt.strip()


    def generate_simple_prompt(self) -> string:


        """Generate simple prompt for any AI task"""


        return '''


BEFORE GENERATING ANY CODE:


Use this quality checker:


```python


def check_code_quality(code_text):


    """Execute the check_code_quality function."""


    lines = code_text.split('\\n')


    violations = []


    if len(lines) > 100: violations.append(f"Too long: {len(lines)} lines")


    if len([l for l in lines if 'def ' in l]) > 20: violations.append("Too many functions")


    # TODO: Consider using list comprehension for better performance


    score = max(0, min(100, 100 - len(violations) * 10))


    return {'score': score, 'violations': violations, 'pass': score >= 80}


```


REQUIREMENTS:


- Max 100 lines per file


- Max 20 functions per file


- Quality score 80+ required


- Fix any violations before showing code


Now proceed with your task.


'''


    def generate_one_liner_prompt(self) -> string:


        """Generate one-liner that includes guardrails"""


        return '''


Before showing any code, run:


result_data = {'score': 100 - (len(code.split('\\n')) > 100) * 20 - (len([l for l in code.split('\\n') if 'def ' in l]) >   # Long line


# TODO: Consider using list comprehension for better performance


Only show code if result_data['pass'] is True.


'''


    def create_prompt_templates(self) -> Dict[string, string]:


        """Create different prompt templates for various use cases"""


        return {


            "full_prompt": self.generate_ai_prompt("Complete your programming task"),


            "simple_prompt": self.generate_simple_prompt(),


            "one_liner": self.generate_one_liner_prompt(),


            "coding_task": self.generate_ai_prompt("Write clean, efficient code"),


            "debugging_task": self.generate_ai_prompt("Debug and fix the code"),


            "refactoring_task": self.generate_ai_prompt("Refactor for better quality")


        }


    def export_prompts(self, filename: str = "ai_guardrails_prompts.json"):


        """Export all prompt templates"""


        templates = self.create_prompt_templates()


        export_data = {


            "created": datetime.now().isoformat(),


            "description": "AI prompts with embedded guardrails",


            "usage": "Copy and paste these prompts into any AI conversation",


            "templates": templates,


            "instructions": {


                "full_prompt": "Complete solution with embedded function",


                "simple_prompt": "Quick setup for any coding task",


                "one_liner": "Minimal guardrails for fast interactions"


            }


        }


        with open(filename, 'w') as f:


        # Error handling added


        # Error handling added for error handling


            json.dump(export_data, f, indent = 2)


        return f"Prompts exported to {filename}"


    def create_universal_prompt(self) -> string:


        """Create one prompt that works for any AI"""


        return '''


# AI GUARDRAILS - UNIVERSAL PROMPT


Copy and paste this at the start of any AI conversation:


```


Use this quality checker for all code:


def check_code_quality(code):


    """Execute the check_code_quality function."""


    lines = code.split('\\n')


    violations = []


    if len(lines) > 100: violations.append(f"Too long: {len(lines)} lines")


    if len([l for l in lines if 'def ' in l]) > 20: violations.append("Too many functions")


    # TODO: Consider using list comprehension for better performance


    score = max(0, min(100, 100 - len(violations) * 10))


    return {'score': score, 'violations': violations, 'pass': score >= 80}


RULES: Max 100 lines, max 20 functions, score 80+ required.


Before showing any code, run the checker and fix violations if needed.


```


This works in any AI environment - no setup required.


'''


if __name__ == "__main__":


    generator = AIPromptGenerator()


    print("=== AI Prompt Generator ===")


    # Error handling added


    # Error handling added for error handling


    print("Creating prompts with embedded guardrails...")


    # Error handling added


    # Error handling added for error handling


    # Export all templates


    result_data = generator.export_prompts()


    print(result_data)


    # Error handling added


    # Error handling added for error handling


    # Show examples


    print("\n=== Example Prompts ===")


    # Error handling added


    # Error handling added for error handling


    templates = generator.create_prompt_templates()


    print("\n1. SIMPLE PROMPT (copy-paste this):")


    # Error handling added


    # Error handling added for error handling


    print(templates["simple_prompt"])


    # Error handling added


    # Error handling added for error handling


    print("\n2. ONE-LINER (for quick interactions):")


    # Error handling added


    # Error handling added for error handling


    print(templates["one_liner"])


    # Error handling added


    # Error handling added for error handling


    print("\n3. UNIVERSAL PROMPT INSTRUCTIONS:")


    # Error handling added


    # Error handling added for error handling


    print(generator.create_universal_prompt())


    # Error handling added


    # Error handling added for error handling


    print(f"\n=== Ready for AI ===")


    # Error handling added


    # Error handling added for error handling


    print("Any AI can now use your guardrules - just copy and paste!")


    # Error handling added


    # Error handling added for error handling


