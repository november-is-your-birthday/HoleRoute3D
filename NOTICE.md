# 版权与来源说明

本仓库是二次开发版本（fork），不是原创项目。这份文件说明「哪部分是别人的、哪部分是我的、
以及为什么许可状态是这样」。

---

## 1. 上游项目

| 项目 | 内容 |
|---|---|
| 名称 | PerfBoard AutoRoute 3D / ProtoRoute 3D |
| 作者 | **Tomjiang678**（`src/package.json` 中 author 字段为 `zhuohanjiang`） |
| 仓库 | <https://github.com/Tomjiang678/Perfboard-AutoRoute-3D-Windows> |
| 本仓库基线 | `v2.0.0`（Release 资产 `perfboard_autorouting_3d_v2.0.0.zip`） |
| 许可状态 | **截至 2026-10-20，上游仓库没有 LICENSE 文件**，GitHub 亦未识别到许可证 |

上游没有声明许可证时，按著作权法默认「保留所有权利」（All rights reserved）。
这意味着：**任何人都没有获得再分发、修改后分发、商用的明示授权**，即使代码公开可见。

## 2. 本仓库的性质

- **非官方**：由第三方（Kai）维护，与原作者无关，不代表原作者立场，也不是官方发行版。
- **不含上游发行物**：仓库中**没有** Electron 运行时（`ProtoRoute 3D.exe`、`*.dll`、`*.pak`、
  `locales/`、`icudtl.dat` 等）、`node_modules`，也没有打包产物 `resources/app.asar`。
  这些东西需要从上游 Release 获取，见 README「快速开始」。
- **包含被修改的源码**：`src/` 下是上游 `app.asar` 中被修改过的源文件（压缩后的 React bundle、
  自动放置 worker、样式、Electron 主进程、package.json）。它们的著作权属于上游作者，
  本仓库对它们的改动属于兼容性 / 交互 / 性能层面的补丁。
- **包含我的原创工具**：`build_asar.py`、`tools/`、`harness/`、CI 配置与中文文档。

## 3. 许可划分

| 部分 | 著作权 | 许可 |
|---|---|---|
| `build_asar.py`、`tools/`、`harness/`、`.github/`、文档 | Kai | MIT（见 [LICENSE](LICENSE)） |
| `src/` 下的应用代码及其修改 | Tomjiang678 | 未声明许可 → 不随本仓库 MIT 再授权 |
| Electron / Chromium 运行时（不在本仓库） | Electron 与 Chromium 贡献者 | MIT / BSD 等，见官方发行包内 `LICENSE.electron.txt`、`LICENSES.chromium.html` |
| 第三方库（React、three.js、lucide-react 等，打包在 bundle 内） | 各自作者 | MIT 等，见各项目主页 |

因此：**不要把这个仓库整体标注为 MIT 项目**。GitHub 上的 license 徽章只代表我自己写的那部分。

## 4. 如果你要使用 / 分发

- **个人学习、自己改着玩**：没问题，直接 clone + 打补丁即可。
- **公开发布你自己的修改版**：请先联系上游作者取得授权，并在页面显眼位置注明原作者与上游链接，
  保持与本仓库相同（或更严格）的署名方式。
- **商用**：请先取得上游作者书面授权。

## 5. 如果我是原作者

如果你是 Tomjiang678 本人，并认为本仓库的公开方式不妥（署名方式、分发范围、修改内容等），
请开一个 issue 或通过 GitHub 联系，我会在确认后立即调整、补充署名，或直接下线本仓库，
不需要任何法律程序。

## 6. 免责声明

本软件用于洞洞板电路的布局预演与焊接参考。自动布线 / 自动放置 / DRC 的结果**不保证电气正确**，
实际焊接前请自行核对原理图与实物。因使用本软件导致的元件损坏、板子报废或其它损失，作者不承担责任。
