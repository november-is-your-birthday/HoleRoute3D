# harness —— 自动放置/布线离线回归基准

改算法前先跑分，改完再跑一次对比，避免「打包后只能靠人眼验证」。

## 原理

`src/dist/assets/autoPlacement.worker-*.js` 是一个自包含的 IIFE（无 import/export）。
`extract.js` 把 `self.onmessage=` 前面注入一行 `self.__H={pn,wn,hi,...}`，再放进 Node 的 `vm`
上下文里执行，于是可以直接调用 worker 内部的算法函数：

- `hi()` —— 自动放置（与 app 里「自动放置」同一实现）
- `pn()` —— 自动布线（与主包 `Y4()` 同构，是放置候选评估用的同一套算法）
- `qn/mn/In/Yn/lt/dt/Pn` —— 引脚表、逃逸桩、占用、DRC、评分等辅助

注入只发生在内存里，**不会写入 src、不会进 asar**。

## 用法

```bash
node harness/run.js                          # 打印当前指标
node harness/run.js --only=dense-mixed       # 只跑一个 fixture
node harness/run.js --compare                # 与 baseline.json 对比
node harness/run.js --save                   # 覆盖 baseline.json
```

指标：`traces` 走锡段数、`jump` 跳线数、`failed` 未布通网络、`drcE` DRC 错误、
`len` 走锡总长、`bend` 拐弯数、`score`（与 app 内 `iO()` 同权重的加权分）。

## fixture

`fixtures.js` 里是确定性合成的网表（mulberry32 固定种子）：

| 名称 | 内容 | 用途 |
|---|---|---|
| small-555 | DIP-8 + 6 分立件 / 30×16 | 快速冒烟 |
| medium-mcu | DIP-14 + 排针 + 9 分立件 / 32×18 | 常规电路 |
| dense-mixed | 2×DIP-16 + 24 分立件 / 48×26 | 压测跳线与拥塞 |
| place-medium | 11 件全部未放置 | 自动放置 |
| place-10 | 10 件全部未放置 / 48×26 | 自动放置（较慢，约 2 分钟） |

自动放置较慢是当前实现本身的特点（每个候选都要完整布一次线），不是 harness 的开销。

## 跳线数量对比

```bash
node harness/route-quality.cjs
node harness/route-quality.cjs --save=route-quality-results.json
node harness/route-quality.cjs --previous=previous-results.json --save=route-quality-results.json
```

执行保留的原算法候选和当前真实主包布线，比较三个既有布局和六组固定种子网表；
同时断言输入未被修改、跳线数量不增加、独立连通性校验及 DRC 全部通过。
2026-11-20 深度优化后的九组结果为 **51 → 24 条跳线**，其中既有三个布局为 **3/9/22 → 1/4/11**。
相对上一轮优化，九组为 **33 → 24**、三个固定布局为 **1/5/18 → 1/4/11**。
传入 `--previous` 时另外断言跳线数量不高于上一轮；所有用例均检查单次布线低于一分钟。
这是合成用例结果，不能直接代表所有实际工程。

`patches/patch_routing.js` 是两份 bundle 共用的铜线优先优化实现。
最终结果先比较 DRC 与未连通网络，再比较跳线数量，最后比较跳线长度、走锡长度和拐弯。
因此 `metrics.js` 的加权分用于观察质量，不是新方案的第一选择标准。
优化不移动元件，会保留传入的手工线路；多种网络顺序增加最终布线耗时。
整体网络顺序最多搜索 40/16/4 次，随后对阻挡跳线的网络做最多 12 轮局部拆线重布，记录拥塞历史代价。
最终布线从入口设置 54 秒搜索截止时间，覆盖原候选和深度寻路，保留最终校验余量；超大输入保留原算法候选。
超时会保留已有线路和已经验证的最佳结果，未连通状态仍如实报告。算法参考与适配说明见 `docs/routing-algorithms.md`。

worker 的 `pn(..., true)` 使用最终优化；自动放置内部的快速候选评估保留原实现，
避免把多次搜索放大到每一个放置候选。主包/worker 对比使用这个最终模式。
`baseline.json` 保留优化前的历史指标，`--compare` 可以继续观察与它的差异。

## 独立校验器

```bash
node harness/check.js              # 校验全部 fixture
node harness/check.js --only=dense-mixed
```

`check.js` 不调用任何被改动的算法代码，只用「板 + 引脚 + 走锡/跳线」重建一层并查集，
独立判断四件事：同一网络的引脚是否真的连通、不同网络是否被铜连成一片、走锡有没有斜线段、有没有跑到板外。
任何一项非 0 即 exit code 1，可当回归门禁。

2026-10-20 实测：5 个 fixture 全部 0 未连通 / 0 短路 / 0 斜线 / 0 出板。

## 飞线层回归

```bash
node harness/rats-check.js
```

从 bundle 里抽出 `__lcRats*` 源码，用 three 的 mock（Group / Vector3 / BufferGeometry / LineSegments / LineBasicMaterial）
在 `vm` 中执行 `__lcRatsRebuild()`，校验：

- 飞线按**铜的实际连通性**判定：走锡（`traces`）相邻点、跳线（`jumpers`）两端并入同一并查集连通块，
  同一块内的引脚只算一个节点 → 已被连起来的引脚不再画飞线；
- 每个网络生成的线段数 = 该网络（连通块去重后）节点数 − 1；
- 未放置（`mounted` 为假）的元件不参与飞线；
- 走锡的 `net` 名与网表不一致（手动走锡未选网络）时，仍按物理连通判定；
- 线段落在 `y = -0.62`（板背面外侧），x/z 与焊盘坐标一致。

任何一项不符即 exit code 1。

## 补丁静态检查

```bash
node harness/lint-lc.js            # 检查两个 bundle 里的 __lc* 函数
node harness/lint-lc.js --strict   # WARN 也算失败（CI 用这个）
node harness/lint-lc.js path/to/bundle.js
```

minified bundle 里的两字母函数名在不同文件里含义完全不同。真实踩过的坑：`$e` 在 worker 中是
「枚举路径边」，在主包里却是 React 的错误捕获函数；`ri` 在 worker 中是「拐弯计数」，在主包里是
「快捷键描述对象」；`ni` 在主包里根本不存在。把 worker 的实现照搬到主包时，`node --check` 完全
不会报错，运行时才抛异常，表现是**点了按钮没反应**（异常打断 React 的状态更新）。

本脚本会：

1. 收集目标文件里所有 `function` / `class` / `const` / `let` / `var` 声明（含解构）；
2. 抽出每个 `function __lc…` 的函数体，屏蔽字符串与注释后扫描其中的函数调用；
3. 名字找不到 → `ERROR`；名字存在但实参少于必填形参、或只以 `var` 声明在别处 → `WARN`。

## 消融实验

```bash
node harness/ablate.js
```

在内存里分别关掉某一项改动（对 worker 源码做文本还原），逐个跑三个布线用例，用来看
「这项改动到底贡献了多少」。锚点不存在的变体会自动跳过（说明该项已被回滚）。

2026-10-20 的实测结论：网络排序、拆线加码两项贡献恒为 0（关掉后所有指标一模一样），已回滚；
只有 pull-tight 有效，把 medium 的拐弯 29→26、dense 77→75，代价是 dense 布线耗时 108→~200ms。

## 注意

- `node patches/tests/review_workflows.js` 验证旧线路分块续接、稀疏脚数、加载/编辑/撤销与 LED 来源兼容规则；`node harness/review_verify.cjs` 验证上一轮修复场景。两者均执行真实主包业务函数，DOM 与状态提交环境由 `app-sandbox.cjs` 隔离提供，不代替桌面交互检查。
- 主包对用户已有线路按物理连通块规划，worker 的放置评估没有旧线路入参；三个首次布线 fixture 另外验证主包与 worker 最终模式的指标一致。
- 主包 `Y4()` 与 worker `pn()` 是**两份同构实现**，改算法必须两处同步，否则放置评估与实际布线会不一致。
- `baseline.p0.json` / `p1` / `p3` 和 `baseline.json` 是历史阶段存档，用于回溯。
- 打包前请确认 `node --check` 两个 bundle 都通过。
