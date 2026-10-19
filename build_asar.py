# -*- coding: utf-8 -*-
"""把 src/ 的内容打包回 resources/app.asar。

设计
----
app.asar 里只有 4 个目录是「源码」（dist / assets / electron / package.json，约 2.6 MB），
其余 91 MB 是 node_modules 运行时依赖，不需要纳入版本控制。
所以本脚本以「当前 app.asar 为模板」重新打包：
  - src/ 里存在的文件 → 用 src 的内容；
  - src/ 里没有的文件（node_modules 等）→ 原样从模板复制。
这样仓库只需保存几 MB，而产出的 asar 与完整打包等价。

用法
----
    python build_asar.py --check     只列出会有哪些文件变化，不写盘
    python build_asar.py             打包并覆盖 resources/app.asar
                                     覆盖前会把旧包存为 app.asar.prev

注意
----
打包前请先关闭 ProtoRoute 3D，否则文件被占用会写入失败。
"""

import json
import os
import shutil
import struct
import sys
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
ASAR = os.path.join(ROOT, "resources", "app.asar")


def align4(n):
    return (n + 3) // 4 * 4


def read_asar(path):
    with open(path, "rb") as fh:
        magic, _hsize, _c, dlen = struct.unpack("<IIII", fh.read(16))
        if magic != 4:
            raise ValueError("不是合法的 asar 文件：%s" % path)
        header = json.loads(fh.read(dlen).decode("utf-8"))
        base = 16 + align4(dlen + 1)
        # 数据区从 base 开始，而不是紧随 header JSON（两者之间可能有 1~3 字节填充）
        fh.seek(base)
        data = fh.read()
    return header, base, data


def walk(node, prefix=""):
    for k, v in node.get("files", {}).items():
        cur = prefix + "/" + k if prefix else k
        if "files" in v:
            yield from walk(v, cur)
        else:
            yield cur, v


def build(check_only=False):
    if not os.path.isdir(SRC):
        sys.exit("找不到 src 目录：%s" % SRC)
    if not os.path.isfile(ASAR):
        sys.exit("找不到 app.asar：%s" % ASAR)

    header, base, data = read_asar(ASAR)
    payload = bytearray()
    new_meta = {}
    changed = []
    added = []

    for rel, meta in walk(header):
        entry = dict(meta)
        if "offset" not in meta or meta.get("unpacked"):
            new_meta[rel] = entry
            continue

        old = data[int(meta["offset"]):int(meta["offset"]) + int(meta["size"])]
        path = os.path.join(SRC, rel.replace("/", os.sep))
        if os.path.isfile(path):
            blob = open(path, "rb").read()
            if blob != old:
                (changed if old else added).append(rel)
        else:
            blob = old

        entry["size"] = len(blob)
        entry["offset"] = str(len(payload))
        entry.pop("integrity", None)
        payload.extend(blob)
        new_meta[rel] = entry

    # src 里存在、但模板里没有的文件（新增文件）
    known = set(new_meta)
    for dp, _dn, fs in os.walk(SRC):
        for f in fs:
            p = os.path.join(dp, f)
            rel = os.path.relpath(p, SRC).replace(os.sep, "/")
            if rel not in known:
                added.append(rel)

    print("模板文件数：%d" % len(known))
    print("内容有变化：%d" % len(changed))
    for r in changed:
        print("   M  " + r)
    if added:
        print("新增文件（不会自动加入，需要改模板）：%d" % len(added))
        for r in added:
            print("   +  " + r)

    if check_only:
        print("\n仅检查，未写入。")
        return

    if not changed and not added:
        print("\n没有变化，不需要打包。")
        return

    root = json.loads(json.dumps(header))

    def apply(node, prefix=""):
        for k, v in list(node.get("files", {}).items()):
            cur = prefix + "/" + k if prefix else k
            if "files" in v:
                apply(v, cur)
            elif cur in new_meta:
                node["files"][k] = new_meta[cur]

    apply(root)

    blob = json.dumps(root, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    padded = blob + b"\0" * (align4(len(blob) + 1) - len(blob))
    head = struct.pack("<IIII", 4, 8 + len(padded), 4 + len(padded), len(blob))

    backup = ASAR + ".prev"
    try:
        shutil.copyfile(ASAR, backup)
    except OSError as exc:
        sys.exit("备份失败（应用是否仍在运行？请先关闭它）：%s" % exc)

    tmp = ASAR + ".tmp"
    with open(tmp, "wb") as fh:
        fh.write(head)
        fh.write(padded)
        fh.write(payload)
        fh.flush()
        os.fsync(fh.fileno())

    # Windows 上刚写完的大文件可能被杀软/索引服务短暂占用：
    # 先尝试原子替换，失败则退化为直接覆写（旧包已在 .prev 备份）
    installed = None
    last = None
    for attempt in range(4):
        try:
            os.replace(tmp, ASAR)
            installed = "replace"
            break
        except OSError:
            time.sleep(0.4 + attempt * 0.3)
    if installed is None:
        for attempt in range(4):
            try:
                shutil.copyfile(tmp, ASAR)
                installed = "copy"
                break
            except OSError as exc:
                last = exc
                time.sleep(0.5 + attempt * 0.5)
        if installed is None:
            try:
                os.remove(tmp)
            except OSError:
                pass
            sys.exit("写入失败（请先关闭 ProtoRoute 3D，或检查杀毒软件是否锁定了 app.asar）：%s" % last)
        try:
            os.remove(tmp)
        except OSError:
            pass

    print("\n打包完成：%.1f MB（原 %.1f MB）" % (
        os.path.getsize(ASAR) / 1024 / 1024, os.path.getsize(backup) / 1024 / 1024))
    print("旧包备份：%s" % backup)
    print("现在可以启动 ProtoRoute 3D.exe 验证。")


if __name__ == "__main__":
    build(check_only="--check" in sys.argv)
