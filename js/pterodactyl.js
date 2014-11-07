var renderer, camera;
var scene, element;
var ambient, point;
var aspectRatio, windowHalf;
var mouse, time;

var controls;
var clock;

var ground, groundGeometry, groundMaterial;
var network, nodeGeometry, edgeGeometry, nodeParticles, nodeColors;
var dampening = 0.98;

function initScene() {
  clock = new THREE.Clock();
  mouse = new THREE.Vector2(0, 0);
  windowHalf = new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2);
  aspectRatio = window.innerWidth / window.innerHeight;
  
  scene = new THREE.Scene();  

  camera = new THREE.PerspectiveCamera(45, aspectRatio, 1, 10000);
  camera.position.z = 800;
  camera.lookAt(scene.position);

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);

  element = document.getElementById('viewport');
  element.appendChild(renderer.domElement);
  controls = new THREE.OrbitControls(camera);

  time = Date.now();
}

function mod(n, d) {
  while (n < 0) n += d;
  while (n >= d) n -= d;
  return n;
}

function initLights(){
  ambient = new THREE.AmbientLight(0x001111);
  scene.add(ambient);

  point = new THREE.SpotLight( 0xffffff, 1, 0, Math.PI, 1 );
  point.position.set( -250, 250, 150 );
  point.target.position.set( 0, 0, 0 );

  scene.add(point);
}

function defineNodeColors() {
  nodeColors = {};
  for (var c = 0; c < 20; c++) {
    nodeColors[c.toString()] = randomColor();
  }
}

function initNetwork(name) {
  defineNodeColors();
  loadJSON('networks/' + name + '.json', function(nodes) {
    network = {nodes: {}, edges: [], identities: []};
    nodes.forEach(function(node, index) {
      node.index = index;
      node.velocity = [0.0, 0.0, 0.0];
      node.repulsion = 0.1;
      node.springLength = 200.0;
      node.springConstant = 1.0;
      node.color = nodeColors[node.modularity_scores] || nodeColors['0'];
      network.identities.push(node.identity);
      network.nodes[node.identity] = node;
      node.friendship_identities.forEach(function(edge) {
        network.edges.push([node.identity, edge]);
      });
    });

    initParticles();
    initEdgeBuffer();
  });
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

function randomColor() {
  var r = Math.random() * 0.5 + 0.05;
  var g = Math.random() * 0.5 + 0.05;
  var b = Math.random() * 0.5 + 0.05;
  return [r, g, b];
}

function randomColors(colors) {
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
    alphas[i] = x;
  }
}

function randomSizes(sizes) {
  var n = 50.0, n2 = 50.0;
  for (var i = 0; i < sizes.length; i++) {
    var x = Math.random() * n + n2;
    sizes[i] = x;
  }
}

function particleMaterial(type) {
  var uniforms = {
    texture: {type: 't', value: THREE.ImageUtils.loadTexture('img/sprites/disc.png')}
  };

  var attributes = {
    // position: { type: 'v3', value: null },
    color: { type: 'c', value: null },
    size: { type: 'f', value: null },
    alpha: { type: 'f', value: null }
  };

  var material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    attributes: attributes,
    vertexShader: document.getElementById(type+'vertexshader').textContent,
    fragmentShader: document.getElementById(type+'fragmentshader').textContent,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    transparent: true
  });

  return material;
}

function initParticles() {
  var nodeIdentities = Object.keys(network.nodes);
  network.nodePositions = new Float32Array(nodeIdentities.length * 3);
  network.nodeColors = new Float32Array(nodeIdentities.length * 3);
  network.nodeAlphas = new Float32Array(nodeIdentities.length);
  network.nodeSizes = new Float32Array(nodeIdentities.length);

  randomPositions(network.nodePositions);
  randomColors(network.nodeColors);
  randomAlphas(network.nodeAlphas);
  randomSizes(network.nodeSizes);

  nodeGeometry = new THREE.BufferGeometry();
  nodeGeometry.dynamic = true;
  nodeGeometry.addAttribute('position', new THREE.BufferAttribute(network.nodePositions, 3));
  nodeGeometry.addAttribute('color', new THREE.BufferAttribute(network.nodeColors, 3));
  nodeGeometry.addAttribute('alpha', new THREE.BufferAttribute(network.nodeAlphas, 1));
  nodeGeometry.addAttribute('size', new THREE.BufferAttribute(network.nodeSizes, 1));

  var material = particleMaterial('node');
  nodeGeometry.computeBoundingSphere();
  nodeParticles = new THREE.PointCloud(nodeGeometry, material);
  nodeParticles.sortParticles = true;
  scene.add(nodeParticles);
}

function initEdgeBuffer() {
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
  parent_node = new THREE.Object3D();
  parent_node.add(mesh);
  scene.add(parent_node);
}

function init() {
  document.addEventListener('keydown', onKeyDown, false);
  document.addEventListener('keyup', onKeyUp, false);
  document.addEventListener('mousedown', onMouseDown, false);
  document.addEventListener('mousemove', onMouseMove, false);

  window.addEventListener('resize', onResize, false);

  initScene();
  initLights();
  initNetwork('mauve');
}

function onResize() {
  windowHalf = new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2);
  aspectRatio = window.innerWidth / window.innerHeight;
  camera.aspect = aspectRatio;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(event) {
  mouse.set( (event.clientX / window.innerWidth - 0.5) * 2, (event.clientY / window.innerHeight - 0.5) * 2);
}

function onMouseDown(event) {
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

function updateNodePositions(delta) {
  if (network) {
    var pos = network.nodePositions

    network.edges.forEach(function(edge) {
      var from = network.nodes[edge[0]];
      var to = network.nodes[edge[1]];
      var relation = relate(pos[from.index*3], pos[from.index*3+1], pos[from.index*3+2], pos[to.index*3], pos[to.index*3+1], pos[to.index*3+2]);
      var distance = relation[0];
      var direction = relation[1];
      add(from.velocity, direction, (distance - from.springLength) * -0.5 * from.springConstant * delta);
      add(to.velocity, direction, (distance - to.springLength) * 0.5 * to.springConstant * delta);
    });

    network.identities.forEach(function(fromkey) {
      var from = network.nodes[fromkey]
      var velocity = from.velocity;
      add(velocity, [1.0 / pos[from.index*3], 1.0 / pos[from.index*3+1], 1.0 / pos[from.index*3+2]], 0.001);
      scale(velocity, dampening);

      // network.identities.forEach(function(tokey) {
      //   var to = network.nodes[tokey];
      //   if (from.index !== to.index) {
      //     var relation = relate(pos[from.index*3], pos[from.index*3+1], pos[from.index*3+2], pos[to.index*3], pos[to.index*3+1], pos[to.index*3+2]);
      //     var distance = relation[0] + 0.1;
      //     var direction = relation[1];
      //     add(from.velocity, direction, from.repulsion / (distance * distance));
      //   }
      // });

      pos[from.index*3] += velocity[0] * delta;
      pos[from.index*3+1] += velocity[1] * delta;
      pos[from.index*3+2] += velocity[2] * delta;
    });
  }
}

function render() {
  var delta = clock.getDelta();
  time += delta;

  updateNodePositions(delta);
  // updateParticleColors();

  if (nodeGeometry && edgeGeometry) {
    nodeGeometry.attributes.position.needsUpdate = true;
    nodeGeometry.attributes.color.needsUpdate = true;
    nodeGeometry.computeBoundingSphere();
    edgeGeometry.attributes.position.needsUpdate = true;
    edgeGeometry.computeBoundingSphere();
  }

  controls.update();
  renderer.render(scene, camera);
}

function animate() {
  requestAnimationFrame(animate);
  render();
}

window.onload = function() {
  init();
  animate();
}
