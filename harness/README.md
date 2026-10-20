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

## 消融实验

```bash
node harness/ablate.js
```

在内存里分别关掉某一项改动（对 worker 源码做文本还原），逐个跑三个布线用例，用来看
「这项改动到底贡献了多少」。锚点不存在的变体会自动跳过（说明该项已被回滚）。

2026-10-20 的实测结论：网络排序、拆线加码两项贡献恒为 0（关掉后所有指标一模一样），已回滚；
只有 pull-tight 有效，把 medium 的拐弯 29→26、dense 77→75，代价是 dense 布线耗时 108→~200ms。

## 注意

- 主包 `Y4()` 与 worker `pn()` 是**两份同构实现**，改算法必须两处同步，否则放置评估与实际布线会不一致。
- `baseline.p0.json` / `p1` / `p3` 是各阶段的存档，用于回溯；`baseline.json` 是当前基准。
- 打包前请确认 `node --check` 两个 bundle 都通过。
