import sys
path = r'c:\Users\Trevor\CascadeProjects\simplebeacon-vscode-merged\src\modernSidebarProvider.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = "      if (sidebarSignOut) sidebarSignOut.style.display = signedIn ? '' : 'none';\n      return;"
new = "      if (sidebarSignOut) sidebarSignOut.style.display = signedIn ? '' : 'none';\n      const headerSignIn = document.getElementById('headerSignInBtn');\n      const headerSignOut = document.getElementById('headerSignOutBtn');\n      if (headerSignIn) headerSignIn.style.display = signedIn ? 'none' : 'inline-flex';\n      if (headerSignOut) headerSignOut.style.display = signedIn ? 'inline-flex' : 'none';\n      return;"

if old in content:
    content = content.replace(old, new, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('OK: replaced')
else:
    print('NOT FOUND')
    idx = content.find('sidebarSignOut.style.display')
    if idx != -1:
        print(repr(content[idx-30:idx+150]))
