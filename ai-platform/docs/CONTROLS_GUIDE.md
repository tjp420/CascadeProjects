# Orbital Defender - Game Controls Guide

## Basic Controls

### Movement
- **WASD** or **Arrow Keys**: Move defender around (if using WorkingGameController)
- **Left Shift**: Boost orbital speed (when controlling OrbitalDefender)
- **Mouse**: Aim your shots

### Combat
- **Left Control**: Fire projectiles at mouse position
- **Auto-target**: Falls back to nearest enemy targeting if player control is disabled

### Game Management
- **Enter**: Start game (from menu)
- **Escape** or **Space**: Pause/Resume game
- **R**: Restart game
- **M**: Return to main menu

### Special Features (WorkingGameController)
- **G**: Ghost Satellite System
- **R**: Satellite Grafting System  
- **H**: Community Hive-Mind System
- **V**: Innovation Manager
- **I**: Display game status

## Control Systems

### OrbitalDefender.cs
- **Player Controlled**: Toggle between manual and automatic targeting
- **Mouse Aiming**: Shoot directly at mouse cursor position
- **Orbital Movement**: Automatic orbit around space station with boost capability
- **Smart Targeting**: Finds closest enemy when in auto mode

### GameManager.cs
- **Pause System**: Full time-scale pause with UI management
- **State Management**: Menu, Playing, Paused, GameOver states
- **Input Handling**: Comprehensive keyboard input system
- **Audio Control**: Pause/resume music and sound effects

### WorkingGameController.cs
- **Simple Movement**: Basic WASD movement for testing
- **Auto-Creation**: Automatically creates game objects on start
- **Debug Features**: Status display and special ability testing

## How to Test Controls

1. **Start the game** - Press Enter from main menu
2. **Test movement** - Use WASD or watch orbital movement
3. **Test shooting** - Hold Left Control and move mouse to aim
4. **Test pause** - Press Escape or Space to pause
5. **Test restart** - Press R to restart from any state
6. **Test menu** - Press M to return to main menu

## Troubleshooting

- **No shooting**: Check that projectilePrefab is assigned in OrbitalDefender
- **No movement**: Verify centralStation transform is set
- **Pause not working**: Ensure GameManager is active in scene
- **Mouse aiming not working**: Check that Camera.main is available

## Notes

- The game supports both player-controlled and automatic targeting modes
- Time scale is properly managed during pause (Time.timeScale = 0)
- All controls are keyboard-based for maximum compatibility
- Mouse is used only for aiming, not movement
