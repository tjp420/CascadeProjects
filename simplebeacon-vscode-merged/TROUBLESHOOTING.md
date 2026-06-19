# SimpleBeacon VSCode Extension Troubleshooting

## Common Issues and Solutions

### "No view is registered with id: simplebeacon-enhanced"

This error occurs when the Enhanced AI view fails to register properly. Here are the solutions:

#### **Solution 1: Restart VSCode**
1. Close VSCode completely
2. Reopen VSCode
3. Reload the extension (Ctrl+Shift+P → "Developer: Reload Window")

#### **Solution 2: Check Extension Installation**
1. Go to Extensions (Ctrl+Shift+X)
2. Search for "SimpleBeacon"
3. Ensure it's installed and enabled
4. Click "Reload" if available

#### **Solution 3: Clear Extension Cache**
1. Open Command Palette (Ctrl+Shift+P)
2. Run "Developer: Reload Window"
3. If that doesn't work, run "Developer: Show Running Extensions"
4. Check if SimpleBeacon appears in the list

#### **Solution 4: Check View Configuration**
The extension should show these views in the SimpleBeacon sidebar:
- **Settings**: Configuration options
- **Scan Phases**: Main analysis results
- **Enhanced AI**: AI-powered features and code maps

If the "Enhanced AI" view is missing:
1. Check the VSCode developer console for errors
2. Look for messages in the output channel: "View > Output > SimpleBeacon"

### Extension Not Loading

#### **Check VSCode Version**
- Required: VSCode 1.84.0 or higher
- Update VSCode if needed

#### **Check Node.js Version**
- Required: Node.js 22.0.0 or higher
- Update Node.js if needed

#### **Check Extension Logs**
1. Open VSCode
2. Go to Help → Toggle Developer Tools
3. Check the console for error messages
4. Look for SimpleBeacon-related errors

### Code Map Not Working

#### **No Data Displayed**
1. Run a scan first: `Ctrl+Shift+P → SimpleBeacon: Scan Workspace`
2. Wait for the scan to complete
3. Then open the code map: `Ctrl+Shift+P → SimpleBeacon: Show Code Map`

#### **Visualization Not Loading**
1. Check if D3.js is loading (requires internet connection)
2. Try refreshing the webview
3. Check the output panel for error messages

#### **Performance Issues**
1. Use filters to reduce the number of files displayed
2. Switch to Tree layout for better performance
3. Close other VSCode panels to free memory

### Enhanced AI Analysis Not Working

#### **Model Health Issues**
1. Check the "Enhanced AI" view for model status
2. Ensure AI provider is configured (OpenAI, Anthropic, or Ollama)
3. Check API keys in settings

#### **Real-time Analysis Issues**
1. Ensure the SimpleBeacon server is running
2. Check WebSocket connection (port 8082)
3. Verify workspace permissions

### Commands Not Working

#### **Command Not Found**
1. Open Command Palette (Ctrl+Shift+P)
2. Search for "SimpleBeacon"
3. If commands don't appear, restart VSCode

#### **Keyboard Shortcuts Not Working**
1. Check VSCode keyboard shortcuts settings
2. Look for conflicting keybindings
3. Reset SimpleBeacon keybindings if needed

### Performance Issues

#### **Slow Scanning**
1. Reduce `simplebeacon.maxFiles` in settings
2. Add more exclude patterns
3. Use "Quick" analysis profile

#### **High Memory Usage**
1. Close unused VSCode panels
2. Restart VSCode periodically
3. Use file filtering to reduce scope

### Server Connection Issues

#### **Cannot Connect to Server**
1. Ensure SimpleBeacon server is running on port 3000
2. Check firewall settings
3. Verify server configuration

#### **WebSocket Connection Failed**
1. Check if port 8082 is available
2. Restart the SimpleBeacon server
3. Check network configuration

### Installation Issues

#### **VSIX Installation Failed**
1. Ensure VSCode is closed during installation
2. Check file permissions
3. Try installing from command line:
   ```bash
   code --install-extension simplebeacon-1.1.0.vsix
   ```

#### **Extension Not Appearing**
1. Check VSCode extensions list
2. Look for "SimpleBeacon AI Slop Cop"
3. Enable the extension if it's disabled

### Debug Mode

#### **Enable Debug Logging**
Add these settings to your VSCode settings.json:
```json
{
  "simplebeacon.debug": true,
  "simplebeacon.verboseLogging": true
}
```

#### **Check Output Channel**
1. Go to View → Output
2. Select "SimpleBeacon" from the dropdown
3. Look for error messages and debug information

#### **Developer Console**
1. Go to Help → Toggle Developer Tools
2. Check the Console tab for JavaScript errors
3. Look for network issues in the Network tab

### Getting Help

#### **Collect Information**
When reporting issues, please provide:
1. VSCode version
2. SimpleBeacon extension version
3. Operating system
4. Error messages from output channel
5. Steps to reproduce the issue

#### **Support Channels**
- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Check the README and CHANGELOG
- **Community**: Join discussions for help

#### **Common Workarounds**
1. **Restart VSCode** - Fixes most temporary issues
2. **Reload Extension** - Resolves registration problems
3. **Clear Cache** - Fixes corrupted data issues
4. **Reinstall Extension** - Resolves installation problems

### Version-Specific Issues

#### **Version 1.1.0**
- **Enhanced AI View**: May need manual refresh after installation
- **Code Map**: Requires D3.js internet connection
- **Real-time Analysis**: Depends on server availability

#### **Migration from 1.0.x**
1. Uninstall old version first
2. Restart VSCode
3. Install new version
4. Check settings for compatibility

### Performance Optimization

#### **Large Projects**
1. Increase `simplebeacon.maxFiles` if needed
2. Add more exclude patterns
3. Use appropriate analysis profiles

#### **Memory Management**
1. Close unused webviews
2. Limit concurrent analyses
3. Restart VSCode periodically

#### **Network Optimization**
1. Use local AI models when possible
2. Configure timeouts appropriately
3. Monitor network usage

---

**If you continue to experience issues, please check the output channel and developer console for specific error messages, and report them to the SimpleBeacon team.**
