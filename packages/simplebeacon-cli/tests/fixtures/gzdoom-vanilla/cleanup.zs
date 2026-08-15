class StripHelper : Actor
{
    void StripRenderAliases(Actor other)
    {
        other.TakeInventory("RenderAliasToken", 1);
    }
}

class RealBug : Actor
{
    void DoTakeOnly()
    {
        TakeInventory("NeverGivenItem", 1);
    }
}
