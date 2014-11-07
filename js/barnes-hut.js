function barnesHut(pos, span) {
  function emptyBranches() {
    return [null, null, null, null, null, null, null, null];
  }

  function emptyLevel(center, span) {
    return {
      mass: 0,
      center: center,
      span: span,
      branches: emptyBranches()
    }
  }

  function octant(center, node) {
    var side = node[0] < center[0] ? 0 : 1;
    var up = node[1] < center[1] ? 0 : 2;
    var front = node[2] < center[2] ? 0 : 4;
    return [side, up, front];
  }

  function findCenter(center, span, arrow) {
    return [
      center[0] + (span * arrow[0]),
      center[1] + (span * arrow[1]),
      center[2] + (span * arrow[2]),
    ];
  }

  function isBranch(level) {
    return level.span;
  }

  function addNode(level, node) {
    console.log(level);
    var oct = octant(level.center, node);
    var where = oct[0] + oct[1] + oct[2];
    var branch = level.branches[where];

    if (branch) {
      if (isBranch(branch)) {
        addNode(branch, node);
      } else {
        var arrow = [
          oct[0] === 0 ? -1 : 1,
          oct[1] === 0 ? -1 : 1,
          oct[2] === 0 ? -1 : 1
        ];
        var half = level.span * 0.5
        var offcenter = findCenter(level.center, half, arrow);
        var lower = emptyLevel(offcenter, half);

        addNode(lower, branch);
        addNode(lower, node);
        level.branches[where] = lower;
      }
    } else {
      level.branches[where] = node;
    }

    level.mass += 1;
  }

  function buildTree(pos, span) {
    var root = emptyLevel([0, 0, 0], span);
    for (var n = 0; n < pos.length; n += 3) {
      addNode(root, [pos[n], pos[n+1], pos[n+2]]);
    }
    return root;
  }

  return buildTree(pos, span);
}
