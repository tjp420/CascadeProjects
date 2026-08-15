/**
 * GZDoom / Doom engine built-in actor classes — exist at runtime without mod source.
 * Used to suppress false-positive unresolved-reference findings.
 */

const GZDoom_VANILLA_ACTORS = new Set([
    // Base types
    'Actor', 'Inventory', 'Weapon', 'Ammo', 'Armor', 'Health', 'Powerup', 'Key',
    'CustomInventory', 'RandomSpawner', 'Debris', 'Projectile', 'FastProjectile',
    'Grenade', 'PuzzleItem', 'MapRevealer', 'ScoreItem', 'CustomPlayerInventory',
    // Player / mobj
    'PlayerPawn', 'DoomPlayer', 'HereticPlayer', 'HexenPlayer', 'StrifePlayer',
    // Classic Doom weapons
    'Fist', 'Pistol', 'Shotgun', 'SuperShotgun', 'Chaingun', 'RocketLauncher',
    'PlasmaRifle', 'BFG9000', 'Chainsaw', 'SuperShotgun', 'Minigun',
    // Classic Doom ammo
    'Clip', 'ClipBox', 'Shell', 'ShellBox', 'Cell', 'CellPack',
    'RocketAmmo', 'RocketBox', 'PlasmaCell', 'PlasmaBox', 'BFGCell', 'BFGCellPack',
    'Backpack', 'BackPack',
    // Classic Doom pickups / items
    'Medikit', 'Stimpack', 'HealthBonus', 'ArmorBonus', 'Soulsphere', 'Megasphere',
    'InvulnerabilitySphere', 'InvisibilitySphere', 'RadSuit', 'BlurSphere',
    'Allmap', 'Infrared', 'Supercharge', 'Berserk', 'Blursphere',
    'BlueCard', 'RedCard', 'YellowCard', 'SkullKey', 'BlueSkull', 'RedSkull',
    'YellowSkull', 'BlueKey', 'RedKey', 'YellowKey',
    // Common spawn / effect actors
    'Rocket', 'PlasmaBall', 'BFGBall', 'BulletPuff', 'Blood', 'BrutalBlood',
    'Explosion', 'MushroomCloud', 'TeleportFog', 'BulletSpark',
    'Casing', 'ShotgunCasing', 'RifleCasing', 'PistolCasing',
    'ChaingunCasing', 'ClipSpawner', 'ShellSpawner', 'CellSpawner',
    // Doom monsters (frequently referenced)
    'DoomImp', 'Demon', 'BaronOfHell', 'Cacodemon', 'LostSoul', 'ShotgunGuy',
    'ZombieMan', 'ChaingunGuy', 'Revenant', 'Archvile', 'Mancubus', 'Arachnotron',
    'PainElemental', 'Cyberdemon', 'SpiderMastermind', 'WolfensteinSS',
    // Heretic / Hexen common
    'GoldWand', 'Mace', 'Crossbow', 'Blaster',
    // GZDoom specials
    'DynamicLight', 'SectorAction', 'StaticEventHandler', 'EventHandler',
    'MapSpot', 'MapMarker', 'PointPusher', 'PointPuller',
    'HiddenFloor', 'HiddenCeiling', 'StackPoint', 'PathFollower',
    'InterpolationPoint', 'PatrolPoint', 'ActorMover', 'FloorWaggle',
    'SecretTrigger', 'SecretExit', 'ExitPortal', 'SkyCamCompat',
    'DoomCompat', 'HereticCompat', 'HexenCompat', 'StrifeCompat',
    // Pickup variants often referenced in mods
    'ClipBox2', 'AmmoClip', 'AmmoShell', 'AmmoCell', 'AmmoRocket',
    'WeaponSlot1', 'WeaponSlot2', 'WeaponSlot3', 'WeaponSlot4',
    'ArtiTeleport', 'ArtiHealth', 'ArtiInvulnerability'
]);

/** Function-name hints for intentional strip/remove inventory cleanup (not bugs). */
const INTENTIONAL_INVENTORY_FN_RE = /(?:Strip|Remove|Cleanup|Clear|Purge|Detach|Drop|Discard|Delete|Destroy|Wipe|Reset|Saniti)/i;

function isVanillaActor(className) {
    if (!className || typeof className !== 'string') return false;
    return GZDoom_VANILLA_ACTORS.has(className);
}

function isIntentionalInventoryFunction(functionName) {
    if (!functionName || typeof functionName !== 'string') return false;
    return INTENTIONAL_INVENTORY_FN_RE.test(functionName);
}

module.exports = {
    GZDoom_VANILLA_ACTORS,
    INTENTIONAL_INVENTORY_FN_RE,
    isVanillaActor,
    isIntentionalInventoryFunction
};
