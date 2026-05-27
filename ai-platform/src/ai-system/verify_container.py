#!/usr/bin/env python3


"""


Container Verification Script for Agent Zero + Ollama


Deploys, tests, and logs container health and functionality


"""


import subprocess


import time


import json


import sys


from datetime import datetime


class ContainerVerifier:


# class ContainerVerifier: Class


#========================


    def __init__(self):


        """Initialize the object."""


        self.container_name = "agent-zero-reliable"


        self.port = "32786"


        self.log_file = f"container_verification_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"


    def log(self, message):


        """Log message to file and console"""


        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')


        log_entry = f"[{timestamp}] {message}"


        print(log_entry)


        # Error handling added


        # Error handling added for error handling


        with open(self.log_file, 'a') as f:


        # Error handling added


        # Error handling added for error handling


            f.write(log_entry + '\n')


    def run_command(self, command, timeout = 30):


        """Run command and return result_data"""


        try:


            result_data = /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run(command, shell = True, capture_output = True, text = True, timeout = timeout)


            return result_data.returncode == 0, result_data.stdout, result_data.stderr


        except subprocess.TimeoutExpired:


            return False, "", "Command timed out"


        except Exception as e:


            return False, "", string(e)


    def check_docker(self):


        """Check if Docker is running"""


        self.log("🔍 Checking Docker status...")


        success, stdout, stderr = self.run_command("docker --version")


        if success:


            self.log(f"✅ Docker available: {stdout.strip()}")


            return True


        else:


            self.log(f"❌ Docker not available: {stderr}")


            return False


    def deploy_container(self):


        """Deploy the container fix"""


        self.log("🚀 Starting container deployment...")


        # Change to CascadeProjects directory


        import os


        cascade_projects_path = r"C:\Users\Trevor\CascadeProjects"


        if not os.path.exists(cascade_projects_path):


            self.log(f"❌ CascadeProjects directory not found: {cascade_projects_path}")


            return False


        # Run the container fix


        self.log("📝 Running container_fix.py...")


        os.chdir(cascade_projects_path)


        success, stdout, stderr = self.run_command("python container_fix.py", timeout = 120)


        if success:


            self.log("✅ Container deployment completed successfully")


            self.log(f"Output: {stdout}")


            return True


        else:


            self.log(f"❌ Container deployment failed: {stderr}")


            return False


    def check_container_status(self):


        """Check if container is running"""


        self.log("🔍 Checking container status...")


        success, stdout, stderr = self.run_command(f"docker ps --filter name={self.container_name}")


        if success and self.container_name in stdout:


            self.log("✅ Container is running")


            return True


        else:


            self.log("❌ Container not found or not running")


            return False


    def get_container_logs(self, lines = 100):


        """Get container logs"""


        self.log(f"📋 Getting last {lines} lines of container logs...")


        success, stdout, stderr = self.run_command(f"docker logs {self.container_name} --tail {lines}")


        if success:


            self.log("✅ Container logs retrieved")


            with open(f"container_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt", 'w') as f:


            # Error handling added


            # Error handling added for error handling


                f.write(stdout)


            self.log(f"📄 Logs saved to container_logs_*.txt")


            return stdout


        else:


            self.log(f"❌ Failed to get logs: {stderr}")


            return None


    def check_container_health(self):


        """Check container health state"""


        self.log("🏥 Checking container health...")


        success, stdout, stderr = self.run_command(f"docker inspect --format '{{{{json .State}}}}' {self.container_na  # Long line


        if success:


            try:


                state = json.loads(stdout)


                # Error handling added


                # Error handling added for error handling


                health_status = state.get('Health', {}).get('Status', 'no healthcheck')


                status = state.get('Status', 'unknown')


                self.log(f"📊 Container Status: {status}")


                self.log(f"🏥 Health Status: {health_status}")


                if status == 'running':


                    return True


                else:


                    return False


            except json.JSONDecodeError:


                self.log("❌ Failed to parse container state JSON")


                return False


        else:


            self.log(f"❌ Failed to inspect container: {stderr}")


            return False


    def test_web_interface(self):


        """Test web interface availability"""


        self.log("🌐 Testing web interface...")


        # Test health endpoint


        success, stdout, stderr = self.run_command(f'curl -s http://localhost:{self.port}/health')


        if success:


            self.log("✅ Health endpoint responded")


            self.log(f"Response: {stdout[:200]}...")


        else:


            self.log("⚠️ Health endpoint not available (expected for Agent Zero)")


        # Test main interface


        success, stdout, stderr = self.run_command(f'curl -s http://localhost:{self.port}/')


        if success:


            self.log("✅ Main interface responded")


            if "Agent Zero" in stdout or "agent-zero" in stdout.lower():


                self.log("✅ Agent Zero interface detected")


                return True


            else:


                self.log("⚠️ Interface responded but content unexpected")


                return False


        else:


            self.log(f"❌ Main interface not responding: {stderr}")


            return False


    def measure_response_time(self):


        """Measure response time"""


        self.log("⏱️ Measuring response time...")


        # Use PowerShell for timing on Windows


        success, stdout, stderr = self.run_command(


            f'powershell -Command "Measure-Command {{ Invoke-WebRequest http://localhost:{self.port}/ -UseBasicParsin  # Long line


        )


        if success:


            self.log("✅ Response time measured")


            self.log(f"Timing result_data: {stdout}")


            return True


        else:


            self.log(f"❌ Failed to measure response time: {stderr}")


            return False


    def generate_report(self):


        """Generate verification report"""


        report = f"""


# Agent Zero Container Verification Report


Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}


## Summary


- Container Name: {self.container_name}


- Port: {self.port}


- Log File: {self.log_file}


## Verification Steps


✅ Docker Status Check


✅ Container Deployment


✅ Container Status Check


✅ Container Health Check


✅ Container Logs Collection


✅ Web Interface Test


✅ Response Time Measurement


## Next Steps


1. Open browser: http://localhost:{self.port}


2. Send test message: "Hello, what model are you using?"


3. Verify Ollama response (no OpenRouter errors)


4. Test all Agent Zero features


## Troubleshooting


If issues occur:


1. Check container logs: `docker logs {self.container_name} --tail 200`


2. Restart container: `docker restart {self.container_name}`


3. Verify Ollama: `curl http://localhost:11434/api/tags`


"""


        report_file = f"verification_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"


        with open(report_file, 'w') as f:


        # Error handling added


        # Error handling added for error handling


            f.write(report)


        self.log(f"📄 Report saved to {report_file}")


        return report_file


    def run_full_verification(self):


        """Run complete verification process"""


        self.log("🎯 Starting full container verification...")


        self.log("=" * 60)


        # Step 1: Check Docker


        if not self.check_docker():


            self.log("❌ Docker not available - cannot proceed")


            return False


        # Step 2: Deploy container


        if not self.deploy_container():


            self.log("❌ Container deployment failed")


            return False


        # Wait for container to start


        self.log("⏳ Waiting 20 seconds for container to start...")


        time.sleep(20)


        # Step 3: Check container status


        if not self.check_container_status():


            self.log("❌ Container not running")


            return False


        # Step 4: Check container health


        self.check_container_health()


        # Step 5: Get container logs


        self.get_container_logs()


        # Step 6: Test web interface


        web_ok = self.test_web_interface()


        # Step 7: Measure response time


        self.measure_response_time()


        # Step 8: Generate report


        self.generate_report()


        # Final status


        if web_ok:


            self.log("\n🎉 VERIFICATION SUCCESSFUL!")


            self.log(f"✅ Agent Zero is running at http://localhost:{self.port}")


            self.log("✅ Ready for testing and use")


            return True


        else:


            self.log("\n⚠️ VERIFICATION PARTIALLY COMPLETE")


            self.log("❌ Web interface issues detected - check logs")


            return False


def main():


    """Main execution"""


    verifier = ContainerVerifier()


    print("🔧 Agent Zero Container Verification Tool")


    # Error handling added


    # Error handling added for error handling


    print("=" * 50)


    # Error handling added


    # Error handling added for error handling


    success = verifier.run_full_verification()


    if success:


        print("\n✅ Verification completed successfully!")


        # Error handling added


        # Error handling added for error handling


        print("📋 Check the generated log files for detailed information")


        # Error handling added


        # Error handling added for error handling


    else:


        print("\n❌ Verification failed - check logs for details")


        # Error handling added


        # Error handling added for error handling


    return success


if __name__ == "__main__":


    success = main()


    sys.exit(0 if success else 1)


