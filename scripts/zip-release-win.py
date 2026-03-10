from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
source = root / 'release' / 'windows' / 'payload'
dest = root / 'release' / 'windows' / 'dist' / 'AgentXL-Windows-Payload-1.1.0.zip'
dest.parent.mkdir(parents=True, exist_ok=True)
if dest.exists():
    dest.unlink()

with ZipFile(dest, 'w', compression=ZIP_DEFLATED, compresslevel=6) as zf:
    for path in source.rglob('*'):
        if path.is_file():
            zf.write(path, path.relative_to(source))

print(dest)
print(dest.stat().st_size)
