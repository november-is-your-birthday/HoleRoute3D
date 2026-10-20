<p align="center">
  <img src="src/assets/image1.png" width="120" alt="ProtoRoute 3D">
</p>

<h1 align="center">ProtoRoute 3D 中文增强版</h1>

<p align="center">
  <b>面向洞洞板（万能板）的 3D 元件摆放 · 自动布线 · 焊接前检查工具</b><br>
  <sub>非官方修改版（fork），基于 <a href="https://github.com/Tomjiang678/Perfboard-AutoRoute-3D-Windows">Tomjiang678/Perfboard-AutoRoute-3D-Windows</a> v2.0.0</sub>
</p>

<p align="center">
  <img alt="platform" src="https://img.shields.io/badge/platform-Windows-0078D4">
  <img alt="base" src="https://img.shields.io/badge/upstream-v2.0.0-6b7280">
  <img alt="license" src="https://img.shields.io/badge/license-MIT%20(own%20parts)-2ea043">
  <img alt="status" src="https://img.shields.io/badge/status-personal%20project-f59e0b">
</p>

---

> ## ⚠️ 先读这一段：这是一个 fork
>
> 本仓库**不是**原创软件，而是对 **Tomjiang678** 的 *PerfBoard AutoRoute 3D / ProtoRoute 3D* **v2.0.0**
> 的二次开发版本。核心的 3D 渲染、元件模型、自动放置 / 自动布线算法、DRC 引擎全部来自原作者。
>
> 我做的是**外围改造**：界面汉化、嘉立创网表兼容、交互手感、配色与飞线显示、算法性能与少量后处理优化，
> 外加一套离线回归工具（`harness/`）与打包脚本（`build_asar.py`）。
>
> **版权与许可**：上游仓库目前**没有 LICENSE 文件**（即默认「保留所有权利」）。因此
> 本仓库不能整体以 MIT 再授权；`LICENSE` 仅覆盖我自己写的那部分代码与文档。
> 详见 [NOTICE.md](NOTICE.md)。如果你是原作者并希望本项目调整署名方式，请开 issue，我会立即配合。

---

## 这个项目解决什么问题

洞洞板焊接的难点不在电路本身，而在**三维空间里的布局**：元件怎么摆、锡怎么走、哪里必须飞线、
哪两个孔不能共用。这个软件把 KiCad / 嘉立创导出的网表转成 3D 板面，在真正动手焊之前先「预演」一遍：

- 元件按封装映射到洞洞板格点，可拖动、旋转、正反面安装；
- 自动放置 + 自动布线（反面走锡 + 反面拱形跳线），也可手工逐段走锡；
- DRC 检查孔位冲突、短路、应连未连；
- 导出工程 JSON，随时继续。

它更适合**小板子**（模块、转接板、教学实验、几十个元件以内）的布局预演与焊接参考，
不适合当作 Altium / KiCad 那样的量产 PCB 工具使用。

---

## 相比上游 v2.0.0 改了什么

### 网表兼容

| 改动 | 说明 |
|---|---|
| **嘉立创 / 立创EDA 网表直接导入** | 导入时嗅探文件头 `PROTEL NETLIST`，在内存中转换为 KiCad S-expression，`Protel2 (.net)` 可直接拖进来，不用再手工转换 |
| **缺失 `libsource` 兜底** | 网表里没有库字段时，按位号前缀（R/C/D/Q/U/J…）推断元件类别，避免整批元件退化成排针 |

### 界面与布局

| 改动 | 说明 |
|---|---|
| **完整中文化** | 工具栏、菜单、对话框、导入结果、DRC 输出、状态提示共 100+ 处；DRC 错误码也做了中文映射（如 `WRONG_NET_SHORT` → 错网短路） |
| **顶部工具栏常驻展开** | 原来是下拉菜单，现在「生成元件 / 自动放置 / 自动布线」「选择 / 走锡 / 跳线 / 删线 / 清除布线」「DRC 检查」全部常显，每组一个方框；窗口变窄时出现 `‹ ›` 箭头滚动 |
| **右侧图标区重排** | 刷新、透视、深色、撤销、导出、设置集中在右上角 |
| **侧栏重新分区** | 顺序为 工程 → 导入 → DRC 检查 → AI 约束 → 导入结果 → 配色；元件 / 网络 / 引脚网络默认收起 |
| **一键清空 / 清除布线** | 两个独立入口，都带确认弹窗；清除布线只清走锡、跳线、DRC，保留元件与摆放 |
| **元件库卡片化** | 每个元件显示真实 3D 模型缩略图（离屏 WebGL 渲染），右上角 `⤢` 可看 480px 大图 |

### 3D 视图与配色

| 改动 | 说明 |
|---|---|
| **焊盘双面常亮环** | 顶面绿、底面蓝，尺寸与焊盘一致，翻转视角只显示对应面 |
| **颜色可自定义** | 板子 / 顶层圈 / 底层圈 / 高亮圈四色选择器（侧栏「配色」），即时生效并记住 |
| **飞线层（ratsnest）** | 视角转到板子背面时，用灰色直线按网络画出「还差哪些连接」 |
| **飞线按物理连通判定** | 走锡或跳线一旦把两个脚实际连上，段飞线立刻消失，不依赖是否跑过 DRC |
| **DRC 染色分级** | 未使用（悬空）引脚 → 灰；错网短路 / 应连未连 → 红；正常 → 焊盘色 |
| **未放置元件黄环** | 悬空元件在焊盘位置显示黄色环，提示「会落到哪里」 |

### 交互

| 改动 | 说明 |
|---|---|
| **走锡 / 跳线实时反馈** | 起点黄环 → 悬停共线黄、不共线红 → 左键生成 → 右键取消；走锡强制正交，跳线不受限 |
| **右键菜单旋转分正反** | 「旋转 +90° / 旋转 −90°」，可连续累计 |
| **元件库预摆放** | 点击元件先出半透明模型 + 每脚黄环预览落点，右键取消 |
| **Shift 拖动不弹属性面板** | 按住 Shift 拖动只移动位置，右侧属性面板只在单击时出现 |

### 算法

| 改动 | 效果（离线基准实测） |
|---|---|
| **自动放置提速** | 去掉洞洞板场景下无意义的电气节点字符串构造、引脚孔位缓存、庭院构造去掉去重 → **约 2.3× 提速** |
| **放置评估预算提升** | 每件候选 2 → 3，总评估 24 → 36，优化 3 轮 → 跳线 −2~4 根；`place-10` 用例总长 274 → 220（−20%） |
| **布线 pull-tight 后优化** | 布完后逐段拆开重布，路径更短才保留 → 拐弯 −2~3 |

> 实测无效的优化（地/电源网络先行、拆线预算加码）已回滚，见 `harness/ablate.js` 与 [CHANGELOG](CHANGELOG.md)。

---

## 快速开始（Windows）

仓库**不包含** Electron 运行时（exe / dll / pak）、`node_modules` 和打包产物 `app.asar`——
这些体积大且属于上游发行物。正确用法是「拿官方包打补丁」：

### 1. 下载官方 v2.0.0

前往 [上游 Release](https://github.com/Tomjiang678/Perfboard-AutoRoute-3D-Windows/releases/tag/v2.0.0)，
下载 `perfboard_autorouting_3d_v2.0.0.zip`，**完整解压**到任意目录（例如 `D:\ProtoRoute3D`）。

> 必须完整解压，不能只复制单个 exe——程序依赖同目录的 dll、pak、locales、resources。

### 2. 覆盖源码

把本仓库的这些内容复制到刚才的解压目录（覆盖同名文件）：

```
src/            ← 修改后的应用源码（约 2.7 MB）
build_asar.py   ← 打包脚本
tools/          ← 还原官方原版的脚本
harness/        ← 可选：离线回归工具
```

### 3. 打包

```bash
# 需要 Python 3.8+，无需第三方库
python build_asar.py --check   # 先看看会改哪些文件
python build_asar.py           # 正式打包，旧包自动备份为 app.asar.prev
```

### 4. 运行

双击 `ProtoRoute 3D.exe` 即可。

> **改完必须完全退出软件再启动**——Electron 只在启动时读一次 `app.asar`，
> 窗口不关掉重开是看不到改动的。

### 还原官方原版

先备份过一次原包（`resources/app.asar.orig`）的话，运行 `tools/restore_official.bat`；
没有备份就直接从官方 zip 里取回 `resources/app.asar`。

---

## 使用流程

1. **导入网表**：KiCad 导出的 `.net`，或嘉立创 / 立创EDA 导出的 `Protel2` 网表（直接拖入）；
2. **检查导入结果**：侧栏「导入结果」里展开元件 / 网络 / 引脚网络，确认元件没被识别成错误封装；
3. **摆放**：自动放置（`P`）先出一版，再手动拖动微调；未放置元件显示黄环提示落点；
4. **布线**：自动布线（`A`）跑一版，剩下没通的用走锡（`S`）手工补，交叉处用跳线（`J`）；
5. **检查**：DRC（`D`），红色必须处理，灰色是可以忽略的悬空脚；
6. **转到底面**看飞线层，确认没有漏连；
7. **保存工程**（JSON）后对着 3D 视图施工。

### 默认快捷键

| 功能 | 键 | 功能 | 键 |
|---|---|---|---|
| 刷新 | `F5` | 选择 | `V` |
| 透视板 | `T` | 旋转元件 | `R` |
| 放置 / 移除 | `M` / `U` | 删除 | `Delete` |
| 生成元件 | `G` | 自动放置 | `P` |
| 自动布线 | `A` | DRC 检查 | `D` |
| 清除 DRC | `C` | 走锡 | `S` |
| 跳线 | `J` | 删线 | `E` |
| 拖动元件 | 按住 `Shift` | | |

快捷键可在「设置」里改（重名冲突会给出提示）。

---

## 目录结构

```
src/                                    唯一需要编辑的源码（约 2.7 MB）
  dist/assets/index-C0NrTOjn.js         主程序：压缩成单行的 React bundle，所有界面与 3D 逻辑
  dist/assets/autoPlacement.worker-*.js 自动放置 worker（含布线算法副本）
  dist/assets/index-*.css               样式
  dist/index.html
  electron/main.cjs, preload.cjs        Electron 主进程
  package.json
build_asar.py                           把 src/ 打包回 resources/app.asar
tools/restore_official.bat              还原官方原版 asar
harness/                                离线回归工具（Node，无需启动 GUI）
  extract.js                            从 worker 里导出内部函数
  fixtures.js                           确定性合成网表用例
  run.js                                跑分（--save / --compare / --only=）
  ablate.js                             消融实验（逐项开关某项优化）
  check.js                              独立连通性校验（并查集，不复用被测算法）
  rats-check.js                         飞线层逻辑回归
  baseline*.json                        各阶段跑分存档
.github/workflows/verify.yml            CI：语法检查 + 快速回归
```

## 开发与打包

`app.asar` 里只有约 2.6 MB 是源码，其余 80 MB 是 `node_modules` 运行时依赖。
所以 `build_asar.py` 采用「**以现有 asar 为模板重新打包**」的方式：

- `src/` 里有的文件 → 用 `src/` 的内容；
- `src/` 里没有的（`node_modules` 等）→ 原样从模板复制。

这样仓库只需存几 MB，产出的 asar 与完整打包等价。

```bash
# 语法校验（改完 bundle 必做）
node --check src/dist/assets/index-C0NrTOjn.js
node --check src/dist/assets/autoPlacement.worker-CtyuXT3o.js

# 打包
python build_asar.py --check
python build_asar.py
```

注意事项：

- `dist/assets/index-*.js` 是**压缩后的单行 bundle**，没有原始 React 源码。改之前建议格式化
  （`npx prettier --parser babel`），改完一定跑 `node --check`；
- 文件名带内容哈希（`index-C0NrTOjn.js`）。换上游版本时哈希会变，需同步改 `dist/index.html` 与 worker 引用；
- exe 内的 Electron fuse `EnableEmbeddedAsarIntegrityValidation` 已关闭，所以重新打包的 asar 能被加载；
- 打包前先关软件，否则 `app.asar` 被占用会写入失败（脚本会提示并保留 `.prev` 备份）。

## 离线回归工具（harness）

改算法最怕「感觉变好了」。`harness/` 直接在 Node 里跑软件**自己的**算法，不启动 GUI、不需要 Electron：

```bash
node harness/run.js                      # 打印 5 个用例的指标
node harness/run.js --compare            # 与 baseline.json 对比
node harness/run.js --save               # 覆盖基线
node harness/run.js --only=dense-mixed   # 单跑一个用例

node harness/check.js                    # 独立连通性校验（应全部 0 / 0 / 0 / 0）
node harness/rats-check.js               # 飞线层逻辑回归
node harness/ablate.js                   # 消融：某项优化到底有没有用
```

原理：worker 是自包含 IIFE，`extract.js` 在内存里于 `self.onmessage=` 之前注入一行导出，
再用 Node 的 `vm` + `self` 垫片加载，于是可以直接调用 `hi()`（放置）、`pn()`（布线）、
`lt()`（DRC）等内部函数。注入只发生在内存，不改 `src/`、不进 asar。

`check.js` 特意**不复用被测代码**：只用「板 + 引脚 + 走锡/跳线」重建并查集，
独立判断连通、短路、斜线、出板——软件自己检查自己会有共同盲点，这层是第二套标准。

详细说明见 [harness/README.md](harness/README.md)。

## 已知限制

- **只支持双层洞洞板**（单面走锡 + 反面跳线），没有过孔 / 多层概念；
- 只支持 **KiCad S-expression** 与 **Protel2** 两种网表格式，不支持 Protel 99SE / Altium 原生格式；
- 元件库尺寸有限，网表里的封装识别不到时会退化为**排针占位**，需要在属性面板手工确认；
- 元件**没有镜像**功能，只能 90° 旋转（正反面安装在属性面板里切换）；
- 自动布线对复杂电路仍可能布不通，需要手工补线；跳线数量是主要成本项；
- 界面文案全中文，暂未做多语言。

## 贡献

欢迎 issue / PR。提交前请确保：

1. `node --check` 两个 bundle 都通过；
2. `node harness/check.js` 与 `node harness/rats-check.js` 全绿；
3. 若改了算法，附上 `node harness/run.js --compare` 的前后对比。

## 致谢

- **Tomjiang678** —— 上游 *PerfBoard AutoRoute 3D / ProtoRoute 3D* 的作者，本项目的全部核心能力来自他；
- Electron、React、three.js、lucide-react 等开源项目；
- 算法优化参考了 [Freerouting](https://github.com/freerouting/freerouting)（pull-tight 优化）、
  [perfboard-studio](https://github.com/medinstech/perfboard-studio)（连接定价思路，未采用）、
  [tscircuit/autorouting](https://github.com/tscircuit/autorouting)（基准数据集方法论）。

## 许可

- 本仓库作者原创的部分（`build_asar.py`、`tools/`、`harness/`、文档）：**MIT**，见 [LICENSE](LICENSE)；
- `src/` 下的应用代码著作权归上游作者，上游**未声明许可**，因此不随本仓库的 MIT 条款再授权；
- 商用、二次分发前请先联系上游作者取得授权。详见 [NOTICE.md](NOTICE.md)。
