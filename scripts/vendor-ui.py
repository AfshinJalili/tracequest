"""Vendor selected official shadcn registry components when the CLI proxy is unavailable."""
import concurrent.futures
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
COMPONENTS = ['button', 'dialog', 'sheet', 'tabs', 'collapsible', 'dropdown-menu', 'tooltip', 'progress', 'input', 'textarea', 'badge', 'sonner']

def component(name):
    url = f'https://ui.shadcn.com/r/styles/new-york-v4/{name}.json'
    result = subprocess.run(['curl', '-fsSL', '--max-time', '30', url], capture_output=True, text=True, check=True)
    data = json.loads(result.stdout)
    for source in data['files']:
        target = ROOT / 'src/components/ui' / pathlib.Path(source['path']).name
        content = source['content'].replace('from "cn"', 'from "@/lib/utils"').replace('@/registry/new-york-v4/ui/', '@/components/ui/')
        if name == 'sonner':
            content = content.replace('import { useTheme } from "next-themes"\n', '')
            content = content.replace('  const { theme = "system" } = useTheme()\n', '')
            content = content.replace('theme={theme as ToasterProps["theme"]}', 'theme="dark"')
        target.write_text(content)
    return name

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    for name in pool.map(component, COMPONENTS):
        print(f'Vendored {name}', flush=True)
