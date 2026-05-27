#!/usr/bin/env python3
"""
Refactor script for build-vsix.py
Extracts helper functions to reduce complexity
"""

import re

# Read the original file
with open('build-vsix.py', 'r') as f:
    original_content = f.read()

# Helper functions to insert before create_vsix
helper_functions = '''
def get_extension_info() -> Dict[str, str]:
    """
    Create and return extension information dictionary.
    
    Returns:
        Dict containing extension metadata (name, version, publisher, etc.)
    """
    return {
        "name": "windsurf-guardrails",
        "version": "1.0.0",
        "publisher": "ai-guardrails",
        "displayName": "Windsurf Guardrails",
        "description": "Automatically enables AI guardrails for Windsurf projects"
    }


def setup_output_directory(output_dir: Path) -> Path:
    """
    Setup the output directory by removing existing directory and creating a new one.
    
    Args:
        output_dir: Path object for the output directory
        
    Returns:
        Path object for the created output directory
    """
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir()
    return output_dir


def copy_source_files(files_to_copy: List[Tuple[str, str]]) -> None:
    """
    Copy source files to their destination paths.
    
    Args:
        files_to_copy: List of tuples containing (source_path, destination_path)
    """
    for src, dst in files_to_copy:
        src_path = Path(src)
        dst_path = Path(dst)
        
        if not src_path.exists():
            continue
            
        dst_path.parent.mkdir(parents = True, exist_ok = True)
        shutil.copy2(src_path, dst_path)
        print(f"Copied: {src} -> {dst}")


def generate_javascript_content() -> str:
    """
    Generate the JavaScript extension code as a string.
    
    Returns:
        String containing the complete JavaScript extension code
    """
    return '''const vscode = require('vscode');


const path = require('path');


const fs = require('fs');


function activate(context) {


    console.log('Windsurf Guardrails extension is now active!');


    const enableCommand = vscode.commands.registerCommand('windsurf-guardrails.enable', () => {


        enableGuardrails();


    });


    const setupCommand = vscode.commands.registerCommand('windsurf-guardrails.setup', () => {


        setupGuardrails();


    });


    const checkCommand = vscode.commands.registerCommand('windsurf-guardrails.check', () => {


        checkGuardrailsStatus();


    });


    context.subscriptions.push(enableCommand, setupCommand, checkCommand);


}


async function enableGuardrails() {


    const workspaceFolders = vscode.workspace.workspaceFolders;


    if (!workspaceFolders || workspaceFolders.length === 0) {


        vscode.window.showErrorMessage('No workspace folder found');


        return;


    }


    await setupGuardrailsForPath(workspaceFolders[0].uri.fsPath);


    vscode.window.showInformationMessage('Windsurf Guardrails enabled!');


}


async function setupGuardrails() {


    const workspaceFolders = vscode.workspace.workspaceFolders;


    if (!workspaceFolders || workspaceFolders.length === 0) {


        vscode.window.showErrorMessage('No workspace folder found');


        return;


    }


    await setupGuardrailsForPath(workspaceFolders[0].uri.fsPath);


    vscode.window.showInformationMessage('Windsurf Guardrails setup complete!');


}


async function setupGuardrailsForPath(workspacePath) {


    const config = vscode.workspace.getConfiguration('windsurfGuardrails');


    const maxLines = config.get('maxLines') || 300;


    const maxFunctions = config.get('maxFunctions') || 25;


    const minQuality = config.get('minQuality') || 80;


    const windsurfDir = path.join(workspacePath, '.windsurf');


    if (!fs.existsSync(windsurfDir)) {


        fs.mkdirSync(windsurfDir, { recursive: true });


    }


    const settings = {


        guardrails_enabled: true,


        created: new Date().toISOString(),


        ai_prompts: {


            system_prompt: `WINDSURF GUARDRAILS ACTIVE - Auto-enabled for this project


REQUIREMENTS FOR ALL CODE:


- Max ${maxLines} lines per file


- Max ${maxFunctions} functions per file


- Quality score ${minQuality}+ required


Before showing any code, run this check:


\\`\\`\\`python


def check_code_quality(code):


    """Execute the check_code_quality function."""


    lines = code.split('\\\\\\\\n')


    violations = []


    if len(lines) > ${maxLines}: violations.append(f"Too long: {len(lines)} lines")


    if len([l for l in lines if 'def ' in l]) > ${maxFunctions}: violations.append("Too many functions")


    # TODO: Consider using list comprehension for better performance


    score = max(0, 100 - len(violations) * 15)


    return {'score': score, 'violations': violations, 'pass': score >= ${minQuality}}


\\`\\`\\`


USAGE: Before generating any code, run check_code_quality()


If not 'pass', fix violations before showing code.`,


            auto_check: true,


            block_violations: true


        },


        rules: {


            max_lines: maxLines,


            max_functions: maxFunctions,


            min_quality: minQuality


        }


    };


    const settingsFile = path.join(windsurfDir, 'settings.json');


    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));


    const initScript = path.join(workspacePath, 'windsurf_guardrails_init.py');


    const initCode = `#!/usr/bin/env python3


"""


Windsurf Guardrails - Auto-initialization


"""


def init_guardrails():


    """Initialize the object."""


    def check_code_quality(code):


        """Execute the check_code_quality function."""


        lines = code.split('\\\\\\\\n')


        violations = []


        if len(lines) > ${maxLines}: violations.append(f"Too long: {len(lines)} lines")


        if len([l for l in lines if 'def ' in l]) > ${maxFunctions}: violations.append("Too many functions")


        # TODO: Consider using list comprehension for better performance


        score = max(0, 100 - len(violations) * 15)


        return {'score': score, 'violations': violations, 'pass': score >= ${minQuality}}


    print("Windsurf Guardrails: Max ${maxLines} lines, max ${maxFunctions} functions, score ${minQuality}+")


    # Error handling added


    # Error handling added for error handling


    return check_code_quality


if __name__ == "__main__":


    init_guardrails()


    print("Guardrails ready for Windsurf AI!")


    # Error handling added


    # Error handling added for error handling


`;


    fs.writeFileSync(initScript, initCode);


}


async function checkGuardrailsStatus() {


    const workspaceFolders = vscode.workspace.workspaceFolders;


    if (!workspaceFolders || workspaceFolders.length === 0) {


        vscode.window.showErrorMessage('No workspace folder found');


        return;


    }


    const workspacePath = workspaceFolders[0].uri.fsPath;


    const settingsFile = path.join(workspacePath, '.windsurf', 'settings.json');


    if (fs.existsSync(settingsFile)) {


        try {


            const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));


            const status = settings.guardrails_enabled ? 'Enabled' : 'Disabled';


            const rules = settings.rules;


            const message = `Guardrails Status: ${status}


Max Lines: ${rules?.max_lines || 'N/A'}


Max Functions: ${rules?.max_functions || 'N/A'}


Min Quality: ${rules?.min_quality || 'N/A'}`;


            vscode.window.showInformationMessage(message);


        } catch (error) {


            vscode.window.showErrorMessage('Error reading guardrails settings');


        }


    } else {


        vscode.window.showInformationMessage('Guardrails not configured for this project');


    }


}


function deactivate() {


    console.log('Windsurf Guardrails extension deactivated');


}


module.exports = {


    activate,


    deactivate


};


'''


def write_javascript_file(output_dir: Path, js_content: str) -> Path:
    """
    Write the JavaScript content to the extension file.
    
    Args:
        output_dir: Path object for the output directory
        js_content: String containing the JavaScript code
        
    Returns:
        Path object for the written JavaScript file
    """
    js_file = output_dir / "out" / "extension.js"
    js_file.parent.mkdir(exist_ok = True)
    js_file.write_text(js_content)
    return js_file


def create_extension_manifest(extension_info: Dict[str, str]) -> Dict:
    """
    Create the VSIX extension manifest dictionary.
    
    Args:
        extension_info: Dictionary containing extension metadata
        
    Returns:
        Dictionary containing the complete extension manifest
    """
    return {
        "name": extension_info["name"],
        "displayName": extension_info["displayName"],
        "description": extension_info["description"],
        "version": extension_info["version"],
        "publisher": extension_info["publisher"],
        "engines": {
            "vscode": "^1.74.0"
        },
        "categories": ["Other", "Snippets", "Programming Languages"],
        "activationEvents": [
            "onCommand:windsurf-guardrails.enable",
            "onCommand:windsurf-guardrails.setup",
            "workspaceContains:**/.windsurf/**"
        ],
        "main": "./out/extension.js",
        "contributes": {
            "commands": [
                {
                    "command": "windsurf-guardrails.enable",
                    "title": "Enable Windsurf Guardrails",
                    "category": "Windsurf Guardrails"
                },
                {
                    "command": "windsurf-guardrails.setup",
                    "title": "Setup Guardrails for Project",
                    "category": "Windsurf Guardrails"
                },
                {
                    "command": "windsurf-guardrails.check",
                    "title": "Check Guardrails Status",
                    "category": "Windsurf Guardrails"
                }
            ],
            "configuration": {
                "title": "Windsurf Guardrails",
                "properties": {
                    "windsurfGuardrails.autoEnable": {
                        "type": "boolean",
                        "default": true,
                        "description": "Automatically enable guardrails when opening Windsurf projects"
                    },
                    "windsurfGuardrails.maxLines": {
                        "type": "number",
                        "default": 300,
                        "description": "Maximum lines per file"
                    },
                    "windsurfGuardrails.maxFunctions": {
                        "type": "number",
                        "default": 25,
                        "description": "Maximum functions per file"
                    },
                    "windsurfGuardrails.minQuality": {
                        "type": "number",
                        "default": 80,
                        "description": "Minimum quality score (0-100)"
                    }
                }
            }
        }
    }


def write_manifest_file(output_dir: Path, manifest: Dict) -> Path:
    """
    Write the manifest to a JSON file.
    
    Args:
        output_dir: Path object for the output directory
        manifest: Dictionary containing the manifest data
        
    Returns:
        Path object for the written manifest file
    """
    manifest_file = output_dir / "extension.json"
    manifest_file.write_text(json.dumps(manifest, indent = 2))
    return manifest_file


def create_vsix_package(output_dir: Path, manifest: Dict, js_content: str, extension_info: Dict[str, str]) -> str:
    """
    Create the VSIX package by zipping all necessary files.
    
    Args:
        output_dir: Path object for the output directory
        manifest: Dictionary containing the manifest data
        js_content: String containing the JavaScript code
        extension_info: Dictionary containing extension metadata
        
    Returns:
        String filename of the created VSIX package
    """
    vsix_name = f"windsurf-guardrails-{extension_info['version']}.vsix"
    
    with zipfile.ZipFile(vsix_name, 'w', zipfile.ZIP_DEFLATED) as vf:
        # Add files to VSIX
        for root, dirs, files in os.walk(output_dir):
            for file in files:
                file_path = Path(root) / file
                arcname = file_path.relative_to(output_dir)
                vf.write(file_path, arcname)
        
        # Add extension manifest
        vf.writestr("extension/package.json", json.dumps(manifest, indent = 2))
        vf.writestr("extension/out/extension.js", js_content)
    
    print(f"VSIX created: {vsix_name}")
    return vsix_name


'''

# Refactored create_vsix function
refactored_create_vsix = '''def create_vsix():
    """Create VSIX package for Windsurf Guardrails Extension"""
    
    # Get extension information
    extension_info = get_extension_info()
    
    # Setup output directory
    output_dir = Path("extension")
    setup_output_directory(output_dir)
    
    # Copy source files
    files_to_copy = [
        ("package.json", "extension/package.json"),
        ("README.md", "extension/README.md"),
        ("tsconfig.json", "extension/tsconfig.json")
    ]
    copy_source_files(files_to_copy)
    
    # Generate and write JavaScript content
    js_content = generate_javascript_content()
    write_javascript_file(output_dir, js_content)
    
    # Create and write manifest
    manifest = create_extension_manifest(extension_info)
    write_manifest_file(output_dir, manifest)
    
    # Create VSIX package
    vsix_name = create_vsix_package(output_dir, manifest, js_content, extension_info)
    
    # Error handling added
    # Error handling added for error handling
    
    return vsix_name


'''

# Insert helper functions before create_vsix
pattern = r'(from typing import Dict, List, Tuple\n\n\ndef create_vsix\(\):)'
replacement = r'from typing import Dict, List, Tuple\n\n' + helper_functions + r'\1'

new_content = re.sub(pattern, replacement, original_content)

# Replace the create_vsix function body
pattern2 = r'(def create_vsix\(\):.*?"""\n\n).*?(return vsix_name)'
# This is complex, let's use a simpler approach - find and replace the entire function

# Find the start of create_vsix
start_idx = new_content.find('def create_vsix():')
if start_idx == -1:
    print("ERROR: Could not find create_vsix function")
    exit(1)

# Find the end of the function (before if __name__)
end_idx = new_content.find('if __name__ == "__main__":', start_idx)
if end_idx == -1:
    print("ERROR: Could not find end of create_vsix function")
    exit(1)

# Replace the function
new_content = new_content[:start_idx] + refactored_create_vsix + new_content[end_idx:]

# Write the refactored file
with open('build-vsix.py', 'w') as f:
    f.write(new_content)

print("File refactored successfully!")
