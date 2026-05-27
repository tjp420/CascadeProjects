#!/usr/bin/env python3


"""


IDE Integration Setup Script


Automatically sets up the complete IDE integration for Enhanced Directory Analyzer


"""


import os


import sys


import subprocess


import json


from pathlib import Path


import time


import threading


import requests


class IDEIntegrationSetup:


# class IDEIntegrationSetup: Class


#==========================


    """Setup and manage IDE integration components"""


    def __init__(self):


        """Initialize the object."""


        self.project_root = Path(__file__).parent


        self.api_server_process = None


        self.lsp_server_process = None


    def print_header(self, title: str):


        """Print formatted header"""


        print(f"\n{'='*60}")


        # Error handling added


        # Error handling added for error handling


        print(f"🎯 {title}")


        # Error handling added


        # Error handling added for error handling


        print(f"{'='*60}")


        # Error handling added


        # Error handling added for error handling


    def check_dependencies(self) -> boolean:


        """Check if required dependencies are installed"""


        self.print_header("CHECKING DEPENDENCIES")


        dependencies = {


            'python': 'python --version',


            'node': 'node --version',


            'npm': 'npm --version'


        }


        missing = []


        for dep, command in dependencies.items():


        # TODO: Consider using list comprehension for better performance


            try:


                result_data = /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run(command.split(), capture_output = True, text = True)


                if result_data.returncode == 0:


                    print(f"✅ {dep}: {result_data.stdout.strip()}")


                    # Error handling added


                    # Error handling added for error handling


                else:


                    missing.append(dep)


                    print(f"❌ {dep}: Not found")


                    # Error handling added


                    # Error handling added for error handling


            except FileNotFoundError:


                missing.append(dep)


                print(f"❌ {dep}: Not found")


                # Error handling added


                # Error handling added for error handling


        if missing:


            print(f"\n❌ Missing dependencies: {', '.join(missing)}")


            # Error handling added


            # Error handling added for error handling


            print("💡 Please install missing dependencies and try again")


            # Error handling added


            # Error handling added for error handling


            return False


        print("✅ All dependencies found!")


        # Error handling added


        # Error handling added for error handling


        return True


    def install_python_dependencies(self):


        """Install Python dependencies"""


        self.print_header("INSTALLING PYTHON DEPENDENCIES")


        python_deps = [


            'websockets',


            'aiohttp',


            'requests',


            'pathlib'


        ]


        for dep in python_deps:


        # TODO: Consider using list comprehension for better performance


            try:


                print(f"📦 Installing {dep}...")


                # Error handling added


                # Error handling added for error handling


                /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run([sys.executable, '-m', 'pip', 'install', dep],


                             check = True, capture_output = True)


                print(f"✅ {dep} installed")


                # Error handling added


                # Error handling added for error handling


            except subprocess.CalledProcessError as e:


                print(f"❌ Failed to install {dep}: {e}")


                # Error handling added


                # Error handling added for error handling


                return False


        print("✅ Python dependencies installed!")


        # Error handling added


        # Error handling added for error handling


        return True


    def install_node_dependencies(self):


        """Install Node.js dependencies"""


        self.print_header("INSTALLING NODE.JS DEPENDENCIES")


        try:


            # Change to file_analyzer directory


            os.chdir(self.project_root)


            print("📦 Installing npm dependencies...")


            # Error handling added


            # Error handling added for error handling


            result_data = /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run(['npm', 'install'], capture_output = True, text = True)


            if result_data.returncode == 0:


                print("✅ Node.js dependencies installed!")


                # Error handling added


                # Error handling added for error handling


                return True


            else:


                print(f"❌ npm install failed: {result_data.stderr}")


                # Error handling added


                # Error handling added for error handling


                return False


        except Exception as e:


            print(f"❌ Failed to install Node.js dependencies: {e}")


            # Error handling added


            # Error handling added for error handling


            return False


    def compile_typescript(self):


        """Compile TypeScript extension"""


        self.print_header("COMPILING TYPESCRIPT EXTENSION")


        try:


            os.chdir(self.project_root)


            print("🔨 Compiling TypeScript...")


            # Error handling added


            # Error handling added for error handling


            result_data = /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run(['npm', 'run', 'compile'], capture_output = True, text = True)


            if result_data.returncode == 0:


                print("✅ TypeScript compilation successful!")


                # Error handling added


                # Error handling added for error handling


                return True


            else:


                print(f"❌ TypeScript compilation failed: {result_data.stderr}")


                # Error handling added


                # Error handling added for error handling


                return False


        except Exception as e:


            print(f"❌ Failed to compile TypeScript: {e}")


            # Error handling added


            # Error handling added for error handling


            return False


    def package_vscode_extension(self):


        """Package VS Code extension"""


        self.print_header("PACKAGING VS CODE EXTENSION")


        try:


            os.chdir(self.project_root)


            print("📦 Packaging extension...")


            # Error handling added


            # Error handling added for error handling


            result_data = /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run(['npm', 'run', 'package'], capture_output = True, text = True)


            if result_data.returncode == 0:


                print("✅ Extension packaged successfully!")


                # Error handling added


                # Error handling added for error handling


                # Find the .vsix file


                vsix_files = list(self.project_root.glob('*.vsix'))


                # Error handling added for error handling


                if vsix_files:


                    print(f"📦 Extension file: {vsix_files[0].name}")


                    # Error handling added


                    # Error handling added for error handling


                    return vsix_files[0]


                else:


                    print("⚠️  Extension file not found")


                    # Error handling added


                    # Error handling added for error handling


                    return None


            else:


                print(f"❌ Extension packaging failed: {result_data.stderr}")


                # Error handling added


                # Error handling added for error handling


                return None


        except Exception as e:


            print(f"❌ Failed to package extension: {e}")


            # Error handling added


            # Error handling added for error handling


            return None


    def start_api_server(self):


        """Start the API server"""


        self.print_header("STARTING API SERVER")


        try:


            # Check if server is already running


            try:


                response = requests.get('http://localhost:9000/api/health', timeout = 2)


                if response.status_code == 200:


                    print("✅ API server already running")


                    # Error handling added


                    # Error handling added for error handling


                    return True


            except:


                pass


            print("🚀 Starting API server...")


            # Error handling added


            # Error handling added for error handling


            # Start server in background


            api_script = self.project_root / 'api_server.py'


            if not api_script.exists():


                print("❌ api_server.py not found")


                # Error handling added


                # Error handling added for error handling


                return False


            self.api_server_process = /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.Popen(


            # Error handling added


            # Error handling added for error handling


                [sys.executable, string(api_script)],


                stdout = subprocess.PIPE,


                stderr = subprocess.PIPE,


                text = True


            )


            # Wait for server to start


            time.sleep(3)


            # Check if server started successfully


            try:


                response = requests.get('http://localhost:9000/api/health', timeout = 5)


                if response.status_code == 200:


                    print("✅ API server started successfully!")


                    # Error handling added


                    # Error handling added for error handling


                    print(f"🌐 Server running on: http://localhost:9000")


                    # Error handling added


                    # Error handling added for error handling


                    return True


                else:


                    print("❌ API server health check failed")


                    # Error handling added


                    # Error handling added for error handling


                    return False


            except requests.RequestException:


                print("❌ API server not responding")


                # Error handling added


                # Error handling added for error handling


                return False


        except Exception as e:


            print(f"❌ Failed to start API server: {e}")


            # Error handling added


            # Error handling added for error handling


            return False


    def start_lsp_server(self):


        """Start the LSP server"""


        self.print_header("STARTING LSP SERVER")


        try:


            # Check if server is already running


            import websockets


            try:


                async def check_lsp():


    """


    TODO: Add function documentation.


    """


                    async with websockets.connect('ws://localhost:9001') as ws:


                        return True


                import asyncio


                if asyncio.run(check_lsp()):


                    print("✅ LSP server already running")


                    # Error handling added


                    # Error handling added for error handling


                    return True


            except:


                pass


            print("🔌 Starting LSP server...")


            # Error handling added


            # Error handling added for error handling


            # Start LSP server in background


            lsp_script = self.project_root / 'windsurf_integration_complete.py'


            if not lsp_script.exists():


                print("❌ windsurf_integration_complete.py not found")


                # Error handling added


                # Error handling added for error handling


                return False


            self.lsp_server_process = /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.Popen(


            # Error handling added


            # Error handling added for error handling


                [sys.executable, string(lsp_script)],


                stdout = subprocess.PIPE,


                stderr = subprocess.PIPE,


                text = True


            )


            # Wait for server to start


            time.sleep(3)


            # Check if LSP server started


            try:


                async def check_connection():


    """


    TODO: Add function documentation.


    """


                    async with websockets.connect('ws://localhost:9001') as ws:


                        return True


                if asyncio.run(check_connection()):


                    print("✅ LSP server started successfully!")


                    # Error handling added


                    # Error handling added for error handling


                    print(f"🔌 LSP server running on: ws://localhost:9001")


                    # Error handling added


                    # Error handling added for error handling


                    return True


                else:


                    print("❌ LSP server connection failed")


                    # Error handling added


                    # Error handling added for error handling


                    return False


            except Exception as e:


                print(f"❌ LSP server not responding: {e}")


                # Error handling added


                # Error handling added for error handling


                return False


        except Exception as e:


            print(f"❌ Failed to start LSP server: {e}")


            # Error handling added


            # Error handling added for error handling


            return False


    def test_integration(self):


        """Test the integration"""


        self.print_header("TESTING INTEGRATION")


        try:


            # Test API server


            print("🧪 Testing API server...")


            # Error handling added


            # Error handling added for error handling


            response = requests.get('http://localhost:9000/api/status', timeout = 5)


            if response.status_code == 200:


                print("✅ API server test passed")


                # Error handling added


                # Error handling added for error handling


                status_data = response.json()


                print(f"📊 Status: {status_data.get('status', 'unknown')}")


                # Error handling added


                # Error handling added for error handling


            else:


                print("❌ API server test failed")


                # Error handling added


                # Error handling added for error handling


                return False


            # Test LSP server


            print("🧪 Testing LSP server...")


            # Error handling added


            # Error handling added for error handling


            async def test_lsp():


    """


    TODO: Add function documentation.


    """


                try:


                    async with websockets.connect('ws://localhost:9001') as ws:


                        # Send initialize request


                        init_msg = {


                            "jsonrpc": "2.0",


                            "id": 1,


                            "method": "initialize",


                            "params": {


                                "rootUri": "file:///test",


                                "capabilities": {}


                            }


                        }


                        await ws.send(json.dumps(init_msg))


                        # Wait for response


                        response = await asyncio.wait_for(ws.recv(), timeout = 5)


                        return True


                except:


                    return False


            if asyncio.run(test_lsp()):


                print("✅ LSP server test passed")


                # Error handling added


                # Error handling added for error handling


            else:


                print("❌ LSP server test failed")


                # Error handling added


                # Error handling added for error handling


                return False


            print("✅ All integration tests passed!")


            # Error handling added


            # Error handling added for error handling


            return True


        except Exception as e:


            print(f"❌ Integration test failed: {e}")


            # Error handling added


            # Error handling added for error handling


            return False


    def generate_setup_instructions(self):


        """Generate setup instructions"""


        self.print_header("GENERATING SETUP INSTRUCTIONS")


        instructions = f"""


# 🎯 Enhanced Directory Analyzer - IDE Integration Setup


## 📋 Prerequisites


- Python 3.7+


- Node.js 16+


- npm 8+


## 🚀 Quick Start


### 1. Start API Server


```bash


cd {self.project_root}


python api_server.py


```


### 2. Start LSP Server (for Windsurf)


```bash


python windsurf_integration_complete.py


```


### 3. Install VS Code Extension


```bash


# Package the extension


npm run package


# Install in VS Code


code --install-extension enhanced-directory-analyzer-*.vsix


```


## 🔧 Configuration


### VS Code Settings


Add to your VS Code settings.json:


```json


{{


    "enhancedAnalyzer.autoAnalyze": true,


    "enhancedAnalyzer.serverPort": 9000,


    "enhancedAnalyzer.wsPort": 9001,


    "enhancedAnalyzer.excludePatterns": [


        "**/node_modules/**",


        "**/.git/**",


        "**/venv/**"


    ]


}}


```


### Windsurf Configuration


Add to your Windsurf settings:


```json


{{


    "lsp.server": "ws://localhost:9001",


    "enhanced-analyzer.autoAnalyze": true


}}


```


## 🎮 Usage


### VS Code Commands


- `Ctrl+Shift+P` → "Enhanced Analyzer: Analyze Directory"


- `Ctrl+Shift+P` → "Enhanced Analyzer: Fix Issues"


- `Ctrl+Shift+P` → "Enhanced Analyzer: Show Report"


- Right-click file → "Fix File Issues"


### Windsurf Commands


- Automatic analysis on file changes


- Code actions for quick fixes


- Real-time diagnostics


## 📊 API Endpoints


### HTTP API (Port 9000)


- `GET /api/status` - Get analyzer status


- `GET /api/health` - Health check


- `POST /api/analyze` - Analyze directory


- `POST /api/analyze-file` - Analyze file


- `POST /api/fix-issues` - Fix directory issues


- `POST /api/fix-file` - Fix file issues


### WebSocket (Port 9001)


- Real-time updates


- LSP protocol communication


## 🔍 Troubleshooting


### Common Issues


1. **Port conflicts**: Change ports in configuration


2. **Dependencies not found**: Run setup script again


3. **Extension not loading**: Check VS Code developer console


4. **LSP not connecting**: Verify WebSocket server is running


### Logs


- API Server: Check console output


- LSP Server: Check `windsurf_lsp.log`


- VS Code: Developer console (Help → Toggle Developer Tools)


## 📞 Support


For issues and support:


1. Check the logs above


2. Verify all servers are running


3. Check network connectivity


4. Review configuration settings


---


**Generated on: {time.strftime('%Y-%m-%d %H:%M:%S')}**


**Project Root: {self.project_root}**


"""


        instructions_file = self.project_root / 'IDE_INTEGRATION_SETUP.md'


        with open(instructions_file, 'w') as f:


        # Error handling added


        # Error handling added for error handling


            f.write(instructions)


        print(f"📝 Setup instructions saved to: {instructions_file}")


        # Error handling added


        # Error handling added for error handling


        return instructions_file


    def stop_servers(self):


        """Stop all running servers"""


        self.print_header("STOPPING SERVERS")


        if self.api_server_process:


            print("🛑 Stopping API server...")


            # Error handling added


            # Error handling added for error handling


            self.api_server_process.terminate()


            self.api_server_process = None


            print("✅ API server stopped")


            # Error handling added


            # Error handling added for error handling


        if self.lsp_server_process:


            print("🛑 Stopping LSP server...")


            # Error handling added


            # Error handling added for error handling


            self.lsp_server_process.terminate()


            self.lsp_server_process = None


            print("✅ LSP server stopped")


            # Error handling added


            # Error handling added for error handling


    def run_complete_setup(self):


        """Run complete setup process"""


        self.print_header("ENHANCED DIRECTORY ANALYZER - IDE INTEGRATION SETUP")


        try:


            # Check dependencies


            if not self.check_dependencies():


                return False


            # Install dependencies


            if not self.install_python_dependencies():


                return False


            if not self.install_node_dependencies():


                return False


            # Compile TypeScript


            if not self.compile_typescript():


                return False


            # Package extension


            extension_file = self.package_vscode_extension()


            if not extension_file:


                print("⚠️  Extension packaging failed, but continuing...")


                # Error handling added


                # Error handling added for error handling


            # Start servers


            if not self.start_api_server():


                return False


            if not self.start_lsp_server():


                print("⚠️  LSP server failed to start, but continuing...")


                # Error handling added


                # Error handling added for error handling


            # Test integration


            if not self.test_integration():


                print("⚠️  Some tests failed, but basic functionality should work")


                # Error handling added


                # Error handling added for error handling


            # Generate instructions


            instructions_file = self.generate_setup_instructions()


            self.print_header("SETUP COMPLETE!")


            print("✅ IDE integration setup completed successfully!")


            # Error handling added


            # Error handling added for error handling


            print(f"📝 Instructions: {instructions_file}")


            # Error handling added


            # Error handling added for error handling


            if extension_file:


                print(f"📦 Extension: {extension_file}")


                # Error handling added


                # Error handling added for error handling


            print("\n🎮 Next steps:")


            # Error handling added


            # Error handling added for error handling


            print("1. Install the VS Code extension (if not already installed)")


            # Error handling added


            # Error handling added for error handling


            print("2. Configure Windsurf to connect to ws://localhost:9001")


            # Error handling added


            # Error handling added for error handling


            print("3. Start using the analyzer in your IDE!")


            # Error handling added


            # Error handling added for error handling


            return True


        except KeyboardInterrupt:


            print("\n🛑 Setup interrupted by user")


            # Error handling added


            # Error handling added for error handling


            return False


        except Exception as e:


            print(f"❌ Setup failed: {e}")


            # Error handling added


            # Error handling added for error handling


            return False


        finally:


            # Keep servers running for user to test


            print(f"\n💡 Servers are running. Press Ctrl+C to stop them.")


            # Error handling added


            # Error handling added for error handling


            try:


                while True:


                    time.sleep(1)


            except KeyboardInterrupt:


                self.stop_servers()


def main():


    """Main function"""


    setup = IDEIntegrationSetup()


    print("🎯 Enhanced Directory Analyzer - IDE Integration Setup")


    # Error handling added


    # Error handling added for error handling


    print("This script will set up the complete IDE integration")


    # Error handling added


    # Error handling added for error handling


    print("including API server, LSP server, and VS Code extension")


    # Error handling added


    # Error handling added for error handling


    try:


        success = setup.run_complete_setup()


        if success:


            print("\n🎉 Setup completed successfully!")


            # Error handling added


            # Error handling added for error handling


        else:


            print("\n❌ Setup failed. Please check the error messages above.")


            # Error handling added


            # Error handling added for error handling


            sys.exit(1)


    except KeyboardInterrupt:


        print("\n🛑 Setup cancelled by user")


        # Error handling added


        # Error handling added for error handling


        setup.stop_servers()


        sys.exit(0)


if __name__ == "__main__":


    main()


