# GZDoom weapon flicker patch draft

Applied: 2026-08-16

## Root cause

`r3d_fp_blacklist_current_weapon` writes weapon class names to `r3d_fp_flicker_disable_for_classes`, but the **active** handler at `R3DLighting/zscript/fplight/handlers/FPLightHandler.zs` did not read that CVAR in `UpdateFlicker()`. Only hard-coded fist classes were skipped.

The legacy handler at `zscript/handlers/FPLightHandler.zs` already had the blacklist check (lines 344–349) but is **not** included by `ZSCRIPT.zs`.

## Changes applied

### 1. CVARINFO — register persistent blacklist string

File: `E:/Ai/Games/Doom/TEst/results/R3DLighting/CVARINFO`

```diff
 server float r3d_fp_flicker_amount = 0.1;
+server string r3d_fp_flicker_disable_for_classes = "";
 server bool r3d_fp_manually_disabled = false;
```

### 2. FPLightHandler — honor blacklist in UpdateFlicker

File: `E:/Ai/Games/Doom/TEst/results/R3DLighting/zscript/fplight/handlers/FPLightHandler.zs`

After the fist-class check, added:

```zscript
let disableListCVar = CVar.FindCVar("r3d_fp_flicker_disable_for_classes");
if (disableListCVar)
{
    String list = disableListCVar.GetString();
    if (list != "" && list.IndexOf(wname) != -1) skipFlicker = true;
}
```

## Verify in GZDoom

1. Load mod with flicker enabled (`r3d_fp_flicker_enabled 1`).
2. Equip flickering weapon.
3. Console: `print players[consoleplayer].ReadyWeapon.GetClassName()`
4. Console: `r3d_fp_blacklist_current_weapon`
5. Flicker should stop for that weapon class immediately.

## Optional tuning (no code change)

| CVAR | Default | Effect |
|------|---------|--------|
| `r3d_fp_flicker_update_threshold` | 2.0 | Raise to reduce intensity step jitter |
| `r3d_fp_flicker_smoothness` | 0.2 | Raise toward 0.95 while holding weapon |
| `r3d_fp_disable_flicker_while_holding_weapon` | true | Set 0 to allow flicker while armed |
| `r3d_fp_weapon_hold_update_interval` | 12 | Raise to throttle updates while holding |

## If flicker persists

Paste weapon class name — add it manually:

```
r3d_fp_flicker_disable_for_classes "YourWeaponClass,OtherClass"
```

Or disable flicker globally: `r3d_fp_flicker_enabled 0`
