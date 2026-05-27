# Menu Not Appearing - Debug Steps

## Immediate Actions Required

### Step 1: Check File Location
- Are the MENUDEF files in the correct mod directory?
- Is the mod being loaded by GZDoom?

### Step 2: Test Absolute Minimal Version
1. Copy `MENUDEF_absolute_minimal` to your mod folder as `MENUDEF`
2. Launch GZDoom with: `gzdoom.exe -file YourMod.pk3`
3. Check Options menu for "TEST WORKING" text

### Step 3: Console Debug
Launch with logging:
```
gzdoom.exe -file YourMod.pk3 +logfile debug.log +developer 1
```

Check debug.log for:
- "Loading MENUDEF"
- "Unknown menu item"
- "Parse error"

### Step 4: Manual Console Test
In GZDoom console, type:
```
menu_options
```
This should show the Options menu directly.

### Step 5: Verify Mod Loading
In console, type:
```
dir
```
Look for your mod files in the output.

## Common Causes

1. **Wrong file location** - MENUDEF not in mod root
2. **Mod not loading** - GZDoom not finding the .pk3 file
3. **File encoding** - Not UTF-8 or has BOM
4. **Syntax error** - Even minimal syntax can fail
5. **GZDoom version** - Some versions handle MENUDEF differently

## Quick Test Commands

```
// Test if mod is loaded
summon HellfireCorruptedSoldier

// Test console commands
netevent quicktest

// Check CVARs
set hellfire_health 200
echo $hellfire_health
```

If none of these work, the mod itself isn't loading properly.
