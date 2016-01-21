function barnesHut(pos, span, theta) {
  function emptyBranches() {
    return [null, null, null, null, null, null, null, null];
  }

  function emptyLevel(center, span) {
    return {
      mass: 0,
      center: center,
      nexus: [0, 0, 0],
      span: span,
      branches: emptyBranches()
    }
  }

  function octant(center, node) {
    var side = node[0] <= center[0] ? 0 : 1;
    var up = node[1] <= center[1] ? 0 : 2;
    var front = node[2] <= center[2] ? 0 : 4;
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
    return level.mass;
  }

  function equalNodes(a, b) {
    return (!isBranch(a) && !isBranch(b) && a[0] === b[0] && a[1] === b[1] && a[2] === b[2]);
  }

  function addMass(nexus, mass, point) {
    nexus[0] = (nexus[0] * mass + point[0]) / (mass + 1);
    nexus[1] = (nexus[1] * mass + point[1]) / (mass + 1);
    nexus[2] = (nexus[2] * mass + point[2]) / (mass + 1);
  }

  function addNode(level, node) {
    var oct = octant(level.center, node);
    var where = oct[0] + oct[1] + oct[2];
    var branch = level.branches[where];

    if (branch) {
      if (isBranch(branch)) {
        addNode(branch, node);
      } else if (equalNodes(branch, node)) {

      } else {
        var arrow = [
          oct[0] === 0 ? -1 : 1,
          oct[1] === 0 ? -1 : 1,
          oct[2] === 0 ? -1 : 1
        ];
        var half = level.span * 0.5;
        var offcenter = findCenter(level.center, half, arrow);
        var lower = emptyLevel(offcenter, half);

        addNode(lower, branch);
        addNode(lower, node);
        level.branches[where] = lower;
      }
    } else {
      level.branches[where] = node;
    }

    addMass(level.nexus, level.mass, node);
    level.mass += 1;
  }

  function inBounds(span, node) {
    return (node[0] < span && node[0] > -span &&
            node[1] < span && node[1] > -span &&
            node[2] < span && node[2] > -span);
  }

  function buildTree(pos, span) {
    var root = emptyLevel([0, 0, 0], span);
    for (var n = 0; n < pos.length; n += 3) {
      var node = [pos[n], pos[n+1], pos[n+2]]
      var stack = [];
      if (inBounds(span, node)) {
        addNode(root, node);
      }
    }
    return root;
  }

  function add(p, v, m) {
    p[0] += v[0] * m;
    p[1] += v[1] * m;
    p[2] += v[2] * m;
  }

  function relate(a, b) {
    var x = a[0] - b[0];
    var y = a[1] - b[1];
    var z = a[2] - b[2];
    return [Math.sqrt(x*x + y*y + z*z), [x, y, z]];
  }

  function repulsion(level, node) {
    var acceleration = [0, 0, 0];
    var nexus, force;
    if (isBranch(level)) {
      nexus = level.nexus;
    } else {
      nexus = level;
    }

    var relation = relate(node, nexus);
    var distance = relation[0];
    var direction = relation[1];

    if (isBranch(level)) {
      var ratio = level.span / distance;
      if (ratio < theta) {
        add(acceleration, direction, level.mass / (distance * distance));
      } else {
        level.branches.forEach(function(branch) {
          if (branch) {
            force = repulsion(branch, node);
            add(acceleration, force, 1.0);
          }
        });
      }
    } else {
      if (distance > 0) {
        add(acceleration, direction, 1.0 / (distance * distance));
      }
    }

    return acceleration;
  }

  var tree = buildTree(pos, span);
  tree.repulsion = repulsion;
  return tree;
}
