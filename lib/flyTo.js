/**
 * Camera framing helpers for instant and animated camera movement.
 */
var THREE = require('three');

module.exports = flyTo;
module.exports.resolveFramePose = resolveFramePose;
module.exports.applyPose = applyPose;
module.exports.createTransition = createTransition;
module.exports.stepTransition = stepTransition;
module.exports.resolveEasing = resolveEasing;

function flyTo(camera, to, radius, direction) {
  var pose = resolveFramePose(camera, {
    center: to,
    radius: radius,
    direction: direction
  });

  applyPose(camera, pose);
  return pose;
}

function resolveFramePose(camera, frame) {
  var center = frame.center;
  var radius = frame.radius;
  if (!center || typeof radius !== 'number' || radius <= 0) {
    throw new Error('frame.center and positive frame.radius are required');
  }

  var offset = radius / Math.tan(Math.PI / 180.0 * camera.fov * 0.5);
  var direction = getDirectionVector(camera, center, frame.direction);
  var cameraPosition = {
    x: center.x + direction.x * offset,
    y: center.y + direction.y * offset,
    z: center.z + direction.z * offset
  };

  return {
    position: cameraPosition,
    lookAt: {
      x: center.x,
      y: center.y,
      z: center.z
    }
  };
}

function applyPose(camera, pose) {
  camera.position.x = pose.position.x;
  camera.position.y = pose.position.y;
  camera.position.z = pose.position.z;
  camera.lookAt(new THREE.Vector3(pose.lookAt.x, pose.lookAt.y, pose.lookAt.z));
}

function createTransition(camera, frame, options, now) {
  var targetPose = resolveFramePose(camera, frame);
  var startDirection = camera.getWorldDirection(new THREE.Vector3());
  var startLookAt = {
    x: camera.position.x + startDirection.x,
    y: camera.position.y + startDirection.y,
    z: camera.position.z + startDirection.z
  };
  var durationMs = options && typeof options.durationMs === 'number' ? options.durationMs : 600;
  if (durationMs < 0) durationMs = 0;

  return {
    startPosition: {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z
    },
    targetPosition: targetPose.position,
    startLookAt: startLookAt,
    targetLookAt: targetPose.lookAt,
    startedAt: typeof now === 'number' ? now : Date.now(),
    durationMs: durationMs,
    easing: resolveEasing(options && options.easing)
  };
}

function stepTransition(camera, transition, now) {
  var elapsed = now - transition.startedAt;
  var progress = transition.durationMs === 0 ? 1 : elapsed / transition.durationMs;
  if (progress < 0) progress = 0;
  if (progress > 1) progress = 1;

  var eased = transition.easing(progress);
  camera.position.x = lerp(transition.startPosition.x, transition.targetPosition.x, eased);
  camera.position.y = lerp(transition.startPosition.y, transition.targetPosition.y, eased);
  camera.position.z = lerp(transition.startPosition.z, transition.targetPosition.z, eased);

  var lookAt = {
    x: lerp(transition.startLookAt.x, transition.targetLookAt.x, eased),
    y: lerp(transition.startLookAt.y, transition.targetLookAt.y, eased),
    z: lerp(transition.startLookAt.z, transition.targetLookAt.z, eased)
  };
  camera.lookAt(new THREE.Vector3(lookAt.x, lookAt.y, lookAt.z));
  return progress >= 1;
}

function resolveEasing(easing) {
  if (typeof easing === 'function') return easing;
  if (easing === 'linear') return linear;
  return easeInOutCubic;
}

function linear(t) {
  return t;
}

function easeInOutCubic(t) {
  if (t < 0.5) return 4 * t * t * t;
  return 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(from, to, t) {
  return from + (to - from) * t;
}

function getDirectionVector(camera, center, direction) {
  var x;
  var y;
  var z;

  if (direction) {
    x = direction.x;
    y = direction.y;
    z = direction.z;
  } else {
    x = camera.position.x - center.x;
    y = camera.position.y - center.y;
    z = camera.position.z - center.z;
  }

  var length = Math.sqrt(x * x + y * y + z * z);
  if (!isFinite(length) || length === 0) {
    return {x: 0, y: 0, z: 1};
  }

  return {
    x: x / length,
    y: y / length,
    z: z / length
  };
}
