# ProtoRoute 3D（含嘉立创 / Protel 网表支持）

对官方 v2.0.0 的本地改造版本。当前已应用三处修改：

1. **Protel 网表适配**：导入时嗅探文件头 `PROTEL NETLIST`，在内存中转换成 KiCad S-expression，
   使嘉立创导出的 `Protel2(.net)` 可直接拖入（`__lcAdapt` / `__lcProtel`）。
2. **缺失 libsource 兜底**：网表里没有 `libsource` 时按位号前缀推断元件类别（`__lcClass`）。
3. **界面汉化**：约 69 处英文文案译为中文。

## 目录结构

```
src/                  ← 唯一需要编辑的源码（约 2.6 MB）
  dist/assets/index-C0NrTOjn.js    主程序（压缩后的 bundle，所有逻辑都在这里）
  dist/assets/autoPlacement.worker-*.js   自动放置 worker
  dist/assets/*.css
  electron/main.cjs  electron/preload.cjs
  package.json
build_asar.py         ← 把 src/ 打包回 resources/app.asar
restore_original.bat  ← 还原到官方原版 asar
restore_before_protel.bat ← 回退 Protel 支持（保留汉化）
resources/app.asar    ← 生成物，已被 .gitignore 忽略
```

`node_modules`（91 MB）不在仓库里：它是运行时依赖，打包时由 `build_asar.py` 从现有 asar 原样复制。

## 修改流程

```bash
# 1. 改 src/ 里的文件
# 2. 预览会改哪些文件
python build_asar.py --check
# 3. 关闭 ProtoRoute 3D 后打包
python build_asar.py
# 4. 双击 ProtoRoute 3D.exe 验证
```

打包会先备份旧包到 `resources/app.asar.prev`（被 git 忽略）。

## 回滚

| 目的 | 方法 |
|---|---|
| 撤销某次源码改动 | `git checkout -- src/` 或 `git restore src/` |
| 回到某个提交 | `git log --oneline` 后 `git checkout <hash> -- src/`，再重新打包 |
| 回到官方原版 | 双击 `restore_original.bat` |
| 回到加 Protel 支持之前 | 双击 `restore_before_protel.bat` |

## 注意事项

- **`dist/assets/index-*.js` 是压缩后的单行 bundle**，没有原始 React 源码。修改时建议先格式化
  （如 `npx prettier --parser babel`）再改，改完注意别破坏语法，可用
  `node --check src/dist/assets/index-C0NrTOjn.js` 校验。
- **文件名带内容哈希**（`index-C0NrTOjn.js`）。若将来换版本，签名会变，需要同步改
  `build_asar.py` 之外的所有引用（`dist/index.html`、worker 引用）。
- **asar 完整性校验已关闭**（exe 内 fuse `EnableEmbeddedAsarIntegrityValidation = disabled`），
  所以重新打包的 asar 能被加载。
- 仓库刻意不跟踪 `app.asar`：它 79 MB，每改一次都要多存 79 MB。用 `src/` + 构建脚本替代。
