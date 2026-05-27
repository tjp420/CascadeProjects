/**
 * Dashboard Analyzer - Find Directory Selection Options
 * Run this script in your browser console to analyze the dashboard
 */

function analyzeDashboardForDirectoryOptions() {
    console.log('🔍 Analyzing dashboard for directory selection options...\n');
    
    const findings = {
        directoryInputs: [],
        fileInputs: [],
        buttons: [],
        textInputs: [],
        modals: [],
        settings: []
    };
    
    // 1. Look for directory/file inputs
    const allInputs = document.querySelectorAll('input');
    allInputs.forEach(input => {
        if (input.type === 'file') {
            findings.fileInputs.push({
                element: input,
                hasDirectory: input.hasAttribute('webkitdirectory'),
                accept: input.accept,
                id: input.id,
                className: input.className,
                visible: input.offsetWidth > 0 && input.offsetHeight > 0
            });
        }
    });
    
    // 2. Look for directory-related buttons
    const allButtons = document.querySelectorAll('button, .btn, [role="button"]');
    allButtons.forEach(button => {
        const text = button.textContent.toLowerCase();
        const labels = ['browse', 'select', 'directory', 'folder', 'project', 'analyze', 'scan', 'load'];
        
        if (labels.some(label => text.includes(label))) {
            findings.buttons.push({
                element: button,
                text: button.textContent,
                id: button.id,
                className: button.className,
                visible: button.offsetWidth > 0 && button.offsetHeight > 0
            });
        }
    });
    
    // 3. Look for text inputs that might be for paths
    const textInputs = document.querySelectorAll('input[type="text"], input:not([type])');
    textInputs.forEach(input => {
        const placeholder = (input.placeholder || '').toLowerCase();
        const id = (input.id || '').toLowerCase();
        const labels = ['path', 'directory', 'folder', 'project', 'location'];
        
        if (labels.some(label => placeholder.includes(label) || id.includes(label))) {
            findings.textInputs.push({
                element: input,
                placeholder: input.placeholder,
                id: input.id,
                value: input.value,
                visible: input.offsetWidth > 0 && input.offsetHeight > 0
            });
        }
    });
    
    // 4. Look for modals or popups
    const modals = document.querySelectorAll('.modal, .popup, .dialog, [role="dialog"]');
    modals.forEach(modal => {
        findings.modals.push({
            element: modal,
            id: modal.id,
            className: modal.className,
            visible: modal.offsetWidth > 0 && modal.offsetHeight > 0
        });
    });
    
    // 5. Look for settings/config panels
    const settings = document.querySelectorAll('.settings, .config, .configuration, .sidebar, .panel');
    settings.forEach(setting => {
        findings.settings.push({
            element: setting,
            id: setting.id,
            className: setting.className,
            visible: setting.offsetWidth > 0 && input.offsetHeight > 0
        });
    });
    
    // 6. Look for any element with directory-related text
    const allElements = document.querySelectorAll('*');
    const directoryElements = [];
    allElements.forEach(element => {
        const text = element.textContent.toLowerCase();
        const labels = ['directory', 'folder', 'project path', 'analyze', 'scan', 'browse'];
        
        if (labels.some(label => text.includes(label)) && element.children.length === 0) {
            directoryElements.push({
                element: element,
                text: element.textContent,
                tag: element.tagName,
                visible: element.offsetWidth > 0 && element.offsetHeight > 0
            });
        }
    });
    
    // Print results
    console.log('📋 DASHBOARD ANALYSIS RESULTS:\n');
    
    console.log('📁 Directory/File Inputs:');
    findings.fileInputs.forEach((input, i) => {
        console.log(`${i + 1}. File Input - Directory: ${input.hasDirectory}, Visible: ${input.visible}`);
        if (input.id) {
            console.log(`   ID: ${input.id}`);
        }
        if (input.accept) {
            console.log(`   Accept: ${input.accept}`);
        }
    });
    
    console.log('\n🔘 Relevant Buttons:');
    findings.buttons.forEach((button, i) => {
        console.log(`${i + 1}. "${button.text}" - Visible: ${button.visible}`);
        if (button.id) {
            console.log(`   ID: ${button.id}`);
        }
    });
    
    console.log('\n📝 Path Text Inputs:');
    findings.textInputs.forEach((input, i) => {
        console.log(`${i + 1}. Path Input - Visible: ${input.visible}`);
        if (input.placeholder) {
            console.log(`   Placeholder: "${input.placeholder}"`);
        }
        if (input.id) {
            console.log(`   ID: ${input.id}`);
        }
        if (input.value) {
            console.log(`   Value: "${input.value}"`);
        }
    });
    
    console.log('\n🪟 Modals/Dialogs:');
    findings.modals.forEach((modal, i) => {
        console.log(`${i + 1}. Modal - Visible: ${modal.visible}`);
        if (modal.id) {
            console.log(`   ID: ${modal.id}`);
        }
    });
    
    console.log('\n⚙️ Settings/Panels:');
    findings.settings.forEach((setting, i) => {
        console.log(`${i + 1}. Settings Panel - Visible: ${setting.visible}`);
        if (setting.id) {
            console.log(`   ID: ${setting.id}`);
        }
    });
    
    console.log('\n📄 Directory-related Text Elements:');
    directoryElements.slice(0, 10).forEach((element, i) => {
        console.log(`${i + 1}. "${element.text}" (${element.tag}) - Visible: ${element.visible}`);
    });
    
    // Provide actionable recommendations
    console.log('\n🎯 RECOMMENDATIONS:');
    
    if (findings.fileInputs.length > 0) {
        console.log('✅ Found file inputs! Try clicking them to select directory.');
    }
    
    if (findings.buttons.length > 0) {
        console.log('✅ Found relevant buttons! Try clicking them.');
        console.log('   Example: document.querySelector("button").click()');
    }
    
    if (findings.textInputs.length > 0) {
        console.log('✅ Found path inputs! Try entering a directory path.');
        console.log('   Example: document.querySelector("input").value = "C:\\\\Users\\\\Trevor\\\\CascadeProjects\\\\"');
    }
    
    if (findings.modals.length > 0) {
        console.log('✅ Found modals! Try opening them to see directory options.');
    }
    
    // Create helper functions
    window.dashboardHelpers = {
        clickAllButtons: () => {
            findings.buttons.forEach(button => {
                if (button.visible) {
                    console.log(`Clicking: "${button.text}"`);
                    button.element.click();
                }
            });
        },
        
        clickFileInputs: () => {
            findings.fileInputs.forEach(input => {
                if (input.visible) {
                    console.log('Clicking file input');
                    input.click();
                }
            });
        },
        
        setPathInput: (path) => {
            findings.textInputs.forEach(input => {
                if (input.visible) {
                    console.log(`Setting path: ${path}`);
                    input.element.value = path;
                    input.element.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
        },
        
        findings: findings
    };
    
    console.log('\n🔧 HELPER FUNCTIONS CREATED:');
    console.log('- dashboardHelpers.clickAllButtons() - Click all relevant buttons');
    console.log('- dashboardHelpers.clickFileInputs() - Click file inputs');
    console.log('- dashboardHelpers.setPathInput("path") - Set path input');
    console.log('- dashboardHelpers.findings - View all findings');
    
    return findings;
}

// Auto-run the analysis
console.log('🚀 Dashboard Analyzer loaded. Run analyzeDashboardForDirectoryOptions() to start.');
window.analyzeDashboardForDirectoryOptions = analyzeDashboardForDirectoryOptions;
