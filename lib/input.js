var FlyControls = require('three.fly');
var eventify = require('ngraph.events');
var THREE = require('three');
var createHitTest = require('./hitTest.js');

module.exports = createInput;

function createInput(camera, graph, domElement, options) {
  options = options || {};
  var controls = new FlyControls(camera, domElement, THREE);
  var hitTest = createHitTest(domElement);
  // todo: this should all be based on graph size/options:
  var totalNodes = graph.getNodesCount();
  var defaultSpeed = Math.max(totalNodes * 0.1, 200);
  var movementSpeed = typeof options.movementSpeed === 'number' ? options.movementSpeed : defaultSpeed;
  var movementSpeedProvider = typeof options.movementSpeed === 'function' ? options.movementSpeed : null;
  var useAutoFitSpeed = typeof options.movementSpeed === 'undefined';

  controls.movementSpeed = movementSpeed;
  controls.rollSpeed = typeof options.rollSpeed === 'number' ? options.rollSpeed : 0.20;

  var keyMap = Object.create(null);
  var api = {
    update: update,
    onKey: onKey,
    reset: reset,
    adjustSpeed: adjustSpeed,
    syncHitTest: syncHitTest,
    setMovementSpeed: setMovementSpeed
  };

  eventify(api);

  hitTest.on('nodeover', passthrough('nodeover'));
  hitTest.on('nodeclick', passthrough('nodeclick'));
  hitTest.on('nodedblclick', passthrough('nodedblclick'));

  controls.on('move', inputChanged);
  domElement.addEventListener('keydown', globalKeyHandler, false);
  domElement.addEventListener('mousemove', globalMouseMove, false);

  return api;

  function adjustSpeed(sceneRadius) {
    if (!useAutoFitSpeed) return;
    controls.movementSpeed = sceneRadius * 0.1;
  }

  function update() {
    if (movementSpeedProvider) {
      var providerSpeed = movementSpeedProvider(camera);
      if (typeof providerSpeed === 'number' && isFinite(providerSpeed)) {
        controls.movementSpeed = providerSpeed;
      }
    }
    controls.update(0.1);
  }

  function passthrough(name) {
    return function(e) {
      api.fire(name, e);
    };
  }

  function inputChanged(moveArg) {
    api.fire('move', moveArg);
    updateHitTest();
  }

  function onKey(keyName, handler) {
    keyMap[keyName] = handler;
  }

  function globalKeyHandler(e) {
    var handler = keyMap[e.which];
    if (typeof handler === 'function') {
      handler(e);
    }
  }

  function globalMouseMove() {
    updateHitTest();
  }

  function syncHitTest(force) {
    updateHitTest(force);
  }

  function updateHitTest(force) {
    var scene = camera.parent;
    hitTest.update(scene, camera, force);
  }

  function reset() {
    hitTest.reset();
  }

  function setMovementSpeed(valueOrFn) {
    useAutoFitSpeed = false;
    if (typeof valueOrFn === 'function') {
      movementSpeedProvider = valueOrFn;
      return;
    }

    movementSpeedProvider = null;
    if (typeof valueOrFn === 'number' && isFinite(valueOrFn)) {
      movementSpeed = valueOrFn;
      controls.movementSpeed = movementSpeed;
    } else {
      throw new Error('movement speed should be a number or a function');
    }
  }
}
