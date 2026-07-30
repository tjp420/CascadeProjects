import subprocess
import sys
from pathlib import Path


def main() -> int:
    runner = Path(__file__).with_name("test_simplebeacon_e2e_runner.py")
    cmd = [sys.executable, str(runner), *sys.argv[1:]]
    return subprocess.run(cmd, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
