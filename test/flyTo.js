var test = require('tap').test;
var THREE = require('three');
var flyTo = require('../lib/flyTo.js');

test('resolveFramePose keeps camera at expected frame distance', function(t) {
  var camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(0, 0, 200);

  var pose = flyTo.resolveFramePose(camera, {
    center: {x: 0, y: 0, z: 0},
    radius: 100
  });
  var expectedOffset = 100 / Math.tan(Math.PI / 180.0 * camera.fov * 0.5);
  var dx = pose.position.x - pose.lookAt.x;
  var dy = pose.position.y - pose.lookAt.y;
  var dz = pose.position.z - pose.lookAt.z;
  var actualOffset = Math.sqrt(dx * dx + dy * dy + dz * dz);

  t.ok(Math.abs(actualOffset - expectedOffset) < 1e-8, 'camera offset matches fov framing math');
  t.end();
});

test('resolveFramePose honors explicit direction', function(t) {
  var camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(10, 0, 0);

  var pose = flyTo.resolveFramePose(camera, {
    center: {x: 1, y: 2, z: 3},
    radius: 50,
    direction: {x: 0, y: 0, z: 1}
  });

  t.equal(pose.position.x, 1, 'x uses provided direction');
  t.equal(pose.position.y, 2, 'y uses provided direction');
  t.ok(pose.position.z > 3, 'z moves in provided direction');
  t.end();
});

test('stepTransition reaches exact target pose', function(t) {
  var camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(0, 0, 300);
  camera.lookAt(new THREE.Vector3(0, 0, 0));

  var transition = flyTo.createTransition(camera, {
    center: {x: 10, y: 20, z: 30},
    radius: 40
  }, {
    durationMs: 100,
    easing: 'linear'
  }, 1000);

  var done = flyTo.stepTransition(camera, transition, 1100);
  var targetPose = flyTo.resolveFramePose(camera, {
    center: {x: 10, y: 20, z: 30},
    radius: 40
  });

  t.equal(done, true, 'transition reports completion');
  t.ok(Math.abs(camera.position.x - targetPose.position.x) < 1e-8, 'x ends at target');
  t.ok(Math.abs(camera.position.y - targetPose.position.y) < 1e-8, 'y ends at target');
  t.ok(Math.abs(camera.position.z - targetPose.position.z) < 1e-8, 'z ends at target');
  t.end();
});
