path = r'c:\Users\Trevor\CascadeProjects\simplebeacon-vscode-merged\src\modernSidebarProvider.ts'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(5074, 5085):
    line = lines[i]
    print(f'{i+1}: {repr(line)}')
