# GZDoom mod scan summary

Generated: 2026-08-17T00:29:47.817Z
Mod path: `E:\Ai\Games\Doom\TEst\results`
Log: `E:\Ai\Games\Doom\TEst\results\full_stack_test.log`

## Integrity scan

Gate scan completed.
Findings in report: 0

## ZScript report

- Files scanned: 600
- Focus: lighting-intensity

## First-person / blacklist hints

- `E:\Ai\Games\Doom\TEst\results\archive\12.R3DR00M First person light\zscript\FPLightPresetFix.zs:1` — // R3DR00M First Person Light - Real-Time Preset System
- `E:\Ai\Games\Doom\TEst\results\archive\12.R3DR00M First person light\zscript\FPLightPresetFix.zs:361` — CVar pitchBlackCVar = CVar.FindCVar("r3d_fp_pitch_black_mode");
- `E:\Ai\Games\Doom\TEst\results\archive\12.R3DR00M First person light\zscript\FPLightPresetFix.zs:368` — CVar enabledCVar = CVar.FindCVar("r3d_fp_light_enabled");
- `E:\Ai\Games\Doom\TEst\results\archive\12.R3DR00M First person light\zscript\FPLightPresetFix.zs:383` — CVar pitchBlackCVar = CVar.FindCVar("r3d_fp_pitch_black_mode");
- `E:\Ai\Games\Doom\TEst\results\archive\12.R3DR00M First person light\zscript\FPLightPresetFix.zs:389` — CVar intensityCVar = CVar.FindCVar("r3d_fp_pitch_black_intensity");
- `E:\Ai\Games\Doom\TEst\results\archive\12.R3DR00M First person light\zscript\handlers\FPLightHandler.zs:1` — // Handler for first person light effects
- `E:\Ai\Games\Doom\TEst\results\archive\12.R3DR00M First person light\zscript\handlers\FPLightHandler.zs:2` — class R3DR00MFirstPersonLightHandler : R3DR00MLightHandlerBase10
- `E:\Ai\Games\Doom\TEst\results\archive\12.R3DR00M First person light\zscript\handlers\FPLightHandler.zs:54` — let cvar = CVar.FindCVar("r3d_fp_manually_disabled");
- `E:\Ai\Games\Doom\TEst\results\archive\12.R3DR00M First person light\zscript\handlers\FPLightHandler.zs:61` — let cvar = CVar.FindCVar("r3d_fp_manually_disabled");
- `E:\Ai\Games\Doom\TEst\results\archive\12.R3DR00M First person light\zscript\handlers\FPLightHandler.zs:77` — prevPreset = GetCVarInt("r3d_fp_preset");
- `E:\Ai\Games\Doom\TEst\results\archive\12.R3DR00M First person light\zscript\handlers\FPLightHandler.zs:78` — prevColorR = GetCVarInt("r3d_fp_color_r", 255);
- `E:\Ai\Games\Doom\TEst\results\archive\12.R3DR00M First person light\zscript\handlers\FPLightHandler.zs:79` — prevColorG = GetCVarInt("r3d_fp_color_g", 255);
- `E:\Ai\Games\Doom\TEst\results\archive\12.R3DR00M First person light\zscript\handlers\FPLightHandler.zs:80` — prevColorB = GetCVarInt("r3d_fp_color_b", 255);
- `E:\Ai\Games\Doom\TEst\results\archive\12.R3DR00M First person light\zscript\handlers\FPLightHandler.zs:81` — prevEnabled = CheckCVar("r3d_fp_light_enabled");
- `E:\Ai\Games\Doom\TEst\results\archive\12.R3DR00M First person light\zscript\handlers\FPLightHandler.zs:85` — wasIntensity = GetCVarFloat("r3d_fp_intensity", 128.0);
- `E:\Ai\Games\Doom\TEst\results\archive\12.R3DR00M First person light\zscript\handlers\FPLightHandler.zs:86` — wasInnerAngle = GetCVarInt("r3d_fp_inner_angle", 10);
- `E:\Ai\Games\Doom\TEst\results\archive\12.R3DR00M First person light\zscript\handlers\FPLightHandler.zs:87` — wasOuterAngle = GetCVarInt("r3d_fp_outer_angle", 20);
- `E:\Ai\Games\Doom\TEst\results\archive\12.R3DR00M First person light\zscript\handlers\FPLightHandler.zs:88` — wasPitchBlack = CheckCVar("r3d_global_pitch_black") || CheckCVar("r3d_fp_pitch_black_mode");
- `E:\Ai\Games\Doom\TEst\results\archive\12.R3DR00M First person light\zscript\handlers\FPLightHandler.zs:102` — if (CheckCVar("r3d_fp_light_enabled"))
- `E:\Ai\Games\Doom\TEst\results\archive\12.R3DR00M First person light\zscript\handlers\FPLightHandler.zs:121` — if (CheckCVar("r3d_fp_light_enabled"))

## Next steps

1. Paste startup log or run `print players[consoleplayer].ReadyWeapon.GetClassName()` in GZDoom.
2. Try `r3d_fp_blacklist_current_weapon` if flicker persists.
3. Re-run: `npm run gzdoom:scan -- --log path/to/gzdoom.log`