import os

path = 'backend/schemas/deals.py'
if os.path.exists(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix the mangled docstrings and spacing
    content = content.replace('" \\\\Container for assets being moved in an exchange.\\\\\\n ', '"""Container for assets being moved in an exchange."""\n    ')
    content = content.replace('\\\\\\\\Organiser-driven multi-asset swap between two teams.\\\\\\n ', '"""Organiser-driven multi-asset swap between two teams."""\n    ')
    
    # Also fix general indentation if it was messed up by the append
    # (PowerShell Add-Content might have stripped some spacing or added some)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Repaired backend/schemas/deals.py")
else:
    print("File not found")
