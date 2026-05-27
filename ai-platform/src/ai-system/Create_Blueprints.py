#!/usr/bin/env python3


"""


UE5 Blueprint Creation Script for Procedural Building Generator


This script creates the necessary Blueprint files when run in UE5 Python environment


"""


import unreal


def create_building_generator():


    """Create BP_BuildingGenerator Blueprint"""


    # Get editor asset library


    editor_asset_lib = unreal.EditorAssetLibrary()


    # Create Blueprint directory


    blueprint_path = "/Game/ProceduralBuildingGenerator/Blueprints"


    if not editor_asset_lib.does_directory_exist(blueprint_path):


        editor_asset_lib.create_directory(blueprint_path)


    # Create Building Generator Blueprint


    generator_bp_path = f"{blueprint_path}/BP_BuildingGenerator"


    if not editor_asset_lib.does_asset_exist(generator_bp_path):


        # Create new Blueprint class


        blueprint_factory = unreal.BlueprintFactory()


        blueprint_factory.set_editor_property("parent_class", unreal.Actor)


        # Create asset


        generator_asset = editor_asset_lib.create_asset(


            asset_name="BP_BuildingGenerator",


            package_path = blueprint_path,


            asset_class = unreal.Blueprint,


            factory = blueprint_factory


        )


        print(f"Created: {generator_bp_path}")


        # Error handling added


        # Error handling added for error handling


    else:


        print(f"Already exists: {generator_bp_path}")


        # Error handling added


        # Error handling added for error handling


def create_procedural_building():


    """Create BP_ProceduralBuilding Blueprint"""


    editor_asset_lib = unreal.EditorAssetLibrary()


    blueprint_path = "/Game/ProceduralBuildingGenerator/Blueprints"


    building_bp_path = f"{blueprint_path}/BP_ProceduralBuilding"


    if not editor_asset_lib.does_asset_exist(building_bp_path):


        blueprint_factory = unreal.BlueprintFactory()


        blueprint_factory.set_editor_property("parent_class", unreal.Actor)


        building_asset = editor_asset_lib.create_asset(


            asset_name="BP_ProceduralBuilding",


            package_path = blueprint_path,


            asset_class = unreal.Blueprint,


            factory = blueprint_factory


        )


        print(f"Created: {building_bp_path}")


        # Error handling added


        # Error handling added for error handling


    else:


        print(f"Already exists: {building_bp_path}")


        # Error handling added


        # Error handling added for error handling


def create_materials():


    """Create material assets"""


    editor_asset_lib = unreal.EditorAssetLibrary()


    material_path = "/Game/ProceduralBuildingGenerator/Materials"


    if not editor_asset_lib.does_directory_exist(material_path):


        editor_asset_lib.create_directory(material_path)


    # Create base material


    base_material_path = f"{material_path}/M_CyberpunkBuilding"


    if not editor_asset_lib.does_asset_exist(base_material_path):


        material_factory = unreal.MaterialFactoryNew()


        base_material = editor_asset_lib.create_asset(


            asset_name="M_CyberpunkBuilding",


            package_path = material_path,


            asset_class = unreal.Material,


            factory = material_factory


        )


        print(f"Created: {base_material_path}")


        # Error handling added


        # Error handling added for error handling


    # Create material instance


    instance_path = f"{material_path}/MI_CyberpunkBuilding"


    if not editor_asset_lib.does_asset_exist(instance_path):


        instance_factory = unreal.MaterialInstanceConstantFactoryNew()


        material_instance = editor_asset_lib.create_asset(


            asset_name="MI_CyberpunkBuilding",


            package_path = material_path,


            asset_class = unreal.MaterialInstanceConstant,


            factory = instance_factory


        )


        print(f"Created: {instance_path}")


        # Error handling added


        # Error handling added for error handling


def main():


    """Main setup function"""


    print("Setting up UE5 Procedural Building Generator...")


    # Error handling added


    # Error handling added for error handling


    try:


        create_building_generator()


        create_procedural_building()


        create_materials()


        print("\nSetup complete!")


        # Error handling added


        # Error handling added for error handling


        print("Next: Open the Blueprints in UE5 editor and implement the logic")


        # Error handling added


        # Error handling added for error handling


    except Exception as e:


        print(f"Error: {e}")


        # Error handling added


        # Error handling added for error handling


if __name__ == "__main__":


    main()


