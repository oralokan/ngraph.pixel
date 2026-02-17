/**
 * Camera framing helpers for instant and animated camera movement.
 */
var THREE = require('three');
var EPSILON = 1e-8;

module.exports = flyTo;
module.exports.resolveFramePose = resolveFramePose;
module.exports.applyPose = applyPose;
module.exports.createTransition = createTransition;
module.exports.createTransitionToCameraState = createTransitionToCameraState;
module.exports.stepTransition = stepTransition;
module.exports.resolveEasing = resolveEasing;
module.exports.resolveCameraStatePose = resolveCameraStatePose;

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
  if (!isFiniteVector(center)) {
    throw new Error('frame.center should be a finite vector');
  }

  if (frame.planeNormal) {
    return resolvePlaneLockedPose(camera, frame, center);
  }

  var radius = frame.radius;
  if (typeof radius !== 'number' || radius <= 0) {
    throw new Error('frame.radius should be a positive number');
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

function resolvePlaneLockedPose(camera, frame, center) {
  var normal = normalizeVector(frame.planeNormal, 'frame.planeNormal');
  var distanceFromCenter = getDistanceFromPlaneNormalMode(camera, frame, center, normal);

  return {
    position: {
      x: center.x + normal.x * distanceFromCenter,
      y: center.y + normal.y * distanceFromCenter,
      z: center.z + normal.z * distanceFromCenter
    },
    lookAt: {
      x: center.x,
      y: center.y,
      z: center.z
    }
  };
}

function getDistanceFromPlaneNormalMode(camera, frame, center, normal) {
  if (typeof frame.finalZ === 'number') {
    if (!isFinite(frame.finalZ)) throw new Error('frame.finalZ should be a finite number');
    if (Math.abs(normal.z) < EPSILON) {
      throw new Error('frame.finalZ requires planeNormal.z to be non-zero');
    }

    var t = (frame.finalZ - center.z) / normal.z;
    if (!isFinite(t)) throw new Error('frame.finalZ produced invalid distance');
    if (t < 0) {
      throw new Error('frame.finalZ places camera on negative normal side');
    }
    return t;
  }

  if (typeof frame.distanceAlongNormal === 'number') {
    if (!isFinite(frame.distanceAlongNormal) || frame.distanceAlongNormal < 0) {
      throw new Error('frame.distanceAlongNormal should be a non-negative finite number');
    }
    return frame.distanceAlongNormal;
  }

  if (typeof frame.radius !== 'number' || frame.radius <= 0) {
    throw new Error('frame.radius should be positive when planeNormal depth is not provided');
  }
  return frame.radius / Math.tan(Math.PI / 180.0 * camera.fov * 0.5);
}

function applyPose(camera, pose) {
  camera.position.x = pose.position.x;
  camera.position.y = pose.position.y;
  camera.position.z = pose.position.z;
  camera.lookAt(new THREE.Vector3(pose.lookAt.x, pose.lookAt.y, pose.lookAt.z));
}

function createTransition(camera, frame, options, now) {
  var targetPose = resolveFramePose(camera, frame);
  return createTransitionWithPose(camera, targetPose, options, now);
}

function createTransitionToCameraState(camera, cameraState, options, now) {
  var targetPose = resolveCameraStatePose(camera, cameraState);
  return createTransitionWithPose(camera, targetPose, options, now);
}

function createTransitionWithPose(camera, targetPose, options, now) {
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

function resolveCameraStatePose(camera, cameraState) {
  if (!cameraState || !isFiniteVector(cameraState.position)) {
    throw new Error('cameraState.position should be a finite vector');
  }

  var targetPosition = {
    x: cameraState.position.x,
    y: cameraState.position.y,
    z: cameraState.position.z
  };

  var targetLookAt;
  if (cameraState.lookAt) {
    if (!isFiniteVector(cameraState.lookAt)) {
      throw new Error('cameraState.lookAt should be a finite vector');
    }
    targetLookAt = {
      x: cameraState.lookAt.x,
      y: cameraState.lookAt.y,
      z: cameraState.lookAt.z
    };
  } else if (cameraState.direction) {
    var normalizedDirection = normalizeVector(cameraState.direction, 'cameraState.direction');
    targetLookAt = {
      x: targetPosition.x + normalizedDirection.x,
      y: targetPosition.y + normalizedDirection.y,
      z: targetPosition.z + normalizedDirection.z
    };
  } else {
    // If no direction is provided, preserve current camera orientation.
    var currentDirection = camera.getWorldDirection(new THREE.Vector3());
    targetLookAt = {
      x: targetPosition.x + currentDirection.x,
      y: targetPosition.y + currentDirection.y,
      z: targetPosition.z + currentDirection.z
    };
  }

  return {
    position: targetPosition,
    lookAt: targetLookAt
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

function normalizeVector(vector, name) {
  if (!isFiniteVector(vector)) {
    throw new Error(name + ' should be a finite vector');
  }

  var length = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
  if (length < EPSILON) {
    throw new Error(name + ' should have non-zero length');
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length
  };
}

function isFiniteVector(vector) {
  return !!vector &&
    isFinite(vector.x) &&
    isFinite(vector.y) &&
    isFinite(vector.z);
}
