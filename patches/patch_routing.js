function __lcCopperKey(point) {
  return point[0] + "," + point[1];
}

function __lcCopperGroups(traces, jumpers, omitted) {
  const parents = new Map(), points = new Map();
  function root(key) {
    if (!parents.has(key)) parents.set(key, key);
    let current = key;
    while (parents.get(current) !== current) current = parents.get(current);
    while (key !== current) {
      const next = parents.get(key);
      parents.set(key, current);
      key = next;
    }
    return current;
  }
  function connect(path) {
    if (!path.length) return;
    const first = root(__lcCopperKey(path[0]));
    for (const point of path) {
      const key = __lcCopperKey(point);
      points.set(key, point);
      parents.set(root(key), first);
    }
  }
  traces.forEach(trace => connect(trace.points));
  jumpers.forEach(jumper => {
    if (jumper !== omitted) connect([jumper.from, jumper.to]);
  });
  const fromKey = __lcCopperKey(omitted.from), toKey = __lcCopperKey(omitted.to);
  points.set(fromKey, omitted.from);
  points.set(toKey, omitted.to);
  const fromRoot = root(fromKey), toRoot = root(toKey);
  const from = [], to = [];
  points.forEach((point, key) => {
    const group = root(key);
    if (group === fromRoot) from.push(point);
    if (group === toRoot) to.push(point);
  });
  return { from, to, connected: fromRoot === toRoot };
}

function __lcCopperExpired(search) {
  return !!search && performance.now() >= search.deadline;
}

function __lcCopperLegacyBudget(tasks, search) {
  if (search) tasks.forEach(task => { task.__lcDeadline = search.deadline; });
  return tasks;
}

function __lcCopperComplete(board, plan, endpoints, components, validate, search, oldTraces, oldJumpers) {
  let changed = false;
  for (const trace of oldTraces) {
    if (plan.traces.some(existing => existing === trace || (trace.id && existing.id === trace.id))) continue;
    plan.traces.push(Object.assign({}, trace, { locked: true }));
    changed = true;
  }
  for (const jumper of oldJumpers) {
    if (plan.jumpers.some(existing => existing === jumper || (jumper.id && existing.id === jumper.id))) continue;
    plan.jumpers.push(jumper);
    changed = true;
  }
  if (!plan.drc || changed) {
    const result = validate(board, plan, endpoints, components);
    plan.drc = result.drc;
    plan.diagnostics = { failedNetDetails: result.failedNetDetails };
    const failed = new Set(result.failedNetDetails.map(detail => detail.net));
    result.drc.errors.forEach(error => {
      if (error.net) failed.add(error.net);
      if (error.expectedNet) failed.add(error.expectedNet);
    });
    plan.failedNets = [...failed];
  }
  if (__lcCopperExpired(search)) {
    plan.warnings.push("自动布线达到计算时限，已返回当前方案；请检查未连通网络。");
  }
}

function __lcCopperPath(board, net, sources, targets, pins, cells, search) {
  const width = board.width, height = board.height, size = width * height;
  if (!Number.isSafeInteger(size) || size <= 0 || size > 250000 || __lcCopperExpired(search)) return;
  const targetCells = new Set(targets.filter(point => Number.isInteger(point[0]) && Number.isInteger(point[1]) &&
    point[0] >= 0 && point[1] >= 0 && point[0] < width && point[1] < height).map(point => point[1] * width + point[0]));
  if (!targetCells.size) return;
  const allowed = new Uint8Array(size), entryCosts = new Float64Array(size);
  allowed.fill(1);
  entryCosts.fill(3);
  function cellIndex(key) {
    const separator = key.indexOf(",");
    const column = Number(key.slice(0, separator)), row = Number(key.slice(separator + 1));
    return Number.isInteger(column) && Number.isInteger(row) && column >= 0 && row >= 0 && column < width && row < height ? row * width + column : -1;
  }
  cells.forEach((cell, key) => {
    if (cell.net === net) return;
    const index = cellIndex(key);
    if (search && search.allowOccupied && cell.net !== "__KEEPOUT__" && !search.fixedCells.has(key)) entryCosts[index] += 60;
    else allowed[index] = 0;
  });
  pins.forEach((pin, key) => {
    if (pin.expectedNet !== net) allowed[cellIndex(key)] = 0;
  });
  if (search && search.history) {
    for (let index = 0; index < size; index += 1) entryCosts[index] += search.history[index] || 0;
  }
  const costs = new Float64Array(size * 5);
  costs.fill(Infinity);
  const previous = new Int32Array(size * 5);
  previous.fill(-1);
  const queue = [];
  function push(state, cost) {
    const entry = { state, cost };
    let index = queue.length;
    queue.push(entry);
    while (index > 0) {
      const parentIndex = (index - 1) >> 1;
      if (queue[parentIndex].cost <= cost) break;
      queue[index] = queue[parentIndex];
      index = parentIndex;
    }
    queue[index] = entry;
  }
  function pop() {
    const first = queue[0], last = queue.pop();
    if (queue.length) {
      let index = 0;
      while (index * 2 + 1 < queue.length) {
        let child = index * 2 + 1;
        if (child + 1 < queue.length && queue[child + 1].cost < queue[child].cost) child += 1;
        if (queue[child].cost >= last.cost) break;
        queue[index] = queue[child];
        index = child;
      }
      queue[index] = last;
    }
    return first;
  }
  for (const point of sources) {
    if (!Number.isInteger(point[0]) || !Number.isInteger(point[1]) ||
        point[0] < 0 || point[1] < 0 || point[0] >= width || point[1] >= height || !allowed[point[1] * width + point[0]]) continue;
    const state = (point[1] * width + point[0]) * 5 + 4;
    if (costs[state] === 0) continue;
    costs[state] = 0;
    push(state, 0);
  }
  const steps = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  let expanded = 0;
  while (queue.length) {
    expanded += 1;
    if (expanded % 128 === 0 && __lcCopperExpired(search)) return;
    const entry = pop(), state = entry.state;
    if (entry.cost !== costs[state]) continue;
    const cellIndex = Math.floor(state / 5), direction = state % 5;
    const point = [cellIndex % width, Math.floor(cellIndex / width)];
    if (targetCells.has(cellIndex)) {
      const path = [];
      let cursor = state;
      while (cursor !== -1) {
        const cell = Math.floor(cursor / 5);
        path.push([cell % width, Math.floor(cell / width)]);
        cursor = previous[cursor];
      }
      return path.reverse();
    }
    for (let nextDirection = 0; nextDirection < steps.length; nextDirection += 1) {
      const step = steps[nextDirection], next = [point[0] + step[0], point[1] + step[1]];
      if (next[0] < 0 || next[1] < 0 || next[0] >= width || next[1] >= height || !allowed[next[1] * width + next[0]]) continue;
      const nextState = (next[1] * width + next[0]) * 5 + nextDirection;
      const cost = entry.cost + entryCosts[next[1] * width + next[0]] +
        (direction < 4 && direction !== nextDirection ? search?.bendCost ?? 20 : 0);
      if (cost >= costs[nextState]) continue;
      costs[nextState] = cost;
      previous[nextState] = state;
      push(nextState, cost);
    }
  }
}

function __lcCopperImprove(board, plan, pins, constraints, protectedJumpers, expand, search) {
  if (!plan || !plan.jumpers.length) return plan;
  const traces = plan.traces.slice();
  let jumpers = plan.jumpers.slice();
  const cells = new Map();
  traces.forEach(trace => (trace.__lcBridge ? trace.points : expand(trace.points)).forEach(point => cells.set(__lcCopperKey(point), { net: trace.net })));
  jumpers.forEach(jumper => [jumper.from, jumper.to].forEach(point => {
    const key = __lcCopperKey(point);
    if (!cells.has(key)) cells.set(key, { net: jumper.net });
  }));
  (constraints || []).forEach(constraint => {
    if (!constraint.enabled || constraint.status !== "active" || constraint.kind !== "region_keepout" || !constraint.blockBottomRouting) return;
    const region = constraint.region;
    for (let row = Math.max(0, region.y); row < Math.min(board.height, region.y + region.height); row += 1) {
      for (let column = Math.max(0, region.x); column < Math.min(board.width, region.x + region.width); column += 1) {
        cells.set(column + "," + row, { net: "__KEEPOUT__" });
      }
    }
  });
  const protectedIds = new Set((protectedJumpers || []).map(jumper => jumper.id));
  let changed = false;
  for (const jumper of plan.jumpers) {
    if (__lcCopperExpired(search)) break;
    if (jumper.locked || (jumper.id && protectedIds.has(jumper.id)) || (protectedJumpers || []).includes(jumper)) continue;
    const groups = __lcCopperGroups(traces.filter(trace => trace.net === jumper.net)
      .map(trace => ({ points: trace.__lcBridge ? trace.points : expand(trace.points) })),
      jumpers.filter(other => other.net === jumper.net), jumper);
    const path = groups.connected ? [] : __lcCopperPath(board, jumper.net, groups.from, groups.to, pins, cells, search);
    if (!path) continue;
    jumpers = jumpers.filter(other => other !== jumper);
    if (path.length > 1) {
      traces.push({ id: crypto.randomUUID(), net: jumper.net, layer: "bottom", locked: false,
        points: path, edges: path.slice(1).map((point, index) => [path[index], point]) });
      path.forEach(point => cells.set(__lcCopperKey(point), { net: jumper.net }));
    }
    changed = true;
  }
  return changed ? Object.assign({}, plan, { traces, jumpers }) : plan;
}

function __lcCopperBetter(candidate, current) {
  const candidateErrors = ((candidate.drc && candidate.drc.errors) || []).length;
  const currentErrors = ((current.drc && current.drc.errors) || []).length;
  if (candidateErrors > currentErrors || candidate.failedNets.length > current.failedNets.length) return false;
  if (candidateErrors < currentErrors || candidate.failedNets.length < current.failedNets.length) return true;
  if (candidate.jumpers.length !== current.jumpers.length) return candidate.jumpers.length < current.jumpers.length;
  return __lcCopperCost(candidate) < __lcCopperCost(current);
}

function __lcCopperCost(plan) {
  let cost = 0;
  for (const jumper of plan.jumpers) cost += Math.hypot(jumper.from[0] - jumper.to[0], jumper.from[1] - jumper.to[1]) * 28;
  for (const trace of plan.traces) {
    let direction;
    for (let index = 1; index < trace.points.length; index += 1) {
      const from = trace.points[index - 1], to = trace.points[index];
      const next = from[0] === to[0] ? "v" : "h";
      cost += Math.abs(from[0] - to[0]) * 3 + Math.abs(from[1] - to[1]) * 3;
      if (direction && next !== direction) cost += 55;
      direction = next;
    }
  }
  return cost;
}

function __lcCopperRoute(board, tasks, pins, constraints, oldTraces, oldJumpers, expand, canJump, search) {
  const traces = oldTraces.map(trace => Object.assign({}, trace, { locked: true }));
  const jumpers = oldJumpers.slice(), cells = new Map(), failedNets = [];
  traces.forEach(trace => (trace.__lcBridge ? trace.points : expand(trace.points)).forEach(point => cells.set(__lcCopperKey(point), { net: trace.net })));
  jumpers.forEach(jumper => [jumper.from, jumper.to].forEach(point => cells.set(__lcCopperKey(point), { net: jumper.net })));
  for (const constraint of constraints || []) {
    if (!constraint.enabled || constraint.status !== "active" || constraint.kind !== "region_keepout" || !constraint.blockBottomRouting) continue;
    const region = constraint.region;
    for (let row = Math.max(0, region.y); row < Math.min(board.height, region.y + region.height); row += 1) {
      for (let column = Math.max(0, region.x); column < Math.min(board.width, region.x + region.width); column += 1) {
        cells.set(column + "," + row, { net: "__KEEPOUT__" });
      }
    }
  }
  for (const task of tasks) {
    if (__lcCopperExpired(search)) return { traces, jumpers, failedNets, warnings: [], timedOut: true };
    const netTraces = traces.filter(trace => trace.net === task.net).map(trace => ({ points: trace.__lcBridge ? trace.points : expand(trace.points) }));
    const netJumpers = jumpers.filter(jumper => jumper.net === task.net);
    const points = new Map();
    task.endpoints.forEach(endpoint => points.set(__lcCopperKey(endpoint.grid), endpoint.grid));
    netTraces.forEach(trace => trace.points.forEach(point => points.set(__lcCopperKey(point), point)));
    netJumpers.forEach(jumper => [jumper.from, jumper.to].forEach(point => points.set(__lcCopperKey(point), point)));
    const groups = [];
    while (points.size) {
      if (__lcCopperExpired(search)) return { traces, jumpers, failedNets, warnings: [], timedOut: true };
      const first = points.values().next().value;
      const group = __lcCopperGroups(netTraces, netJumpers, { from: first, to: first }).from;
      group.forEach(point => points.delete(__lcCopperKey(point)));
      groups.push(group);
    }
    groups.sort((left, right) => right.length - left.length);
    const connected = groups.shift() || [], connectedKeys = new Set(connected.map(__lcCopperKey));
    function addConnected(path) {
      for (const point of path) {
        const key = __lcCopperKey(point);
        if (!connectedKeys.has(key)) connected.push(point);
        connectedKeys.add(key);
      }
    }
    while (groups.length) {
      if (__lcCopperExpired(search)) return { traces, jumpers, failedNets, warnings: [], timedOut: true };
      const targets = groups.flat(), path = __lcCopperPath(board, task.net, connected, targets, pins, cells, search);
      if (__lcCopperExpired(search)) return { traces, jumpers, failedNets, warnings: [], timedOut: true };
      let targetIndex = -1;
      if (path) {
        const endKey = __lcCopperKey(path[path.length - 1]);
        targetIndex = groups.findIndex(group => group.some(point => __lcCopperKey(point) === endKey));
        if (path.length > 1) {
          traces.push({ id: crypto.randomUUID(), net: task.net, layer: "bottom", locked: false,
            points: path, edges: path.slice(1).map((point, index) => [path[index], point]) });
          path.forEach(point => cells.set(__lcCopperKey(point), { net: task.net }));
          addConnected(path.slice(1, -1));
        }
      } else {
        let distance = Infinity, best;
        groups.forEach((group, index) => {
          const fromPoints = __lcCopperSample(connected), toPoints = __lcCopperSample(group);
          for (const from of fromPoints) for (const to of toPoints) {
            const length = Math.hypot(from[0] - to[0], from[1] - to[1]);
            if (length < distance && canJump(from, to, constraints)) {
              distance = length;
              best = { from, to, index };
            }
          }
        });
        if (!best) { failedNets.push(task.net); break; }
        targetIndex = best.index;
        jumpers.push({ id: crypto.randomUUID(), net: task.net, from: best.from, to: best.to, layer: "jumper", locked: false });
      }
      if (targetIndex < 0) { failedNets.push(task.net); break; }
      addConnected(groups.splice(targetIndex, 1)[0]);
    }
  }
  return { traces, jumpers, failedNets, warnings: [] };
}

function __lcCopperSample(points) {
  if (points.length <= 128) return points;
  return Array.from({ length: 128 }, (unused, index) => points[Math.floor(index * (points.length - 1) / 127)]);
}

function __lcCopperOccupancy(board, plan, constraints, protectedTraces, protectedJumpers, expand) {
  const cells = new Map(), fixedCells = new Set();
  const traceIds = new Set(protectedTraces.map(trace => trace.id)), jumperIds = new Set(protectedJumpers.map(jumper => jumper.id));
  for (const trace of plan.traces) {
    for (const point of trace.__lcBridge ? trace.points : expand(trace.points)) {
      const key = __lcCopperKey(point);
      cells.set(key, { net: trace.net });
      if (trace.locked || traceIds.has(trace.id)) fixedCells.add(key);
    }
  }
  for (const jumper of plan.jumpers) {
    for (const point of [jumper.from, jumper.to]) {
      const key = __lcCopperKey(point);
      if (!cells.has(key)) cells.set(key, { net: jumper.net });
      if (jumper.locked || jumperIds.has(jumper.id)) fixedCells.add(key);
    }
  }
  for (const constraint of constraints) {
    if (!constraint.enabled || constraint.status !== "active" || constraint.kind !== "region_keepout" || !constraint.blockBottomRouting) continue;
    const region = constraint.region;
    for (let row = Math.max(0, region.y); row < Math.min(board.height, region.y + region.height); row += 1) {
      for (let column = Math.max(0, region.x); column < Math.min(board.width, region.x + region.width); column += 1) {
        cells.set(column + "," + row, { net: "__KEEPOUT__" });
        fixedCells.add(column + "," + row);
      }
    }
  }
  return { cells, fixedCells };
}

function __lcCopperRepair(board, plan, tasks, pins, constraints, protectedTraces, protectedJumpers, tools, search, evaluate) {
  let best = plan, working = plan;
  const traceIds = new Set(protectedTraces.map(trace => trace.id)), jumperIds = new Set(protectedJumpers.map(jumper => jumper.id));
  const taskByNet = new Map(tasks.map(task => [task.net, task]));
  const history = new Float64Array(board.width * board.height);
  for (let pass = 0; pass < 12 && !__lcCopperExpired(search); pass += 1) {
    const counts = new Map();
    working.jumpers.forEach(jumper => counts.set(jumper.net, (counts.get(jumper.net) || 0) + 1));
    const candidates = working.jumpers.filter(jumper => !jumper.locked && !jumperIds.has(jumper.id))
      .sort((left, right) => (counts.get(right.net) || 0) - (counts.get(left.net) || 0));
    let improved = false;
    for (const jumper of candidates) {
      if (__lcCopperExpired(search)) break;
      if (!working.jumpers.includes(jumper) || !taskByNet.has(jumper.net)) continue;
      const occupancy = __lcCopperOccupancy(board, working, constraints, protectedTraces, protectedJumpers, tools.expand);
      const groups = __lcCopperGroups(working.traces.filter(trace => trace.net === jumper.net)
        .map(trace => ({ points: trace.__lcBridge ? trace.points : tools.expand(trace.points) })),
        working.jumpers.filter(other => other.net === jumper.net), jumper);
      const path = __lcCopperPath(board, jumper.net, groups.from, groups.to, pins, occupancy.cells,
        { deadline: search.deadline, allowOccupied: true, fixedCells: occupancy.fixedCells, history });
      if (!path) continue;
      const blockers = new Map();
      for (const point of path) {
        const cell = occupancy.cells.get(__lcCopperKey(point));
        if (!cell || cell.net === jumper.net || !taskByNet.has(cell.net)) continue;
        blockers.set(cell.net, (blockers.get(cell.net) || 0) + 1);
        const index = point[1] * board.width + point[0];
        history[index] = Math.min(120, history[index] + 6);
      }
      if (blockers.size > 4) continue;
      const neighbors = [...blockers.keys()].sort((left, right) => blockers.get(right) - blockers.get(left));
      const selected = new Set([jumper.net, ...neighbors]);
      const seedTraces = working.traces.filter(trace => !selected.has(trace.net) || trace.locked || traceIds.has(trace.id));
      const seedJumpers = working.jumpers.filter(other => !selected.has(other.net) || other.locked || jumperIds.has(other.id));
      const originals = new Map(seedTraces.map(trace => [trace.id, trace]));
      const orders = [[jumper.net, ...neighbors], [jumper.net, ...neighbors.slice().reverse()], [...neighbors, jumper.net]];
      const directTraces = working.traces.filter(trace => !blockers.has(trace.net) || trace.locked || traceIds.has(trace.id));
      const directJumpers = working.jumpers.filter(other => other !== jumper &&
        (!blockers.has(other.net) || other.locked || jumperIds.has(other.id)));
      if (path.length > 1) directTraces.push({ id: crypto.randomUUID(), net: jumper.net, layer: "bottom", locked: false,
        points: path, edges: path.slice(1).map((point, index) => [path[index], point]) });
      const directOriginals = new Map(directTraces.map(trace => [trace.id, trace]));
      orders.unshift(neighbors);
      const seen = new Set();
      for (const order of orders) {
        if (__lcCopperExpired(search)) break;
        const signature = JSON.stringify(order);
        if (seen.has(signature)) continue;
        seen.add(signature);
        const direct = order === neighbors;
        let candidate = __lcCopperRoute(board, order.map(net => taskByNet.get(net)), pins, constraints,
          direct ? directTraces : seedTraces, direct ? directJumpers : seedJumpers,
          tools.expand, tools.canJump, { deadline: search.deadline, bendCost: pass % 2 ? 6 : 20 });
        if (candidate.timedOut) break;
        const originalTraces = direct ? directOriginals : originals;
        candidate.traces = candidate.traces.map(trace => originalTraces.get(trace.id) || trace);
        if (candidate.jumpers.length > working.jumpers.length || candidate.failedNets.length) continue;
        candidate = evaluate(candidate);
        if (candidate.drc.errors.length || candidate.failedNets.length) continue;
        if (__lcCopperBetter(candidate, best)) {
          best = candidate;
          working = candidate;
          improved = true;
          break;
        }
        if (pass < 2 && candidate.jumpers.length === best.jumpers.length &&
            __lcCopperCost(candidate) <= __lcCopperCost(best) * 1.12) working = candidate;
      }
    }
    if (!improved && pass > 5) break;
  }
  return best;
}

function __lcCopperOptimize(board, endpoints, components, base, constraints, oldTraces, oldJumpers, tools, progress, search) {
  const size = board.width * board.height;
  if (board.kind === "breadboard" || !base.jumpers.length || !Number.isSafeInteger(size) || size > 40000 || endpoints.length > 256) return base;
  const protectedIds = new Set(oldJumpers.map(jumper => jumper.id));
  const fixedCount = base.jumpers.filter(jumper => jumper.locked || protectedIds.has(jumper.id) || oldJumpers.includes(jumper)).length;
  if (fixedCount === base.jumpers.length) return base;
  const pins = tools.pins(components, endpoints);
  search = search || { startedAt: performance.now(), deadline: performance.now() + 54000 };
  function evaluate(plan) {
    const result = tools.validate(board, plan, endpoints, components);
    const failed = new Set(result.failedNetDetails.map(detail => detail.net));
    result.drc.errors.forEach(error => {
      if (error.net) failed.add(error.net);
      if (error.expectedNet) failed.add(error.expectedNet);
    });
    for (const constraint of constraints) {
      if (constraint.enabled && constraint.status === "active" && constraint.kind === "net_jumper_limit" && constraint.strength === "hard" &&
          plan.jumpers.filter(jumper => jumper.net === constraint.net).length > constraint.maxJumpers) failed.add(constraint.net);
    }
    return Object.assign({}, plan, { drc: result.drc, diagnostics: { failedNetDetails: result.failedNetDetails }, failedNets: [...failed] });
  }
  let best = evaluate(base);
  const polished = evaluate(__lcCopperImprove(board, best, pins, constraints, oldJumpers, tools.expand, search));
  if (__lcCopperBetter(polished, best)) best = polished;
  const original = tools.tasks(endpoints), seen = new Set();
  let bestTree, bestOrder = original;
  const trials = size <= 2500 && endpoints.length <= 100 ? 40 : size <= 10000 ? 16 : 4;
  for (let trial = 0; trial < trials; trial += 1) {
    if (__lcCopperExpired(search)) break;
    if (!best.failedNets.length && !best.drc.errors.length && best.jumpers.length <= fixedCount) break;
    let order = original.slice();
    if (trial === 1) order.sort((left, right) => left.span - right.span);
    if (trial === 2) order.sort((left, right) => right.span - left.span);
    if (trial > 2 && trial < 23 && order.length) {
      order = bestOrder.slice();
      const moved = order.splice((trial - 3) % order.length, 1)[0];
      order.splice(trial % 2 ? 0 : order.length, 0, moved);
    }
    if (trial >= 23) {
      function rank(task) {
        let value = trial;
        for (const letter of task.net) value = Math.imul(value ^ letter.charCodeAt(0), 16777619);
        return value >>> 0;
      }
      order.sort((left, right) => rank(left) - rank(right));
    }
    const signature = JSON.stringify(order.map(task => task.net));
    if (seen.has(signature)) continue;
    seen.add(signature);
    if (progress) progress({ round: trial + 1, totalRounds: trials, stage: "round" });
    let candidate = __lcCopperRoute(board, order, pins, constraints, oldTraces, oldJumpers, tools.expand, tools.canJump, search);
    if (candidate.timedOut) break;
    if (bestTree && !bestTree.drc.errors.length && !bestTree.failedNets.length && !__lcCopperBetter(candidate, bestTree)) continue;
    candidate = evaluate(candidate);
    if (!bestTree || __lcCopperBetter(candidate, bestTree)) {
      bestTree = candidate;
      bestOrder = order;
    }
    if (__lcCopperBetter(candidate, best)) best = candidate;
  }
  if (!best.drc.errors.length && !best.failedNets.length && !__lcCopperExpired(search)) {
    best = __lcCopperRepair(board, best, original, pins, constraints, oldTraces, oldJumpers, tools, search, evaluate);
  }
  best.score = tools.score(board, best, endpoints);
  const totalLength = best.jumpers.reduce((total, jumper) => total + Math.hypot(jumper.from[0] - jumper.to[0], jumper.from[1] - jumper.to[1]), 0);
  best.jumperStats = { count: best.jumpers.length, totalLength };
  best.diagnostics.optimization = {
    elapsedMs: Math.round(performance.now() - search.startedAt),
    timedOut: __lcCopperExpired(search),
    initialJumpers: base.jumpers.length,
    finalJumpers: best.jumpers.length,
  };
  best.warnings = (base.warnings || []).filter(warning => !String(warning).startsWith("Bottom routing used "));
  if (best.jumpers.length) best.warnings.push("Bottom routing used " + best.jumpers.length + " jumper(s), total jumper length " + totalLength.toFixed(1) + " grid units.");
  if (best.diagnostics.optimization.timedOut) best.warnings.push("已达到布线优化时限，保留当前跳线最少的已验证方案。");
  return best;
}
