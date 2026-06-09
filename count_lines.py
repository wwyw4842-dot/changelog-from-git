from pathlib import Path
total = sum(sum(1 for _ in p.open(encoding="utf-8", errors="replace")) for p in Path(".").glob("*.txt"))
print(total)
