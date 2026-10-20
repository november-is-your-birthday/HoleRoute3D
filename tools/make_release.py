# -*- coding: utf-8 -*-
"""打一个「下载解压即用」的 Windows 便携包。

用法
----
    python tools/make_release.py            # 生成 release/ProtoRoute3D-v<版本>-cn-win-x64.zip
    python tools/make_release.py --check    # 只统计会打包哪些内容，不写文件

打包内容 = 运行本体（exe / dll / pak / locales / resources/app.asar 等）
         + docs/使用说明.txt（拷进包内根目录）
不含：src/、harness/、tools/、docs/ 其余文件、.git、以及 resources 下的 asar 备份。
"""

import json
import os
import sys
import time
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "release")
GUIDE = os.path.join(ROOT, "docs", "使用说明.txt")

# 根目录下按后缀白名单收集的文件
ROOT_EXTS = (".exe", ".dll", ".pak", ".bin", ".dat", ".json")
# 根目录显式包含的文件
ROOT_FILES = ("vk_swiftshader_icd.json", "LICENSE.electron.txt", "LICENSES.chromium.html")
# 整目录包含
DIRS = ("locales",)
# resources 下只包含这些（排除 app.asar.orig / .prev / .before_protel 等备份）
RES_INCLUDE = ("app.asar", "app.asar.unpacked")


def version():
    with open(os.path.join(ROOT, "src", "package.json"), encoding="utf-8") as fh:
        return json.load(fh)["version"]


def collect():
    items = []  # (绝对路径, 包内相对路径)

    for name in sorted(os.listdir(ROOT)):
        path = os.path.join(ROOT, name)
        if not os.path.isfile(path):
            continue
        if name in ROOT_FILES or name.lower().endswith(ROOT_EXTS):
            # 排除构建脚本等误命中 .json 的文件
            if name in ("package.json", "package-lock.json"):
                continue
            items.append((path, name))

    for name in DIRS:
        base = os.path.join(ROOT, name)
        for dp, _dn, fs in os.walk(base):
            for f in fs:
                p = os.path.join(dp, f)
                items.append((p, os.path.relpath(p, ROOT).replace(os.sep, "/")))

    res = os.path.join(ROOT, "resources")
    for name in RES_INCLUDE:
        p = os.path.join(res, name)
        if os.path.isfile(p):
            items.append((p, "resources/" + name))
        elif os.path.isdir(p):
            for dp, _dn, fs in os.walk(p):
                for f in fs:
                    fp = os.path.join(dp, f)
                    items.append((fp, os.path.relpath(fp, ROOT).replace(os.sep, "/")))

    if os.path.isfile(GUIDE):
        items.append((GUIDE, "使用说明.txt"))

    return items


def main():
    ver = version()
    folder = "ProtoRoute3D-v%s-cn" % ver
    items = collect()
    total = sum(os.path.getsize(p) for p, _ in items)

    print("版本：v%s" % ver)
    print("待打包文件：%d 个，原始大小 %.1f MB" % (len(items), total / 1024 / 1024))
    for _, rel in items:
        if "/" not in rel:
            print("   " + rel)

    if "--check" in sys.argv:
        print("\n仅统计，未写入。")
        return

    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, "%s-win-x64.zip" % folder)
    t0 = time.time()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as zf:
        for path, rel in items:
            zf.write(path, arcname=folder + "/" + rel)
    dt = time.time() - t0
    size = os.path.getsize(out)
    print("\n完成：%s" % out)
    print("压缩包 %.1f MB（原始 %.1f MB，压缩率 %.0f%%），耗时 %.1f s"
          % (size / 1024 / 1024, total / 1024 / 1024, 100.0 * size / total, dt))
    print("解压后目录：%s\\（双击 使用说明.txt 查看上手步骤）" % folder)


if __name__ == "__main__":
    main()
