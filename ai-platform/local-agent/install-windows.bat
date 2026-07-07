@echo off
:: SimpleBeacon Local Agent installer launcher.
:: Right-click this file and choose "Run as administrator" if you want a system-wide
:: install, otherwise double-click for a per-user install.

powershell -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
