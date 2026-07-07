#!/bin/sh
# SimpleBeacon Local Agent installer for Linux and macOS.
# Installs to ~/.local/share/simplebeacon-local-agent, creates a systemd user
# service on Linux, and starts the agent.

set -e

INSTALL_DIR="$HOME/.local/share/simplebeacon-local-agent"
BIN_DIR="$HOME/.local/bin"
SERVICE_NAME="simplebeacon-local-agent"

SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing SimpleBeacon Local Agent to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"

for item in agent.cjs package.json README.md start-agent.sh node_modules packages .simplebeacon; do
  src="$SOURCE_DIR/$item"
  dst="$INSTALL_DIR/$item"
  if [ -e "$src" ]; then
    rm -rf "$dst"
    cp -R "$src" "$dst"
  else
    echo "Warning: source item not found, skipping: $src"
  fi
done

# Ensure launcher script is executable.
chmod +x "$INSTALL_DIR/start-agent.sh"

# Create symlink in ~/.local/bin.
mkdir -p "$BIN_DIR"
ln -sf "$INSTALL_DIR/start-agent.sh" "$BIN_DIR/simplebeacon-local-agent"

# Linux systemd user service.
if [ "$(uname -s)" = "Linux" ] && command -v systemctl >/dev/null 2>&1; then
  SYSTEMD_DIR="$HOME/.config/systemd/user"
  mkdir -p "$SYSTEMD_DIR"
  cat > "$SYSTEMD_DIR/$SERVICE_NAME.service" <<EOF
[Unit]
Description=SimpleBeacon Local Agent
After=network.target

[Service]
Type=simple
ExecStart=$INSTALL_DIR/start-agent.sh
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable "$SERVICE_NAME.service"
  systemctl --user start "$SERVICE_NAME.service"
  echo "Started $SERVICE_NAME systemd user service."
else
  echo "Starting agent directly..."
  nohup "$INSTALL_DIR/start-agent.sh" >/dev/null 2>&1 &
fi

echo ""
echo "Installation complete."
echo "The agent is running on http://127.0.0.1:55432"
echo "You can now open the dashboard and enter a local path to scan."
echo ""
echo "To uninstall later, run: rm -rf $INSTALL_DIR"
