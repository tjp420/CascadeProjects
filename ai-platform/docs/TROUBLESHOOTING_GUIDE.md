# R3DR00M Monster System - Menu Troubleshooting Guide

## Quick Fix Checklist

### 1. File Naming Issues
- **Problem**: Menu not appearing in Options
- **Solution**: Ensure you have `MENUDEF.txt` (with .txt extension) in your mod root
- **Alternative**: Some GZDoom versions accept `MENUDEF` without extension

### 2. File Encoding
- **Problem**: Menu appears garbled or causes crashes
- **Solution**: Save MENUDEF.txt as UTF-8 without BOM
- **How**: In Notepad++: Encoding > Convert to UTF-8 (without BOM)

### 3. Line Endings
- **Problem**: Menu doesn't parse correctly
- **Solution**: Use Windows line endings (CRLF)
- **How**: In Notepad++: Edit > EOL Conversion > Windows (CR LF)

## Step-by-Step Troubleshooting

### Step 1: Test with Minimal Menu
1. Rename your current `MENUDEF.txt` to `MENUDEF_backup.txt`
2. Copy `MENUDEF_minimal.txt` to `MENUDEF.txt`
3. Launch GZDoom with your mod
4. Check if "R3DR00M Test" appears in Options menu

**If minimal version works**: Your full MENUDEF has syntax errors
**If minimal version fails**: File loading/naming issue

### Step 2: Check Console for Errors
1. Launch GZDoom with: `gzdoom.exe -file "YourModName.pk3" +logfile "debug.log"`
2. Open the debug.log file
3. Look for lines containing "MENUDEF" or "menu" errors

Common error messages:
- `Unknown menu item type` - Syntax error in MENUDEF
- `Menu 'MenuName' not found` - Missing menu definition
- `CVAR 'cvarname' not found` - Missing CVARINFO entry

### Step 3: Verify File Structure
Your mod should have this structure:
```
YourMod.pk3/
├── MENUDEF.txt (or MENUDEF)
├── CVARINFO
├── consolecommandhandler.zs
└── console_docs_fixed.cfg
```

### Step 4: Check CVARINFO Compatibility
Ensure all CVARs referenced in MENUDEF exist in CVARINFO:
- `hellfire_health`
- `wraith_health` 
- `r3d_monster_health`
- `mm_vfx_level`
- etc.

### Step 5: Test Individual Components

**Test CVARs**:
```
// In console, type:
set hellfire_health 200
echo $hellfire_health
```

**Test Commands**:
```
// In console, type:
netevent r3droom_reset_cvars
summon HellfireCorruptedSoldier
```

## Common Issues & Solutions

### Issue: "Menu appears but options don't work"
**Cause**: Missing event handler or CVAR definitions
**Solution**: 
1. Ensure `consolecommandhandler.zs` is in mod root
2. Verify all CVARs in CVARINFO match MENUDEF

### Issue: "Menu appears but crashes when opened"
**Cause**: Invalid option values or missing OptionValue definitions
**Solution**: Check all OptionValue blocks are properly defined

### Issue: "Menu doesn't appear at all"
**Cause**: File not loaded or syntax error preventing parsing
**Solutions**:
1. Check file is named correctly (`MENUDEF.txt`)
2. Verify file encoding (UTF-8 without BOM)
3. Test with minimal version first
4. Check console for error messages

### Issue: "Some menu items are missing"
**Cause**: Syntax errors in specific menu sections
**Solution**: 
1. Use minimal version as base
2. Add sections one at a time
3. Test after each addition

### Issue: "Commands don't execute"
**Cause**: Missing event handler or incorrect command syntax
**Solution**:
1. Verify `consolecommandhandler.zs` is loaded
2. Test commands manually in console first
3. Check NetworkProcess function handles the event names

## Advanced Debugging

### Enable Verbose Logging
Add to your autoexec.cfg:
```
developer 1
am_showkeys 1
```

### Manual Command Testing
Test each command individually:
```
// Test summoning
summon HellfireCorruptedSoldier

// Test events  
netevent quicktest
netevent validatemonsters

// Test CVARs
set r3d_monster_health 2.0
echo $r3d_monster_health
```

### Check Load Order
If using multiple mods:
1. Load R3DR00M Monster System last
2. Check for conflicting MENUDEF modifications
3. Use `+logfile` to see load order

## File Templates

### Minimal Working MENUDEF.txt
```menudef
AddOptionMenu "OptionsMenu"
{
    StaticText "R3DR00M Test", "Red"
}
```

### Basic CVARINFO
```
server int hellfire_health = 150;
server int wraith_health = 100;
server float r3d_monster_health = 1.0;
server int mm_vfx_level = 2;
```

### Test Event Handler
```zscript
class TestHandler : EventHandler
{
    override void NetworkProcess(ConsoleEvent e)
    {
        if (e.Name == "test_event")
        {
            Console.Printf("Event handler working!");
        }
    }
}
```

## Final Checklist

- [ ] MENUDEF.txt exists in mod root
- [ ] File saved as UTF-8 without BOM
- [ ] Windows line endings (CRLF)
- [ ] All CVARs defined in CVARINFO
- [ ] Event handler (.zs file) present
- [ ] No syntax errors in MENUDEF
- [ ] Tested with minimal version first
- [ ] Checked console for error messages

If all else fails, start with `MENUDEF_minimal.txt` and gradually add features until you identify the problematic section.
