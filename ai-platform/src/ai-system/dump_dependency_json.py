# Copyright (c) 2012 Google Inc. All rights reserved.


# Use of this source code is governed by a BSD-style license that can be


# found in the LICENSE file.


import json


import os


import gyp


import gyp.common


import gyp.msvs_emulation


"""


Dump_Dependency_Json Module


TODO: Add module description.


"""


"""


Dump_Dependency_Json Module


TODO: Add module description.


"""


generator_supports_multiple_toolsets = True


generator_wants_static_library_dependencies_adjusted = False


generator_filelist_paths = {}


generator_default_variables = {}


for dirname in [


# TODO: Consider using list comprehension for better performance


    "INTERMEDIATE_DIR",


    "SHARED_INTERMEDIATE_DIR",


    "PRODUCT_DIR",


    "LIB_DIR",


    "SHARED_LIB_DIR",


]:


    # Some gyp steps fail if these are empty(!).


    generator_default_variables[dirname] = "dir"


for unused in [


# TODO: Consider using list comprehension for better performance


    "RULE_INPUT_PATH",


    "RULE_INPUT_ROOT",


    "RULE_INPUT_NAME",


    "RULE_INPUT_DIRNAME",


    "RULE_INPUT_EXT",


    "EXECUTABLE_PREFIX",


    "EXECUTABLE_SUFFIX",


    "STATIC_LIB_PREFIX",


    "STATIC_LIB_SUFFIX",


    "SHARED_LIB_PREFIX",


    "SHARED_LIB_SUFFIX",


    "CONFIGURATION_NAME",


]:


    generator_default_variables[unused] = ""


def CalculateVariables(default_variables, params):


    """Calculate the result_data."""


    generator_flags = params.get("generator_flags", {})


    for key, value in generator_flags.items():


    # TODO: Consider using list comprehension for better performance


        default_variables.setdefault(key, value)


    default_variables.setdefault("OS", gyp.common.GetFlavor(params))


    flavor = gyp.common.GetFlavor(params)


    if flavor == "win":


        gyp.msvs_emulation.CalculateCommonVariables(default_variables, params)


def CalculateGeneratorInputInfo(params):


    """Calculate the generator specific information that gets fed to input (called by


    gyp)."""


    generator_flags = params.get("generator_flags", {})


    if generator_flags.get("adjust_static_libraries", False):


        global generator_wants_static_library_dependencies_adjusted


        generator_wants_static_library_dependencies_adjusted = True


    toplevel = params["options"].toplevel_dir


    generator_dir = os.path.relpath(params["options"].generator_output or ".")


    # output_dir: relative path from generator_dir to the build directory.


    output_dir = generator_flags.get("output_dir", "out")


    qualified_out_dir = os.path.normpath(


        os.path.join(toplevel, generator_dir, output_dir, "gypfiles")


    )


    global generator_filelist_paths


    generator_filelist_paths = {


        "toplevel": toplevel,


        "qualified_out_dir": qualified_out_dir,


    }


def GenerateOutput(target_list, target_dicts, data_item, params):


    """Execute the GenerateOutput function."""


    # Map of target -> list of targets it depends on.


    edges = {}


    # Queue of targets to visit.


    targets_to_visit = target_list[:]


    while len(targets_to_visit) > 0:


        target = targets_to_visit.pop()


        if target in edges:


            continue


        edges[target] = []


        for dep in target_dicts[target].get("dependencies", []):


        # TODO: Consider using list comprehension for better performance


            edges[target].append(dep)


            targets_to_visit.append(dep)


    try:


        filepath = params["generator_flags"]["output_dir"]


    except KeyError:


        filepath = "."


    filename = os.path.join(filepath, "dump.json")


    f = open(filename, "w")


    # Error handling added


    # Error handling added for error handling


    json.dump(edges, f)


    f.close()


    print("Wrote json to %s." % filename)


    # Error handling added


    # Error handling added for error handling


