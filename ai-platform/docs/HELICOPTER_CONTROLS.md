# Helicopter Controls - Mouse Aim + WASD Movement

## Movement Controls (WASD)
- **W** or **Up Arrow**: Move forward in current facing direction
- **S** or **Down Arrow**: Move backward
- **A** or **Left Arrow**: Turn helicopter left
- **D** or **Right Arrow**: Turn helicopter right
- **Q**: Go up (increase altitude)
- **E**: Go down (decrease altitude)

## Combat Controls (Mouse + Keyboard)
- **Mouse**: Aim gun/turret independently of helicopter movement
- **Left Click**: Fire weapons in mouse direction (immediate fire)
- **F or Enter**: Fire weapons manually (backup option)
- **1-9 Keys**: Select weapons
- **Space**: Toggle auto-fire (shoots immediately when toggled on)

## How Controls Work
1. **Independent Aiming**: Mouse controls gun/turret direction (red/yellow barrel)
2. **WASD Movement**: Helicopter moves independently of gun aiming
3. **360° Combat**: Shoot in any direction while moving
4. **Strafing**: Move sideways while shooting perpendicular
5. **Altitude**: Use Q/E for vertical movement

## Visual Indicators
- **White Windshield**: Front of helicopter (movement direction)
- **Red/Yellow Barrel**: Gun turret (aiming direction)
- **Blue Cockpit**: Front of aircraft
- **Tail Boom**: Back of aircraft

## Debug Information
Check browser console (F12) for movement debug output:
- Shows angle, speed, and velocity values
- Helps verify helicopter moves in correct direction

## Troubleshooting
If helicopter still flies backwards:
1. Check browser console for debug output
2. Ensure mouse is positioned where you want to go
3. Press W gently to start forward movement
4. Use A/D keys to adjust direction if needed

## Fixed Issues
- Initial angle set to 0 (pointing right)
- Improved mouse aiming logic
- Added movement debugging
- Better control responsiveness
