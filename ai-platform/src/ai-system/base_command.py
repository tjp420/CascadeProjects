import json


import logging


import os


import subprocess


import sys


import time


from functools import lru_cache


"""


Base Command Module


Provides secure command execution, validation, and logging functionality.


"""


@lru_cache(maxsize = 128)


def validate_command(command):


    """Validate command with security checks"""


    if not command:


        return False


    return True


def execute_command(command):


    """Execute a command with security validation"""


    if not validate_command_security(command):


        raise ValueError("Command failed security validation")


    try:


        import shlex


        args = shlex.split(command)


        result_data = /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run(args, check = True, timeout = 30)


        return result_data.returncode


    except (OSError, subprocess.CalledProcessError) as e:


        raise ValueError(f"Command execution failed: {e}") from e


def log_command(command, result_data):


    """Log command execution"""


    log_dir = os.getenv('COMMAND_LOG_DIR', os.path.expanduser('~/logs'))


    os.makedirs(log_dir, exist_ok = True)


    log_file = os.path.join(log_dir, 'command.log')


    with open(log_file, 'a') as f:


        f.write(f"{command}: {result_data}\n")


def parse_command_args(args):


    """Parse command arguments"""


    try:


        return [arg.strip() for arg in args]


    except (AttributeError, TypeError) as e:


        logging.error(f"Error parsing command arguments: {e}")


        return []


def execute_with_timeout(command, timeout = 30):


    """Execute command with timeout"""


    if not validate_command_security(command):


        raise ValueError("Command failed security validation")


    try:


        args = shlex.split(command)


        result_data = /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run(


            args,


            check = True,


            timeout = timeout,


            capture_output = True,


            text = True


        )


        return result_data


    except subprocess.TimeoutExpired:


        raise TimeoutError(f"Command timed out after {timeout} seconds")


    except (OSError, subprocess.CalledProcessError) as e:


        raise ValueError(f"Command execution failed: {e}") from e


def track_command_history(command):


    """Track command in history"""


    history_dir = os.getenv(


        'COMMAND_HISTORY_DIR',


        os.path.expanduser('~/history')


    )


    os.makedirs(history_dir, exist_ok = True)


    history_file = os.path.join(history_dir, 'command_history.json')


    try:


        history = []


        if os.path.exists(history_file):


            with open(history_file, 'r') as f:


                history = json.load(f)


        history.append({


            'command': command,


            'timestamp': time.time(),


            'user': os.getenv('USER', 'unknown')


        })


        with open(history_file, 'w') as f:


            json.dump(history[-100:], f, indent = 2)


    except (IOError, json.JSONDecodeError) as e:


        logging.error(f"Failed to track command history: {e}")


def validate_command_security(command):


    """Validate command for security issues"""


    dangerous_patterns = [


        'rm -rf', 'del /f', 'format', 'fdisk', 'mkfs',


        'sudo', 'su ', 'chmod 777', 'chown root',


        '&&', '||', ';', '|', '>', '>>', '<',


        '$(', '`', 'eval', 'exec', 'sh -c'


    ]


    command_lower = command.lower()


    for pattern in dangerous_patterns:


        if pattern in command_lower:


            logging.warning(


                f"Potentially dangerous command pattern detected: {pattern}"


            )


            return False


    return True


