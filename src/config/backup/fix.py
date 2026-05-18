from pathlib import Path

path = Path(r"F:\share_macos\Blog\Blog-New\Firefly\src\config\siteConfig.ts")

text = path.read_text(encoding="utf-8")

fixed = text.encode("gbk", errors="ignore").decode("utf-8", errors="ignore")

backup = path.with_suffix(path.suffix + ".bak")
output = path.with_suffix(path.suffix + ".fixed")

backup.write_text(text, encoding="utf-8")
output.write_text(fixed, encoding="utf-8")

print("已生成备份：", backup)
print("已生成修复文件：", output)