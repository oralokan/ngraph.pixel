var query = require('query-string').parse(window.location.search.substring(1));
var renderGraph = require('../..');
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

renderer.on('camerachanged', updateStatus);
renderer.on('nodeclick', function(node) {
  if (!node) return;
  currentNodeIndex = nodeIds.indexOf(node.id);
  if (currentNodeIndex < 0) currentNodeIndex = 0;
  renderer.showNode(node.id, 120);
});

wireButtons();
updateStatus();

function wireButtons() {
  document.getElementById('fit').addEventListener('click', function() {
    flyToGraphBounds();
  });

  document.getElementById('bookmark').addEventListener('click', flyToCurrentNode);

  document.getElementById('next').addEventListener('click', function() {
    currentNodeIndex = (currentNodeIndex + 1) % nodeIds.length;
    flyToCurrentNode();
  });

  document.getElementById('top').addEventListener('click', function() {
    var sphere = renderer.nodeView().getBoundingSphere();
    renderer.flyToPosition({
      center: sphere.center,
      radius: Math.max(120, sphere.radius),
      direction: { x: 0, y: 0, z: 1 }
    }, {
      durationMs: 800
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
}

function flyToCurrentNode() {
  var nodeId = nodeIds[currentNodeIndex];
  renderer.showNode(nodeId, 120);
}

function flyToGraphBounds() {
  var sphere = renderer.nodeView().getBoundingSphere();
  renderer.flyToPosition({
    center: sphere.center,
    radius: Math.max(100, sphere.radius)
  }, {
    durationMs: 800
  });
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
  var speedValue = document.getElementById('speed').value;
  statusLine.textContent = [
    'camera: (' + camera.position.x.toFixed(1) + ', ' + camera.position.y.toFixed(1) + ', ' + camera.position.z.toFixed(1) + ')',
    'bookmark: ' + nodeIds[currentNodeIndex],
    'speed base: ' + speedValue,
    'z clamp: enabled (z >= 0)'
  ].join(' | ');
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
