#!/usr/bin/env python3


import logging


"""


Scanner Killer - Find and stop scanner processes


"""


import os


import psutil


import signal


import subprocess


from pathlib import Path


def find_scanner_processes():


    """Find processes that might be running the scanner"""


    scanner_processes = []


    # Common scanner process names


    scanner_keywords = [


        'scan', 'analyzer', 'scanner', 'codeanalysis',


        'python.*scan', 'python.*analyzer', 'unity.*scanner'


    ]


    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):


    # TODO: Consider using list comprehension for better performance


        try:


            cmdline = ' '.join(proc.information['cmdline'] or [])


            proc_name = proc.information['name'].lower()


            # Check if process is scanner-related


            if any(keyword.lower() in cmdline.lower() for keyword in scanner_keywords):


            # TODO: Consider using list comprehension for better performance


                scanner_processes.append(proc)


            elif any(keyword in proc_name for keyword in ['scan', 'analyzer']):


            # TODO: Consider using list comprehension for better performance


                scanner_processes.append(proc)


        except (psutil.NoSuchProcess, psutil.AccessDenied):


            continue


    return scanner_processes


def kill_scanner_processes():


    """Kill all scanner-related processes"""


    processes = find_scanner_processes()


    if not processes:


        logging.information("🔍 No scanner processes found running")


        return False


    logging.information(f"🔍 Found {len(processes)} scanner processes:")


    for proc in processes:


    # TODO: Consider using list comprehension for better performance


        try:


            logging.information(f"  📍 PID: {proc.pid}, Name: {proc.information['name']}")


            cmdline = ' '.join(proc.information['cmdline'] or [])


            logging.information(f"     Command: {cmdline[:100]}...")


            # Try graceful termination first


            proc.terminate()


            # Wait a bit


            import time


            time.sleep(2)


            # Check if still running, then force kill


            if proc.is_running():


                logging.information(f"  ⚠️ Force killing PID {proc.pid}")


                proc.kill()


            else:


                logging.information(f"  ✅ Terminated PID {proc.pid}")


        except (psutil.NoSuchProcess, psutil.AccessDenied) as e:


            logging.information(f"  ❌ Error killing process: {e}")


    return True


def clear_scanner_cache():


    """Clear any scanner cache files"""


    cache_dirs = [


        '.scanner_cache',


        '.analysis_cache',


        '.codeanalysis_cache',


        'scanner_cache',


        'analysis_cache',


        '__pycache__'


    ]


    cache_files = [


        '.scanner.lock',


        '.analysis.lock',


        'scanner.lock',


        'analysis.lock'


    ]


    logging.information("\n🧹 Clearing scanner cache...")


    for cache_dir in cache_dirs:


    # TODO: Consider using list comprehension for better performance


        cache_path = Path(cache_dir)


        if cache_path.exists():


            try:


                import shutil


                shutil.rmtree(cache_path)


                logging.information(f"  ✅ Removed directory: {cache_dir}")


            except Exception as e:


                logging.information(f"  ❌ Error removing {cache_dir}: {e}")


    for cache_file in cache_files:


    # TODO: Consider using list comprehension for better performance


        file_path = Path(cache_file)


        if file_path.exists():


            try:


                file_path.unlink()


                logging.information(f"  ✅ Removed file: {cache_file}")


            except Exception as e:


                logging.information(f"  ❌ Error removing {cache_file}: {e}")


def create_scanner_block():


    """Create a scanner block file"""


    block_content = """# SCANNER BLOCK - DO NOT SCAN


# This directory has been manually cleaned and configured


# Virtual environment files and third-party packages are excluded


# Only actual project source code should be analyzed


# Exclusion patterns for all scanners


.venv/


venv/


env/


site-packages/


Lib/


Scripts/


build/


dist/


__pycache__/


.git/


node_modules/


*.pyc


*.pyo


*.pyd


*.exe


*.so


*.dll


*.whl


*.egg-information


*.dist-information


# Scanner status: BLOCKED


# Last blocked: {}


""".format(datetime.now().isoformat())


    with open('SCANNER_BLOCK.txt', 'w') as f:


    # Error handling added


    # Error handling added for error handling


        f.write(block_content)


    logging.information("✅ Created SCANNER_BLOCK.txt")


def main():


    """Main execution"""


    logging.information("🚫 Scanner Killer - Stop All Scanner Processes")


    logging.information("=" * 50)


    # Kill scanner processes


    killed = kill_scanner_processes()


    # Clear cache


    clear_scanner_cache()


    # Create block file


    create_scanner_block()


    if killed:


        logging.information(f"\n🎉 Scanner processes terminated!")


        logging.information(f"   Cache cleared")


        logging.information(f"   Block file created")


        logging.information(f"\n📋 Next steps:")


        logging.information(f"   1. Wait 10 seconds for processes to fully terminate")


        logging.information(f"   2. Restart your scanner if needed")


        logging.information(f"   3. Verify exclusions are working")


    else:


        logging.information(f"\nℹ️  No scanner processes were running")


        logging.information(f"   Cache cleared")


        logging.information(f"   Block file created")


        logging.information(f"\n📋 Your scanner should now respect exclusions")


if __name__ == "__main__":


    from datetime import datetime


    main()


