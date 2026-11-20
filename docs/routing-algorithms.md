# 减少跳线：局部拆线重布与拥塞历史

目标是在不移动元件、不增加短路或未连通网络的前提下，减少洞洞板实际需要焊接的跳线。排序比较仍以电气完整性优先，其次是跳线数，再比较跳线长度、走锡长度和拐弯。

## GitHub 参考

阅读日期：2026-11-20。参考算法思想，代码由本项目独立实现，没有引入这些项目的源代码、依赖或运行时。

- [freerouting / BatchOptimizer.java](https://github.com/freerouting/freerouting/blob/f2a10b0274ca9f1047ab38ec996fd841ec9170db/src/main/java/app/freerouting/autoroute/pipeline/BatchOptimizer.java)：尝试拆除相关连接后重新布线，保护固定线路，检查候选的违规和未连通数量，保留并恢复较好的板状态。
- [freerouting / BatchAutorouter.java](https://github.com/freerouting/freerouting/blob/f2a10b0274ca9f1047ab38ec996fd841ec9170db/src/main/java/app/freerouting/autoroute/pipeline/BatchAutorouter.java)：多轮拆线重布、停滞检测和计算时限。
- [VTR / route_common.cpp](https://github.com/verilog-to-routing/vtr-verilog-to-routing/blob/a1658e32739e4a371aad51a04513ad517007bafd/vpr/src/route/route_common.cpp)：PathFinder 对反复过度占用的资源累计拥塞代价，减少后续轮次对相同通道的争抢。

freerouting 面向 PCB，VTR 面向 FPGA；本实现针对单层洞洞板网格和跳线，采用局部拆线重布及历史代价，不是直接移植它们的完整路由器。

## 本项目实现

核心代码为 `patches/patch_routing.js`，由 `patches/apply_all.py` 同步生成主包和 worker。

1. 保留上一轮铜线共享与网络顺序搜索，得到经过 DRC 的候选。
2. 逐条检查自动跳线。试探一条允许穿过可移动自动铜线的底层路径，识别真正阻挡它的网络；固定线路、无网络焊盘、其它网络的元件引脚和禁布区仍是硬障碍。
3. 优先只替换这条跳线，并局部重布阻挡网络；再尝试相关网络的不同布线顺序。其余线路保留，输入数据不被原地改写。
4. 对反复争抢的格点增加历史代价，让下一轮尝试其它通道。中间试探路径不会直接交给用户，候选必须经过完整的电气与约束检查。
5. 搜索工作状态与最佳状态分别保存。同样跳线数时可以进行有限的几何探索；最后始终返回经过验证的最佳状态，失败或超时的部分候选不会覆盖它。

寻路预计算格点通行状态，使用带方向的堆搜索，避免在每次扩展时反复构造字符串和查询占用表。

## 时间预算

最终布线从入口开始设置 **54 秒搜索截止时间**，为最终检查和结果提交留出余量。原路由候选、缩短优化、多方案搜索和局部重布都检查截止时间；寻路内部每 128 次扩展检查一次。

达到截止时间时返回已完成、已验证的最佳候选。原算法尚未形成完整方案时如实保留未连通状态；超时回退仍补齐原有手工走锡及跳线，不会清空它们。诊断信息中的 `optimization` 记录耗时、初始与最终跳线数及是否达到截止时间。

自动放置内部的快速候选评估保持原算法，不对每个放置候选运行深度优化。最终布线使用相同的深度优化实现。

## 验证

```powershell
python patches/apply_all.py
node patches/tests/route_quality.js
node harness/route-quality.cjs
node harness/check.js
```

对比上一轮已保存数据：

```powershell
node harness/route-quality.cjs --previous=previous-results.json --save=current-results.json
```

对比脚本检查跳线数不高于原算法及传入的上一轮结果、单次布线耗时低于一分钟、输入不被修改、DRC 通过，并使用独立校验器检查连通、短路、斜线和出板。

专门的回归还覆盖：拆除阻挡铜线后消除跳线、锁定线路保护、拥塞历史确实影响路径、寻路内部超时退出、原算法超时、最佳结果回退，以及超时后原线路不丢失。截止时间测试使用可控时钟，不需要实际等待一分钟。
