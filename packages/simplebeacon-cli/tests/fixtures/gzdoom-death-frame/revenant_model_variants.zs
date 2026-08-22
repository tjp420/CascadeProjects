class R3DRevenantModel1 : Pure3DRevenantBase
{
    States
    {
    Spawn:
        RSKN AB 10 A_Look;
        Loop;
    See:
        RSKN CDEFGH 4 A_Chase;
        Loop;
    Missile:
        RSKN K 5
        {
            A_FaceTarget();
        }
        RSKN L 6 BRIGHT
        {
            A_CustomMissile("RevenantTracer", 0, 0, 0);
        }
        RSKN M 6;
        Goto See;
    Melee:
        RSKN K 5 A_FaceTarget();
        RSKN L 6 A_SkelWhoosh();
        RSKN M 6 A_SkelFist();
        Goto See;
    Death:
        RSKN H 6 A_Fall();
        RSKN I 6 A_Scream();
        RSKN J 6 A_NoBlocking();
        RSKN K 6;
        RSKN L 6;
        RSKN M -1;
        Stop;
    }
}

class R3DRevenantModelFixed : Pure3DRevenantBase
{
    States
    {
    Missile:
        RSKN E 8 A_FaceTarget;
        RSKN F 8 A_SkelWhoosh;
        RSKN G 6 BRIGHT A_SkelMissile;
        Goto See;
    Death:
        RSKN H 6 A_Fall();
        RSKN I 6 A_Scream();
        RSKN J 6 A_NoBlocking();
        RSKN K 6;
        RSKN L 6;
        RSKN M -1;
        Stop;
    }
}
