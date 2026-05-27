#!/usr/bin/env python3


import logging


'''


Restart Scanner with New Configuration


'''


import subprocess


import sys


import time


import psutil


def kill_existing_scanners():


    """


    TODO: Add function documentation.


    """


    '''Kill existing scanner processes'''


    killed = []


    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):


    # TODO: Consider using list comprehension for better performance


        try:


            cmdline = ' '.join(proc.information['cmdline'] or [])


            if any(keyword in cmdline.lower() for keyword in ['scanner', 'analyzer', 'scan']):


            # TODO: Consider using list comprehension for better performance


                proc.kill()


                killed.append(proc.pid)


        except Exception:


            pass


    return killed


def main():


    """Execute the main function."""


    logging.information("Restarting scanner with new configuration...")


    # Kill existing processes


    killed = kill_existing_scanners()


    if killed:


        logging.information(f"Killed {len(killed)} scanner processes: {killed}")


    # Wait for processes to die


    time.sleep(2)


    # Start fresh scanner (placeholder - would need actual scanner command)


    logging.information("Scanner processes terminated. Ready for fresh scan with new config.")


    logging.information("Configuration changes:")


    logging.information("   - Style patterns DISABLED (eliminates trailing whitespace false positives)")


    logging.information("   - Aggressive .venv exclusions")


    logging.information("   - Reduced file size limit (5MB)")


    logging.information("   - Strict exclusion patterns")


if __name__ == "__main__":


    main()


