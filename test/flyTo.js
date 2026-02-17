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

test('plane normal enforces view direction and +normal side', function(t) {
  var camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(100, 50, 10);

  var pose = flyTo.resolveFramePose(camera, {
    center: {x: 1, y: 2, z: 3},
    planeNormal: {x: 0, y: 0, z: 1},
    distanceAlongNormal: 150
  });

  t.equal(pose.position.x, 1, 'camera x aligned with center on +normal offset');
  t.equal(pose.position.y, 2, 'camera y aligned with center on +normal offset');
  t.equal(pose.position.z, 153, 'camera moved to +normal side');
  t.equal(pose.lookAt.z - pose.position.z, -150, 'look direction is opposite normal');
  t.end();
});

test('finalZ sets z and has precedence over distanceAlongNormal', function(t) {
  var camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(0, 0, 200);

  var pose = flyTo.resolveFramePose(camera, {
    center: {x: 5, y: 6, z: 10},
    planeNormal: {x: 0, y: 0, z: 1},
    distanceAlongNormal: 400,
    finalZ: 80
  });

  t.equal(pose.position.z, 80, 'finalZ wins over distanceAlongNormal');
  t.equal(pose.position.x, 5, 'x remains centered on XY plane normal');
  t.equal(pose.position.y, 6, 'y remains centered on XY plane normal');
  t.end();
});

test('finalZ works for non-XY plane with non-zero z in normal', function(t) {
  var camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(0, 0, 100);

  var center = {x: 0, y: 0, z: 0};
  var normal = {x: 0, y: Math.sqrt(3) / 2, z: 0.5}; // already unit
  var pose = flyTo.resolveFramePose(camera, {
    center: center,
    planeNormal: normal,
    finalZ: 50
  });

  t.ok(Math.abs(pose.position.z - 50) < 1e-8, 'finalZ is matched');
  t.ok(pose.position.y > 0, 'camera stayed on +normal side');
  t.end();
});

test('radius used when planeNormal exists but no depth fields', function(t) {
  var camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(0, 0, 10);

  var pose = flyTo.resolveFramePose(camera, {
    center: {x: 0, y: 0, z: 0},
    planeNormal: {x: 0, y: 0, z: 1},
    radius: 100
  });
  var expectedOffset = 100 / Math.tan(Math.PI / 180.0 * camera.fov * 0.5);

  t.ok(Math.abs(pose.position.z - expectedOffset) < 1e-8, 'radius fallback used along +normal');
  t.end();
});

test('validation errors for invalid plane-locked inputs', function(t) {
  var camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(0, 0, 100);

  t.throws(function() {
    flyTo.resolveFramePose(camera, {
      center: {x: 0, y: 0, z: 0},
      planeNormal: {x: 0, y: 0, z: 0},
      distanceAlongNormal: 10
    });
  }, /non-zero length/, 'zero-length normal rejected');

  t.throws(function() {
    flyTo.resolveFramePose(camera, {
      center: {x: 0, y: 0, z: 0},
      planeNormal: {x: 1, y: 0, z: 0},
      finalZ: 10
    });
  }, /non-zero/, 'finalZ with near-zero normal.z rejected');

  t.throws(function() {
    flyTo.resolveFramePose(camera, {
      center: {x: 0, y: 0, z: 10},
      planeNormal: {x: 0, y: 0, z: 1},
      finalZ: 0
    });
  }, /negative normal side/, 'finalZ that flips side rejected');

  t.throws(function() {
    flyTo.resolveFramePose(camera, {
      center: {x: 0, y: 0, z: 0},
      planeNormal: {x: 0, y: 0, z: 1},
      distanceAlongNormal: -1
    });
  }, /non-negative/, 'negative distanceAlongNormal rejected');

  t.end();
});

test('resolveCameraStatePose supports direction-based target', function(t) {
  var camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(0, 0, 100);
  camera.lookAt(new THREE.Vector3(0, 0, 0));

  var pose = flyTo.resolveCameraStatePose(camera, {
    position: {x: 10, y: 20, z: 30},
    direction: {x: 0, y: 0, z: -2}
  });

  t.equal(pose.position.x, 10, 'position x is used');
  t.equal(pose.position.y, 20, 'position y is used');
  t.equal(pose.position.z, 30, 'position z is used');
  t.equal(pose.lookAt.x, 10, 'lookAt x comes from normalized direction');
  t.equal(pose.lookAt.y, 20, 'lookAt y comes from normalized direction');
  t.equal(pose.lookAt.z, 29, 'lookAt z comes from normalized direction');
  t.end();
});

test('resolveCameraStatePose supports explicit lookAt and preserves direction by default', function(t) {
  var camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(0, 0, 100);
  camera.lookAt(new THREE.Vector3(0, 0, 0));

  var explicit = flyTo.resolveCameraStatePose(camera, {
    position: {x: 1, y: 2, z: 3},
    lookAt: {x: 4, y: 5, z: 6}
  });
  t.equal(explicit.lookAt.x, 4, 'explicit lookAt x is used');
  t.equal(explicit.lookAt.y, 5, 'explicit lookAt y is used');
  t.equal(explicit.lookAt.z, 6, 'explicit lookAt z is used');

  var preserved = flyTo.resolveCameraStatePose(camera, {
    position: {x: 7, y: 8, z: 9}
  });
  t.equal(preserved.lookAt.x, 7, 'default keeps current direction x');
  t.equal(preserved.lookAt.y, 8, 'default keeps current direction y');
  t.equal(preserved.lookAt.z, 8, 'default keeps current direction z');
  t.end();
});

test('createTransitionToCameraState reaches target state', function(t) {
  var camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(0, 0, 100);
  camera.lookAt(new THREE.Vector3(0, 0, 0));

  var transition = flyTo.createTransitionToCameraState(camera, {
    position: {x: 50, y: 60, z: 70},
    lookAt: {x: 10, y: 20, z: 30}
  }, {
    durationMs: 200,
    easing: 'linear'
  }, 1000);

  var done = flyTo.stepTransition(camera, transition, 1200);
  t.equal(done, true, 'transition is complete');
  t.equal(camera.position.x, 50, 'x reached target');
  t.equal(camera.position.y, 60, 'y reached target');
  t.equal(camera.position.z, 70, 'z reached target');

  var direction = camera.getWorldDirection(new THREE.Vector3());
  var expectedDirection = new THREE.Vector3(10 - 50, 20 - 60, 30 - 70).normalize();
  t.ok(Math.abs(direction.x - expectedDirection.x) < 1e-7, 'direction x reached target');
  t.ok(Math.abs(direction.y - expectedDirection.y) < 1e-7, 'direction y reached target');
  t.ok(Math.abs(direction.z - expectedDirection.z) < 1e-7, 'direction z reached target');
  t.end();
});

test('resolveCameraStatePose validates inputs', function(t) {
  var camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(0, 0, 100);

  t.throws(function() {
    flyTo.resolveCameraStatePose(camera, {});
  }, /position/, 'position is required');

  t.throws(function() {
    flyTo.resolveCameraStatePose(camera, {
      position: {x: 0, y: 0, z: 0},
      direction: {x: 0, y: 0, z: 0}
    });
  }, /non-zero/, 'zero direction is rejected');

  t.end();
});
