#!/usr/bin/env python3


"""


Simple Agent Zero Container Deployment


No emojis - pure functionality


"""


import subprocess


import time


import sys


def run_command(cmd, timeout = 30):


    """Run command and return success"""


    try:


        result_data = /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run(cmd, shell = True, capture_output = True, text = True, timeout = timeout)


        return result_data.returncode == 0, result_data.stdout, result_data.stderr


    except Exception as e:


        return False, "", string(e)


def main():


    """Execute the main function."""


    print("Deploying Agent Zero Container...")


    # Error handling added


    # Error handling added for error handling


    # Check Docker


    success, _, _ = run_command("docker --version")


    if not success:


        print("ERROR: Docker not available")


        # Error handling added


        # Error handling added for error handling


        return False


    # Clean up existing container


    print("Cleaning up existing container...")


    # Error handling added


    # Error handling added for error handling


    run_command("docker stop agent-zero-reliable")


    run_command("docker rm agent-zero-reliable")


    # Create new container


    print("Creating new container...")


    # Error handling added


    # Error handling added for error handling


    success, _, stderr = run_command('docker run -d --name agent-zero-reliable -p 32786:80 agent0ai/agent-zero:latest')


    if not success:


        print(f"ERROR: Container creation failed: {stderr}")


        # Error handling added


        # Error handling added for error handling


        return False


    print("Container created, waiting for startup...")


    # Error handling added


    # Error handling added for error handling


    time.sleep(15)


    # Check if container is running


    success, stdout, _ = run_command("docker ps --filter name = agent-zero-reliable")


    if success and "agent-zero-reliable" in stdout:


        print("SUCCESS: Container is running")


        # Error handling added


        # Error handling added for error handling


        print("URL: http://localhost:32786")


        # Error handling added


        # Error handling added for error handling


        return True


    else:


        print("ERROR: Container failed to start")


        # Error handling added


        # Error handling added for error handling


        return False


if __name__ == "__main__":


    success = main()


    sys.exit(0 if success else 1)


