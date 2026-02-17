var query = require('query-string').parse(window.location.search.substring(1));
var renderGraph = require('../..');
var THREE = renderGraph.THREE;
var graph = getGraphFromQueryString(query);

var nodeIds = [];
graph.forEachNode(function(node) {
  nodeIds.push(node.id);
});

var renderer = renderGraph(graph, {
  onCameraChange: clampCameraZ,
  movementSpeed: speedFromZ,
  rollSpeed: 0.2
});

var currentNodeIndex = 0;
var statusLine = document.getElementById('status');
var targetX = document.getElementById('targetX');
var targetY = document.getElementById('targetY');
var targetZ = document.getElementById('targetZ');
var targetDx = document.getElementById('targetDx');
var targetDy = document.getElementById('targetDy');
var targetDz = document.getElementById('targetDz');

renderer.on('camerachanged', updateStatus);
renderer.on('nodeclick', function(node) {
  if (!node) return;
  currentNodeIndex = nodeIds.indexOf(node.id);
  if (currentNodeIndex < 0) currentNodeIndex = 0;
  renderer.showNode(node.id, 120, {
    durationMs: getTransitionDuration(),
    planeNormal: {x: 0, y: 0, z: 1},
    finalZ: getTargetZ()
  });
});

wireButtons();
setPositionInputsFromCamera();
setDirectionInputsFromCamera();
updateStatus();

function wireButtons() {
  document.getElementById('fit').addEventListener('click', function() {
    flyToGraphBounds();
  });

  document.getElementById('bookmark').addEventListener('click', flyToCurrentNode);
  document.getElementById('goToPosition').addEventListener('click', flyToTypedPosition);
  document.getElementById('useCurrentPosition').addEventListener('click', function() {
    setPositionInputsFromCamera();
    updateStatus();
  });
  document.getElementById('useCurrentDirection').addEventListener('click', function() {
    setDirectionInputsFromCamera();
    updateStatus();
  });

  document.getElementById('next').addEventListener('click', function() {
    currentNodeIndex = (currentNodeIndex + 1) % nodeIds.length;
    flyToCurrentNode();
  });

  document.getElementById('top').addEventListener('click', function() {
    var sphere = renderer.nodeView().getBoundingSphere();
    renderer.flyToPosition({
      center: sphere.center,
      planeNormal: { x: 0, y: 0, z: 1 },
      finalZ: getTargetZ(),
      radius: Math.max(120, sphere.radius)
    }, {
      durationMs: getTransitionDuration()
    });
  });

  document.getElementById('speed').addEventListener('input', function(e) {
    var baseSpeed = parseFloat(e.target.value);
    renderer.setMovementSpeed(function(camera) {
      var speed = baseSpeed + camera.position.z * 0.25;
      if (speed < 30) return 30;
      return speed;
    });
    updateStatus();
  });

  document.getElementById('depth').addEventListener('input', function() {
    updateStatus();
  });

  document.getElementById('transitionMs').addEventListener('input', function() {
    updateStatus();
  });
}

function flyToCurrentNode() {
  var nodeId = nodeIds[currentNodeIndex];
  renderer.showNode(nodeId, 120, {
    durationMs: getTransitionDuration(),
    planeNormal: {x: 0, y: 0, z: 1},
    finalZ: getTargetZ()
  });
}

function flyToGraphBounds() {
  var sphere = renderer.nodeView().getBoundingSphere();
  renderer.flyToPosition({
    center: sphere.center,
    planeNormal: {x: 0, y: 0, z: 1},
    finalZ: getTargetZ(),
    radius: Math.max(100, sphere.radius)
  }, {
    durationMs: getTransitionDuration()
  });
}

function flyToTypedPosition() {
  var x = parseFloat(targetX.value);
  var y = parseFloat(targetY.value);
  var z = parseFloat(targetZ.value);
  var dx = parseFloat(targetDx.value);
  var dy = parseFloat(targetDy.value);
  var dz = parseFloat(targetDz.value);
  if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return;
  if (!isFinite(dx) || !isFinite(dy) || !isFinite(dz)) return;
  if (dx === 0 && dy === 0 && dz === 0) return;

  renderer.flyCameraTo({
    position: { x: x, y: y, z: z },
    direction: { x: dx, y: dy, z: dz }
  }, {
    durationMs: getTransitionDuration()
  });
}

function setPositionInputsFromCamera() {
  var camera = renderer.camera();
  targetX.value = camera.position.x.toFixed(1);
  targetY.value = camera.position.y.toFixed(1);
  targetZ.value = camera.position.z.toFixed(1);
}

function setDirectionInputsFromCamera() {
  var direction = renderer.camera().getWorldDirection(new THREE.Vector3());
  targetDx.value = direction.x.toFixed(4);
  targetDy.value = direction.y.toFixed(4);
  targetDz.value = direction.z.toFixed(4);
}

function clampCameraZ(camera) {
  if (camera.position.z < 0) {
    camera.position.z = 0;
  }
}

function speedFromZ(camera) {
  var speed = 80 + camera.position.z * 0.25;
  if (speed < 30) return 30;
  return speed;
}

function updateStatus() {
  var camera = renderer.camera();
  var direction = camera.getWorldDirection(new THREE.Vector3());
  var lookAt = {
    x: camera.position.x + direction.x,
    y: camera.position.y + direction.y,
    z: camera.position.z + direction.z
  };
  var speedValue = document.getElementById('speed').value;
  var depthValue = document.getElementById('depth').value;
  var transitionValue = document.getElementById('transitionMs').value;
  var targetDirection = '(' + targetDx.value + ', ' + targetDy.value + ', ' + targetDz.value + ')';
  statusLine.textContent = [
    'position: (' + camera.position.x.toFixed(3) + ', ' + camera.position.y.toFixed(3) + ', ' + camera.position.z.toFixed(3) + ')',
    'direction: (' + direction.x.toFixed(6) + ', ' + direction.y.toFixed(6) + ', ' + direction.z.toFixed(6) + ')',
    'lookAt: (' + lookAt.x.toFixed(3) + ', ' + lookAt.y.toFixed(3) + ', ' + lookAt.z.toFixed(3) + ')',
    'up: (' + camera.up.x.toFixed(3) + ', ' + camera.up.y.toFixed(3) + ', ' + camera.up.z.toFixed(3) + ')',
    'projection: fov=' + camera.fov.toFixed(2) + ' aspect=' + camera.aspect.toFixed(4) +
      ' near=' + camera.near.toFixed(3) + ' far=' + camera.far.toFixed(1),
    'bookmark: ' + nodeIds[currentNodeIndex],
    'target z: ' + depthValue,
    'typed target direction: ' + targetDirection,
    'transition ms: ' + transitionValue,
    'speed base: ' + speedValue,
    'z clamp: enabled (z >= 0)'
  ].join('\n');
}

function getTargetZ() {
  return parseFloat(document.getElementById('depth').value);
}

function getTransitionDuration() {
  var duration = parseFloat(document.getElementById('transitionMs').value);
  if (!isFinite(duration) || duration < 0) return 800;
  return duration;
}

function getGraphFromQueryString(query) {
  var graphGenerators = require('ngraph.generators');
  var createGraph = graphGenerators[query.graph] || graphGenerators.grid;
  return createGraph(getNumber(query.n), getNumber(query.m), getNumber(query.k));
}

function getNumber(string, defaultValue) {
  var number = parseFloat(string);
  return (typeof number === 'number') && !isNaN(number) ? number : (defaultValue || 10);
}
