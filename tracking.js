const elements = {
  video: document.getElementById("video"),
  canvas: document.getElementById("canvas"),
  message: document.getElementById("message"),
  baselineAdjust: document.getElementById("baselineAdjust"),
  jumpThreshold: document.getElementById("jumpThreshold"),
  crouchThreshold: document.getElementById("crouchThreshold"),
  startButton: document.getElementById("startButton"),
};
const ctx = elements.canvas.getContext("2d");

const state = {
  mode: "idle",
  countdown: 5,
  jumpCount: 0,
  crouchCount: 0,
  lastActionTime: 0,
  actionCooldown: 300,
  baseline: { hipY: 0, kneeY: 0 },
  current: { hipY: 0, kneeY: 0 },
  previous: { hipY: 0, kneeY: 0 },
  velocity: { hipY: 0 },
  crouchStartTime: null,
  jumpTakeoffTime: null,
  calibrationFrames: 0,
  lastTimestamp: 0,
  hasJumped: false,
  hasCrouched: false,
  isCrouching: false,
  isCalibrated: false,
  debug: {
    baselineHipY: 0,
    currentHipY: 0,
    velocityHipY: 0,
    jumpThreshold: 0,
    crouchThreshold: 0,
  },
};

const SKELETON_CONNECTIONS = [
  ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_elbow"],
  ["right_shoulder", "right_elbow"],
  ["left_elbow", "left_wrist"],
  ["right_elbow", "right_wrist"],
  ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"],
  ["left_hip", "left_knee"],
  ["right_hip", "right_knee"],
  ["left_knee", "left_ankle"],
  ["right_knee", "right_ankle"],
];
const MIN_CONFIDENCE = 0.3;
const CALIBRATION_FRAMES = 30;
const MIN_CROUCH_HOLD = 100;
const DEBUG_MODE = true;

function getVelocity(current, previous, timeDelta) {
  if (!timeDelta || timeDelta <= 0) return 0;
  return (current - previous) / (timeDelta / 1000);
}

async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
    });
    elements.video.srcObject = stream;

    return new Promise((resolve) => {
      elements.video.onloadedmetadata = () => {
        elements.canvas.width = elements.video.videoWidth;
        elements.canvas.height = elements.video.videoHeight;
        resolve();
      };
    });
  } catch (error) {
    console.error("Error accessing camera:", error);
    throw error;
  }
}

async function loadModel() {
  try {
    return await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
    );
  } catch (error) {
    console.error("Error loading model:", error);
    throw error;
  }
}

function drawSkeleton(keypoints) {
  ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);

  ctx.strokeStyle = "green";
  ctx.lineWidth = 2;
  SKELETON_CONNECTIONS.forEach(([key1, key2]) => {
    const p1 = keypoints.find((k) => k.name === key1);
    const p2 = keypoints.find((k) => k.name === key2);
    if (p1?.score > MIN_CONFIDENCE && p2?.score > MIN_CONFIDENCE) {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  });

  keypoints.forEach((k) => {
    if (k.score > MIN_CONFIDENCE) {
      ctx.beginPath();
      ctx.arc(k.x, k.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "red";
      ctx.fill();
    }
  });

  if (
    (state.mode === "standby" ||
      state.mode === "jumping" ||
      state.mode === "crouching") &&
    state.isCalibrated
  ) {
    const baselineAdjust = parseInt(elements.baselineAdjust.value);
    const jumpThreshold = parseInt(elements.jumpThreshold.value);
    const crouchThreshold = parseInt(elements.crouchThreshold.value);

    ctx.beginPath();
    ctx.strokeStyle = "blue";
    ctx.setLineDash([5, 5]);
    ctx.moveTo(0, state.baseline.hipY + baselineAdjust);
    ctx.lineTo(elements.canvas.width, state.baseline.hipY + baselineAdjust);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = "green";
    ctx.moveTo(0, state.baseline.hipY + baselineAdjust - jumpThreshold);
    ctx.lineTo(
      elements.canvas.width,
      state.baseline.hipY + baselineAdjust - jumpThreshold
    );
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = "purple";
    ctx.moveTo(0, state.baseline.hipY + baselineAdjust + crouchThreshold);
    ctx.lineTo(
      elements.canvas.width,
      state.baseline.hipY + baselineAdjust + crouchThreshold
    );
    ctx.stroke();

    ctx.setLineDash([]);
  }
}

function showMessage(text, color = "black", persist = false) {
  elements.message.textContent = text;
  elements.message.style.color = color;
  if (!persist) {
    setTimeout(() => {
      if (!state.isCrouching) {
        elements.message.textContent = "";
      }
    }, 800);
  }
}

function updatePositions(keypoints, timestamp) {
  const leftHip = keypoints.find((k) => k.name === "left_hip");
  const rightHip = keypoints.find((k) => k.name === "right_hip");
  const leftKnee = keypoints.find((k) => k.name === "left_knee");
  const rightKnee = keypoints.find((k) => k.name === "right_knee");

  if (
    !leftHip?.score ||
    !rightHip?.score ||
    !leftKnee?.score ||
    !rightKnee?.score ||
    leftHip.score < MIN_CONFIDENCE ||
    rightHip.score < MIN_CONFIDENCE ||
    leftKnee.score < MIN_CONFIDENCE ||
    rightKnee.score < MIN_CONFIDENCE
  ) {
    return false;
  }

  state.previous.hipY = state.current.hipY;
  state.previous.kneeY = state.current.kneeY;

  const hipY = (leftHip.y + rightHip.y) / 2;
  const kneeY = (leftKnee.y + rightKnee.y) / 2;

  state.current.hipY = hipY;
  state.current.kneeY = kneeY;

  const timeDelta = timestamp - state.lastTimestamp;
  if (state.lastTimestamp > 0 && timeDelta > 0) {
    state.velocity.hipY = getVelocity(hipY, state.previous.hipY, timeDelta);
  }

  state.lastTimestamp = timestamp;

  state.debug.currentHipY = state.current.hipY;
  state.debug.velocityHipY = state.velocity.hipY;

  return true;
}

function detectCrouch(timestamp) {
  const baselineAdjust = parseInt(elements.baselineAdjust.value);
  const crouchThreshold = parseInt(elements.crouchThreshold.value);

  state.debug.crouchThreshold = crouchThreshold;

  if (state.mode === "standby") {
    if (
      state.current.hipY >
        state.baseline.hipY + baselineAdjust + crouchThreshold &&
      !state.hasCrouched
    ) {
      state.mode = "crouching";
      state.crouchStartTime = timestamp;
      state.hasCrouched = true;
      state.isCrouching = true;
      showMessage("CROUCH!", "#9C27B0", true);
      crouch(true);
    }
  } else if (state.mode === "crouching") {
    if (
      state.current.hipY <
      state.baseline.hipY + baselineAdjust + crouchThreshold / 2
    ) {
      if (timestamp - state.crouchStartTime >= MIN_CROUCH_HOLD) {
        state.crouchCount++;
        state.lastActionTime = timestamp;
      }
      state.mode = "standby";
      state.isCrouching = false;
      crouch(false);
      elements.message.textContent = "";
      setTimeout(() => {
        state.hasCrouched = false;
      }, state.actionCooldown);
    }
  }
}

function detectJump(timestamp) {
  const baselineAdjust = parseInt(elements.baselineAdjust.value);
  const jumpThreshold = parseInt(elements.jumpThreshold.value);
  state.debug.jumpThreshold = jumpThreshold;

  if (state.mode === "standby" && !state.hasJumped) {
    if (
      state.current.hipY <
      state.baseline.hipY + baselineAdjust - jumpThreshold
    ) {
      state.mode = "jumping";
      state.jumpTakeoffTime = timestamp;
      state.hasJumped = true;
      jump();
    }
  } else if (state.mode === "jumping") {
    if (
      state.current.hipY >
      state.baseline.hipY + baselineAdjust - jumpThreshold / 2
    ) {
      state.jumpCount++;
      state.lastActionTime = timestamp;
      showMessage("JUMP!", "#4CAF50");
      state.mode = "standby";
      setTimeout(() => {
        state.hasJumped = false;
      }, state.actionCooldown);
    }
  }
}

async function detectPose(detector) {
  if (state.mode === "idle") {
    requestAnimationFrame(() => detectPose(detector));
    return;
  }

  try {
    const poses = await detector.estimatePoses(elements.video);

    if (poses.length === 0) {
      requestAnimationFrame(() => detectPose(detector));
      return;
    }

    const keypoints = poses[0].keypoints;
    drawSkeleton(keypoints);

    const timestamp = Date.now();

    if (!updatePositions(keypoints, timestamp)) {
      requestAnimationFrame(() => detectPose(detector));
      return;
    }

    if (state.mode === "calibrating") {
      calibrate();
    } else if (state.isCalibrated && state.mode !== "countdown") {
      detectCrouch(timestamp);
      detectJump(timestamp);
    }

    requestAnimationFrame(() => detectPose(detector));
  } catch (error) {
    console.error("Error in pose detection:", error);
    requestAnimationFrame(() => detectPose(detector));
  }
}

function calibrate() {
  if (state.calibrationFrames === 0) {
    state.baseline.hipY = state.current.hipY;
    state.baseline.kneeY = state.current.kneeY;
  } else {
    state.baseline.hipY =
      (state.baseline.hipY * state.calibrationFrames + state.current.hipY) /
      (state.calibrationFrames + 1);
    state.baseline.kneeY =
      (state.baseline.kneeY * state.calibrationFrames + state.current.kneeY) /
      (state.calibrationFrames + 1);
  }

  state.calibrationFrames++;
  state.debug.baselineHipY = state.baseline.hipY;

  if (state.calibrationFrames >= CALIBRATION_FRAMES) {
    state.mode = "standby";
    state.isCalibrated = true;
    state.hasJumped = false;
    state.hasCrouched = false;
    showMessage("GO!", "#FF9800");
  }
}

function startCountdown() {
  elements.baselineAdjust.disabled = true;
  elements.jumpThreshold.disabled = true;
  elements.crouchThreshold.disabled = true;

  if (state.isCalibrated) {
    state.mode = "standby";
    showMessage("GO!", "#FF9800");
    return;
  }

  state.countdown = 5;
  state.mode = "countdown";
  showMessage(`Get ready: ${state.countdown}`);

  const countdownInterval = setInterval(() => {
    state.countdown--;
    showMessage(`Get ready: ${state.countdown}`);

    if (state.countdown <= 0) {
      clearInterval(countdownInterval);
      state.mode = "calibrating";
      state.calibrationFrames = 0;
    }
  }, 1000);
}

function manualCalibrate() {
  state.mode = "calibrating";
  state.calibrationFrames = 0;
  showMessage("Calibrating...");
}

function resetApp() {
  state.jumpCount = 0;
  state.crouchCount = 0;
  state.lastActionTime = 0;
  state.hasJumped = false;
  state.hasCrouched = false;
  state.isCrouching = false;
  elements.baselineAdjust.disabled = false;
  elements.jumpThreshold.disabled = false;
  elements.crouchThreshold.disabled = false;
  elements.message.textContent = "";
}

async function init() {
  try {
    elements.startButton.addEventListener("click", () => {
      resetApp();
      startCountdown();
    });

    await setupCamera();
    const detector = await loadModel();

    state.mode = "calibrating";
    state.calibrationFrames = 0;
    showMessage("Calibrating...");
    manualCalibrate();

    detectPose(detector);
  } catch (error) {
    console.error("Initialization error:", error);
  }
}

init();
