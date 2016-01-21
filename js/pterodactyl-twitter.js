var pterodactyl = function () {
  var scene, element;
  var renderer, camera;
  var ambient, spot;
  var aspectRatio, windowHalf;
  var mouse;
  var time, start;
  var width, height;

  var controls;
  var clock;

  var ground, groundGeometry, groundMaterial;
  var bounds;
  var network, originalNodes, edgeGeometry, nodeParticles, nodeColors, edgeParent;
  var spheres, sphereBall, nodeSphereMapping;
  var tweens = [];
  var dampening, vortex;
  var nodeName;
  var nodeAvatar;
  var selected;
  var white, black;
  var dormant = true, showing, filters, outerChosen = [];
  var animation, deltaMax = 0.5;

  var parameters = {
    dampening: 0,
    vortex: 0.1,
    repulsion: 100.0,
    springLength: 200.0,
    springConstant: 0.05
  };

  function disposeObject(obj)
  {
    if (obj !== null) {
      for (var i = 0; i < obj.children.length; i++) {
        disposeObject(obj.children[i]);
      }
      if (obj.geometry) {
        obj.geometry.dispose();
        obj.geometry = undefined;
      }
      if (obj.material) {
        if (obj.material.materials) {
          for (i = 0; i < obj.material.materials.length; i++) {
            obj.material.materials[i].dispose();
          }
        } else {
          obj.material.dispose();
        }
        obj.material = undefined;
      }
      if (obj.texture) {
        obj.texture.dispose();
        obj.texture = undefined;
      }
    }
    obj = undefined;
  }

  function dispose() {
    console.log("cleaning up animation")

    if (animation) {
      cancelAnimationFrame(animation);
      animation = null;
    }

    if (scene) {
      while (scene.children.length > 0) {
        var child = scene.children[scene.children.length - 1];
        disposeObject(child);
        scene.remove(child);
      }

      scene = null;
    }

    element = document.getElementById('viewport');
    if (element) {
      element.innerHTML = '';
    }

    if (nodeName) {
      document.body.removeChild(nodeName);
      nodeName = null;
    }

    if (nodeAvatar) {
      document.body.removeChild(nodeAvatar);
      nodeAvatar = null;
    }

    parameters.dampening = 0;
    dormant = true;
  }

  function initScene() {
    clock = new THREE.Clock();
    mouse = new THREE.Vector2(0, 0);
    white = new THREE.Color(1, 1, 1);
    black = new THREE.Color(0, 0, 0);
    width = 759;
    height = 400;
    aspectRatio = width / height;
    
    if (renderer) {
      console.log("reloading connections....");
    } else {
      renderer = new THREE.WebGLRenderer();
      renderer.setSize(width, height);
      renderer.setClearColor(0xeeeeee, 1);
    }

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, aspectRatio, 1, 10000);
    camera.position.z = 2700;
    camera.lookAt(scene.position);
    bounds = {min: new THREE.Vector3(-10000, -10000, -10000),
              max: new THREE.Vector3(10000, 10000, 10000)}

    element = document.getElementById('viewport');
    element.appendChild(renderer.domElement);
    controls = new THREE.OrbitControls(camera, renderer.domElement);

    time = Date.now();
    start = time;

    nodeName = document.createElement('div');
    nodeName.className = "node-name";
    document.body.appendChild(nodeName);

    nodeAvatar = document.createElement('img');
    document.body.appendChild(nodeAvatar);
  }

  function mod(n, d) {
    while (n < 0) n += d;
    while (n >= d) n -= d;
    return n;
  }

  function initLights() {
    // ambient = new THREE.AmbientLight(0x001111);
    ambient = new THREE.AmbientLight(0x001111);
    scene.add(ambient);

    spot = new THREE.SpotLight( 0xffffff, 1, 0, Math.PI, 1 );
    spot.position.set( -250, 250, 150 );
    spot.target.position.set( 0, 0, 0 );

    scene.add(spot);
  }

  function pointLight(position) {
    var point = new THREE.PointLight(0xffffff, 1, 1000);
    point.position.copy(position);
    return point;
  }

  function randomColor() {
    var r = Math.random() * 0.5 + 0.05;
    var g = Math.random() * 0.5 + 0.05;
    var b = Math.random() * 0.5 + 0.05;
    return [r, g, b];
  }

  function defineNodeColors() {
    nodeColors = {};
    var colors = [];
    var hue = Math.random();
    var saturation = 0.7;
    var lightness = 0.4;
    var paletteSize = 19;
    for (var c = 0; c < paletteSize; c++) {
      colors[c] = new THREE.Color().setHSL(hue, saturation, lightness);
      hue = (hue + 1.0 / paletteSize) % 1;
    }
    for (var c = 0; c < paletteSize; c++) {
      var index = (c * 7) % paletteSize;
      var color = colors[index];
      nodeColors[c] = [color.r, color.g, color.b];
    }
  }

  function initNetwork(nodes) {
    defineNodeColors();
    network = {nodes: {}, edges: [], identities: []};
    originalNodes = nodes;
    nodes.forEach(function(node, index) {
      node.index = index;
      node.mass = node.betweenness + 1;
      node.size = (node.betweenness * 100 + 100) / 100;
      node.velocity = [0.0, 0.0, 0.0];
      node.acceleration = [0.0, 0.0, 0.0];

      node.repulsion = 10.0;
      node.springLength = 1.0;
      node.springConstant = 0.01;
      node.showing = true;

      var color = new THREE.Color(node.color);
      var hsl = color.getHSL();
      color.setHSL(hsl.h, 0.5, 0.6);
      node.color = [color.r, color.g, color.b];
      network.identities.push(node.id);
      network.nodes[node.id] = node;
    });

    network.sortedIdentities = network.identities.slice(0);
    network.sortedIdentities.sort(function(a, b) {
      return a - b;
    });

    network.identities.forEach(function(identity, index) {
      var node = network.nodes[identity];
      node.outgoing.forEach(function(edge) {
        if (network.nodes[edge]) {
          network.edges.push([node.id, edge]);
        }
      });
    });

    initParticles(network);
    initEdgeBuffer(network);
  }

  function randomPositions(positions) {
    var n = 1000, n2 = n / 2;

    for (var i = 0; i < positions.length; i += 3) {
      var x = Math.random() * n - n2;
      var y = Math.random() * n - n2;
      var z = Math.random() * n - n2;
      positions[i]   = x;
      positions[i+1] = y;
      positions[i+2] = z;
    }
  }

  function randomColors(network, colors) {
    network.identities.forEach(function(identity, index) {
      var color = network.nodes[identity].color;
      colors[index*3]   = color[0];
      colors[index*3+1] = color[1];
      colors[index*3+2] = color[2];
    });
  }

  function randomAlphas(alphas) {
    var n = 0.9, n2 = 0.1;
    for (var i = 0; i < alphas.length; i++) {
      var x = Math.random() * n + n2;
      alphas[i] = 1.0; // x;
    }
  }

  function betweennessSize(network, sizes) {
    network.identities.forEach(function(identity, index) {
      sizes[index] = network.nodes[identity].size;
    });
  }

  function particleMaterial(type) {
    var uniforms = {
      texture: {type: 't', value: THREE.ImageUtils.loadTexture('img/disc.png')}
    };

    var attributes = {
      // position: { type: 'v3', value: null },
      color: { type: 'c', value: null },
      size: { type: 'f', value: null },
      alpha: { type: 'f', value: null }
    };

    var material = new THREE.RawShaderMaterial({
      uniforms: uniforms,
      attributes: attributes,
      vertexShader: document.getElementById(type+'vertexshader').textContent,
      fragmentShader: document.getElementById(type+'fragmentshader').textContent,
      // blending: THREE.AdditiveBlending,
      depthTest: true,
      transparent: true,
      // alphaTest: 0.01
    });

    return material;
  }

  function initParticles(network) {
    var nodeIdentities = Object.keys(network.nodes);
    network.nodePositions = new Float32Array(nodeIdentities.length * 3);
    network.nodeColors = new Float32Array(nodeIdentities.length * 3);
    network.nodeAlphas = new Float32Array(nodeIdentities.length);
    network.nodeSizes = new Float32Array(nodeIdentities.length);

    randomPositions(network.nodePositions);
    randomColors(network, network.nodeColors);
    randomAlphas(network.nodeAlphas);
    betweennessSize(network, network.nodeSizes);

    spheres = [];
    nodeSphereMapping = {};
    sphereGeometry = new THREE.SphereGeometry(20, 16, 16);

    network.identities.forEach(function(identity, index) {
      var node = network.nodes[identity];
      var color = new THREE.Color(node.color[0], node.color[1], node.color[2]);
      //    var material = new THREE.MeshLambertMaterial({color: color});
      var material = new THREE.MeshBasicMaterial({color: color});
      var sphere = new THREE.Mesh(sphereGeometry, material);
      sphere.position.set(network.nodePositions[index*3], network.nodePositions[index*3+1], network.nodePositions[index*3+2]);
      sphere.scale.multiplyScalar(node.size);
      sphere.node = node;
      spheres.push(sphere);
      nodeSphereMapping[node.id] = sphere;
    });

    sphereBall = new THREE.Object3D();

    spheres.forEach(function(sphere) {
      sphereBall.add(sphere);
    });

    scene.add(sphereBall);
  }

  function initEdgeBuffer(network) {
    network.edgeIndexes = new Uint16Array(network.edges.length * 2);
    network.edges.forEach(function(edge, index) {
      var from = network.nodes[edge[0]].index;
      var to = network.nodes[edge[1]].index;
      network.edgeIndexes[index*2] = from;
      network.edgeIndexes[index*2 + 1] = to;
    });

    edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.dynamic = true;
    edgeGeometry.addAttribute('index', new THREE.BufferAttribute(network.edgeIndexes, 1));
    edgeGeometry.addAttribute('position', new THREE.BufferAttribute(network.nodePositions, 3));
    edgeGeometry.addAttribute('color', new THREE.BufferAttribute(network.nodeColors, 3));
    edgeGeometry.addAttribute('alpha', new THREE.BufferAttribute(network.nodeAlphas, 1));
    edgeGeometry.computeBoundingSphere();

    var material = particleMaterial('edge');
    mesh = new THREE.Line(edgeGeometry, material, THREE.LinePieces);
    edgeParent = new THREE.Object3D();
    edgeParent.add(mesh);
    scene.add(edgeParent);
  }

  function init(nodes, chosen) {
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);
    document.addEventListener('mousedown', onMouseDown, false);
    document.addEventListener('mousemove', onMouseMove, false);

    // window.addEventListener('resize', onResize, false);

    initScene();
    initLights();
    initNetwork(nodes, chosen);
  }

  function onResize() {
    windowHalf = new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2);
    aspectRatio = window.innerWidth / window.innerHeight;
    camera.aspect = aspectRatio;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function mouseNodes(event) {
    var bounds = renderer.domElement.getBoundingClientRect();
    var canvasX = event.clientX - bounds.left;
    var canvasY = event.clientY - bounds.top;
    var mouse = new THREE.Vector3((canvasX / width)*2 - 1,
                                  -(canvasY / height)*2 + 1,
                                  0.5); 
    var raycaster = new THREE.Raycaster();
    mouse.unproject(camera);
    raycaster.set(camera.position, mouse.sub(camera.position).normalize());
    return raycaster.intersectObjects(spheres);
  }

  function hideNodeDisplay() {
    if (nodeName && nodeAvatar) {
      nodeName.style.display = 'none';
      nodeAvatar.style.display = 'none';
    }
  }

  function inViewport(x, y) {
    return x >= 0 && x <= width && y >= 0 && y <= height;
  }

  function onMouseMove(event) {
    if (!dormant && showing && inViewport(event.offsetX, event.offsetY)) {
      var intersects = mouseNodes(event);
      var found, index = 0;
      while (!found && index < intersects.length) {
        if (intersects[index].object.node.showing) {
          found = intersects[index].object.node;
        } else {
          index++;
        }
      }

      if (found) {
        nodeName.style.display = 'block';
        nodeName.style.position = 'absolute';
        nodeName.style.left = '' + (event.clientX + 10) + 'px';
        nodeName.style.top = '' + (event.clientY - 30) + 'px';
        nodeName.innerHTML = found['screen-name'];

        nodeAvatar.style.display = 'block';
        nodeAvatar.style.position = 'absolute';
        nodeAvatar.style.left = '' + (event.clientX + 10) + 'px';
        nodeAvatar.style.top = '' + (event.clientY - 80) + 'px';
        nodeAvatar.src = found['profile-image-url-https'];
      } else {
        hideNodeDisplay();
      }
    } else {
      hideNodeDisplay();
    }
  }

  function updateSpheres() {
    spheres.forEach(function(sphere) {
      sphere.material.needsUpdate = true;
    });
  }

  function setNodeColor(node, color, alpha) {
    network.nodeColors[node.index*3] = color.r;
    network.nodeColors[node.index*3+1] = color.g;
    network.nodeColors[node.index*3+2] = color.b;
    network.nodeAlphas[node.index] = alpha;
  }

  function centerNetwork(position) {
    tweens.forEach(function(tween) {
      tween.stop();
    });

    var to = position.clone().multiplyScalar(-1);
    var sphereTween = new TWEEN.Tween(sphereBall.position).to(to, 500);
    var edgeTween = new TWEEN.Tween(edgeParent.position).to(to, 500);

    tweens = [];
    tweens.push(sphereTween);
    tweens.push(edgeTween);

    tweens.forEach(function(tween) {
      tween.easing(TWEEN.Easing.Quadratic.Out);
      tween.start();
    });
  }

  function setDifference(a, b) {
    var result = [];
    var ai = 0, bi = 0, level = 0;

    while(ai < a.length) {
      if (bi < b.length) {
        level = b[bi];
      } else {
        level = Infinity;
      }

      if (a[ai] < level) {
        result.push(a[ai]);
        ai++;
      } else if (a[ai] > level) {
        bi++;
      } else {
        ai++;
        bi++;
      }
    }

    return result;
  }

  function showNode(node) {
    var sphere = nodeSphereMapping[node];
    if (sphere) {
      var nodeColor = sphere.node.color;
      var color =  new THREE.Color(nodeColor[0], nodeColor[1], nodeColor[2]);
      sphere.visible = true;
      setNodeColor(sphere.node, color, 1);
    } else {
      console.log("MISSING SPHERE " + node);
    }
  }

  function hideNode(node) {
    var sphere = nodeSphereMapping[node];
    sphere.visible = false;
    setNodeColor(sphere.node, black, 0);
  }

  function applyFilter(chosen) {
    if (network) {
      var filtered = setDifference(network.sortedIdentities, chosen);

      chosen.forEach(function(node) {
        if (network.nodes[node]) {
          showNode(node);
          network.nodes[node].showing = true;
        }
      });

      filtered.forEach(function(node) {
        hideNode(node);
        network.nodes[node].showing = false;
      });

      edgeGeometry.attributes.color.needsUpdate = true;
      edgeGeometry.attributes.alpha.needsUpdate = true;

      updateSpheres();
    }
  }

  function selectNode(node) {
    filters.add(node.object.node.id, node.object.node.connections);

    var color = node.object.material.color;
    var hsl = color.getHSL();
    var lighter = new THREE.Color();

    // lighter.setHSL(hsl.h, 1.0, 0.8);
    // node.object.material = new THREE.MeshBasicMaterial({color: lighter});
    // setNodeColor(node.object.node, lighter, 1);

    centerNetwork(node.object.position);

    // var light = pointLight(node.object.position);
    // scene.add(light);

    selected = {
      node: node,
      color: color,
      scale: node.object.scale.clone(),
      start: time
    };
  }

  function deselectNode() {
    // scene.remove(selected.light);
    // selected.node.object.material = new THREE.MeshBasicMaterial({color: selected.color});

    selected.node.object.scale.copy(selected.scale);
    setNodeColor(selected.node.object.node, selected.color, 1);

    selected = null;
  }

  function onMouseDown(event) {
    if (!dormant) {
      var intersects = mouseNodes(event);
      var node, index = 0;
      while (!node && index < intersects.length) {
        if (intersects[index].object.node.showing) {
          node = intersects[index];
        } else {
          index++;
        }
      }

      hideNodeDisplay();

      if (node) {
        var selectedNode = selected && selected.node;

        if (selectedNode) {
          filters.remove();
        }

        if (!selectedNode || selectedNode.object !== node.object) {
          selectNode(node);
        }
      }
    }
  }

  function onKeyDown(event) {

  }

  function onKeyUp(event) {

  }

  function relate(ax, ay, az, bx, by, bz) {
    var x = ax - bx;
    var y = ay - by;
    var z = az - bz;
    var distance = Math.sqrt(x*x + y*y + z*z);
    var inverse = 1.0 / distance;
    return [distance, [x * inverse, y * inverse, z * inverse]];
  }

  function add(p, v, m) {
    p[0] += v[0] * m;
    p[1] += v[1] * m;
    p[2] += v[2] * m;
  }

  function scale(p, s) {
    p[0] *= s;
    p[1] *= s;
    p[2] *= s;
  }

  function springForces(network, delta) {
    var pos = network.nodePositions
    network.edges.forEach(function(edge) {
      var from = network.nodes[edge[0]];
      var to = network.nodes[edge[1]];
      var relation = relate(pos[from.index*3], pos[from.index*3+1], pos[from.index*3+2], pos[to.index*3], pos[to.index*3+1], pos[to.index*3+2]);
      var distance = relation[0];
      var direction = relation[1];
      // add(from.velocity, direction, (distance - from.springLength) * -0.5 * from.springConstant);
      // add(to.velocity, direction, (distance - to.springLength) * 0.5 * to.springConstant);

      add(from.acceleration, direction, (distance - parameters.springLength) * -0.5 * parameters.springConstant);
      add(to.acceleration, direction, (distance - parameters.springLength) * 0.5 * parameters.springConstant);
      // add(from.acceleration, direction, (distance - from.springLength) * -0.5 * from.springConstant);
      // add(to.acceleration, direction, (distance - to.springLength) * 0.5 * to.springConstant);
    });
  }

  function bruteForceRepulsion(network, delta, from) {
    network.identities.forEach(function(tokey) {
      var to = network.nodes[tokey];
      if (from.index !== to.index) {
        var relation = relate(pos[from.index*3], pos[from.index*3+1], pos[from.index*3+2], pos[to.index*3], pos[to.index*3+1], pos[to.index*3+2]);
        var distance = relation[0] + 0.1;
        var direction = relation[1];
        add(from.velocity, direction, from.repulsion / (distance * distance));
      }
    });
  }

  function ensureBounds(index) {
    var n = 1000;
    var out = false;
    var pos = network.nodePositions;
    if (isNaN(pos[index*3])) {pos[index*3] = Math.random() * n - (0.5 * n); out = true}
    if (isNaN(pos[index*3+1])) {pos[index*3+1] = Math.random() * n - (0.5 * n); out = true}
    if (isNaN(pos[index*3+2])) {pos[index*3+2] = Math.random() * n - (0.5 * n)};
    if (pos[index*3] < bounds.min.x) {pos[index*3] = 0; out = true}
    if (pos[index*3+1] < bounds.min.y) {pos[index*3+1] = 0; out = true}
    if (pos[index*3+2] < bounds.min.z) {pos[index*3+2] = 0; out = true}
    if (pos[index*3] > bounds.max.x) {pos[index*3] = 0; out = true}
    if (pos[index*3+1] > bounds.max.x) {pos[index*3+1] = 0; out = true}
    if (pos[index*3+2] > bounds.max.x) {pos[index*3+2] = 0; out = true}

    if (out) {
      originalNodes[index].velocity = [0, 0, 0];
    }
  }

  function applyForces(network, delta) {
    var pos = network.nodePositions;
    var tree = barnesHut(network.nodePositions, 10000, 0.5);

    network.identities.forEach(function(fromkey, index) {
      var from = network.nodes[fromkey]
      add(from.acceleration, [1.0 / pos[from.index*3], 1.0 / pos[from.index*3+1], 1.0 / pos[from.index*3+2]], parameters.vortex);
      add(from.acceleration, tree.repulsion(tree, [pos[from.index*3], pos[from.index*3+1], pos[from.index*3+2]]), parameters.repulsion);
      // add(from.acceleration, tree.repulsion(tree, [pos[from.index*3], pos[from.index*3+1], pos[from.index*3+2]]), from.repulsion);
      add(from.velocity, from.acceleration, delta);
      scale(from.velocity, parameters.dampening);
      from.acceleration = [0, 0, 0];

      pos[from.index*3] += from.velocity[0] * delta;
      pos[from.index*3+1] += from.velocity[1] * delta;
      pos[from.index*3+2] += from.velocity[2] * delta;

      ensureBounds(from.index);
      spheres[index].position.set(pos[from.index*3], pos[from.index*3+1], pos[from.index*3+2]);
    });
  }

  function updateNodePositions(network, delta) {
    if (network) {
      springForces(network, delta);
      applyForces(network, delta);
    }

    // if (selected) {
    //   selected.light.position.copy(selected.node.object.position);
    // }

    TWEEN.update();
  }

  function approach(n, s, t) {
    return n + (-1.0 / (s * t));
  }

  function render() {
    var delta = clock.getDelta();
    if (delta > deltaMax) delta = deltaMax;
    time += delta;

    parameters.dampening = approach(0.98, 3, time + 1 - start);

    if (selected) {
      var newScale = selected.scale.x + (Math.sin((time - selected.start) * 13) * 0.1 * selected.scale.x);
      selected.node.object.scale.set(newScale, newScale, newScale);
    }

    updateNodePositions(network, delta);

    if (edgeGeometry) {
      edgeGeometry.attributes.position.needsUpdate = true;
      edgeGeometry.computeBoundingSphere();
    }

    controls.update();
    renderer.render(scene, camera);
  }

  function animate() {
    animation = requestAnimationFrame(animate);
    render();
  }

  function loadHairball(nodes, triggerAddFilter, triggerRemoveFilter) {
    console.log("LOADING HAIRBALL: " + nodes.length);

    dormant = false;

    filters = {
      add: triggerAddFilter,
      remove: triggerRemoveFilter
    };

    init(nodes);

    parameters.dampening = 0;
    animate();
  }

  return {
    load: loadHairball,
    show: function() {showing = true;},
    hide: function() {showing = false;},
    applyFilter: applyFilter,
    deselectNode: deselectNode,
    dispose: dispose,
    parameters: parameters
  }
} ();
