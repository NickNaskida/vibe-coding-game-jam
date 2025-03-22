const elements = {
  video: document.getElementById("video"),
  canvas: document.getElementById("canvas"),
  message: document.getElementById("message"),
  baselineAdjust: document.getElementById("baselineAdjust"),
  jumpThreshold: document.getElementById("jumpThreshold"),
  crouchThreshold: document.getElementById("crouchThreshold"),
};
const ctx = elements.canvas.getContext("2d");

const state = {
  mode: "idle",
  countdown: 5,
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
  gestureStartTime: null,
  isGesturing: false,
  hasGestured: false, // Added to prevent repeated triggers
  gestureHoldDuration: 2000,
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
const DEBUG_MODE = false; // Changed to true for debugging

function getVelocity(current, previous, timeDelta) {
  if (!timeDelta || timeDelta <= 0) return 0;
  return (current - previous) / (timeDelta / 1000);
}

async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
    });
    elements.video.srcObject = stream;

    return new Promise((resolve) => {
      elements.video.onloadedmetadata = () => {
        elements.canvas.width = elements.video.videoWidth;
        elements.canvas.height = elements.video.videoHeight;
        elements.video.style.transform = "scaleX(-1)";
        elements.canvas.style.position = "absolute";
        elements.canvas.style.top = elements.video.offsetTop + "px";
        elements.canvas.style.left = elements.video.offsetLeft + "px";
        console.log(
          "Video dimensions:",
          elements.video.videoWidth,
          elements.video.videoHeight
        );
        console.log(
          "Canvas dimensions:",
          elements.canvas.width,
          elements.canvas.height
        );
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
      {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        enableSmoothing: true,
        minPoseScore: 0.25,
      }
    );
  } catch (error) {
    console.error("Error loading model:", error);
    throw error;
  }
}

function drawSkeleton(keypoints) {
  ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
  ctx.save();
  ctx.scale(-1, 1);
  ctx.translate(-elements.canvas.width, 0);

  const colors = {
    torso: "#00FF00",
    leftArm: "#FF00FF",
    rightArm: "#FFFF00",
    leftLeg: "#00FFFF",
    rightLeg: "#FF8000",
  };

  const connectionStyles = [
    { points: ["left_shoulder", "right_shoulder"], color: colors.torso },
    { points: ["left_shoulder", "left_elbow"], color: colors.leftArm },
    { points: ["right_shoulder", "right_elbow"], color: colors.rightArm },
    { points: ["left_elbow", "left_wrist"], color: colors.leftArm },
    { points: ["right_elbow", "right_wrist"], color: colors.rightArm },
    { points: ["left_shoulder", "left_hip"], color: colors.torso },
    { points: ["right_shoulder", "right_hip"], color: colors.torso },
    { points: ["left_hip", "right_hip"], color: colors.torso },
    { points: ["left_hip", "left_knee"], color: colors.leftLeg },
    { points: ["right_hip", "right_knee"], color: colors.rightLeg },
    { points: ["left_knee", "left_ankle"], color: colors.leftLeg },
    { points: ["right_knee", "right_ankle"], color: colors.rightLeg },
  ];

  ctx.beginPath();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 8;

  let validKeypoints = keypoints.filter((k) => k.score > MIN_CONFIDENCE);
  if (validKeypoints.length > 8) {
    const outline = getBodyOutline(validKeypoints);
    if (outline.length > 2) {
      ctx.beginPath();
      ctx.moveTo(outline[0].x, outline[0].y);
      for (let i = 1; i < outline.length; i++) {
        ctx.lineTo(outline[i].x, outline[i].y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  ctx.lineWidth = 5;
  connectionStyles.forEach(({ points: [key1, key2], color }) => {
    const p1 = keypoints.find((k) => k.name === key1);
    const p2 = keypoints.find((k) => k.name === key2);
    if (p1?.score > MIN_CONFIDENCE && p2?.score > MIN_CONFIDENCE) {
      const x1 = p1.x;
      const x2 = p2.x;
      ctx.strokeStyle =
        color +
        Math.floor(Math.min(p1.score, p2.score) * 255)
          .toString(16)
          .padStart(2, "0");
      ctx.beginPath();
      ctx.moveTo(x1, p1.y);
      ctx.lineTo(x2, p2.y);
      ctx.stroke();
    }
  });

  keypoints.forEach((k) => {
    if (k.score > MIN_CONFIDENCE) {
      const radius = 6 + (k.score - MIN_CONFIDENCE) * 7;
      const gradient = ctx.createRadialGradient(k.x, k.y, 0, k.x, k.y, radius);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.8)");
      ctx.beginPath();
      ctx.arc(k.x, k.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = gradient;
      ctx.fill();
      if (DEBUG_MODE) {
        ctx.font = "12px Arial";
        ctx.fillStyle = "white";
        ctx.fillText(k.name, k.x + 8, k.y - 2);
        ctx.fillText(`conf: ${k.score.toFixed(2)}`, k.x + 8, k.y + 12);
      }
    }
  });

  ctx.restore();

  if (state.isGesturing) {
    const holdTime = Date.now() - state.gestureStartTime;
    const progress = Math.min(holdTime / state.gestureHoldDuration, 1);
    ctx.beginPath();
    ctx.arc(
      elements.canvas.width - 50,
      50,
      20,
      -Math.PI / 2,
      -Math.PI / 2 + 2 * Math.PI * progress
    );
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#2196F3";
    ctx.stroke();
  }

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
    ctx.strokeStyle = "rgba(0, 0, 255, 0.7)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.moveTo(0, state.baseline.hipY + baselineAdjust);
    ctx.lineTo(elements.canvas.width, state.baseline.hipY + baselineAdjust);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = "rgba(0, 255, 0, 0.7)";
    ctx.moveTo(0, state.baseline.hipY + baselineAdjust - jumpThreshold);
    ctx.lineTo(
      elements.canvas.width,
      state.baseline.hipY + baselineAdjust - jumpThreshold
    );
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = "rgba(128, 0, 128, 0.7)";
    ctx.moveTo(0, state.baseline.hipY + baselineAdjust + crouchThreshold);
    ctx.lineTo(
      elements.canvas.width,
      state.baseline.hipY + baselineAdjust + crouchThreshold
    );
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.font = "16px Arial";
    ctx.fillStyle = "blue";
    ctx.fillText("Baseline", 10, state.baseline.hipY + baselineAdjust - 5);
    ctx.fillStyle = "green";
    ctx.fillText(
      "Jump",
      10,
      state.baseline.hipY + baselineAdjust - jumpThreshold - 5
    );
    ctx.fillStyle = "purple";
    ctx.fillText(
      "Crouch",
      10,
      state.baseline.hipY + baselineAdjust + crouchThreshold + 15
    );
  }

  if (DEBUG_MODE) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(10, 10, 180, 150); // Increased height for gesture info
    ctx.font = "12px monospace";
    ctx.fillStyle = "white";
    ctx.fillText(`Mode: ${state.mode}`, 15, 25);
    ctx.fillText(`Baseline Hip Y: ${state.baseline.hipY.toFixed(1)}`, 15, 40);
    ctx.fillText(`Current Hip Y: ${state.current.hipY.toFixed(1)}`, 15, 55);
    ctx.fillText(`Hip Velocity: ${state.velocity.hipY.toFixed(2)}`, 15, 70);
    ctx.fillText(`Jump Threshold: ${elements.jumpThreshold.value}px`, 15, 85);
    ctx.fillText(
      `Crouch Threshold: ${elements.crouchThreshold.value}px`,
      15,
      100
    );
    ctx.fillText(`Calibrated: ${state.isCalibrated ? "Yes" : "No"}`, 15, 115);
    ctx.fillText(
      `Gesturing: ${state.isGesturing ? "Hands-up" : "No"}`,
      15,
      130
    );
    if (state.isGesturing) {
      const holdTime = (Date.now() - state.gestureStartTime) / 1000;
      ctx.fillText(`Hold Time: ${holdTime.toFixed(1)}s`, 15, 145);
    }
  }
}

function getBodyOutline(keypoints) {
  const outline = [];
  const pointMap = {};
  keypoints.forEach((kp) => (pointMap[kp.name] = kp));
  const outlineOrder = [
    "left_ankle",
    "left_knee",
    "left_hip",
    "right_hip",
    "right_knee",
    "right_ankle",
    "right_hip",
    "right_shoulder",
    "right_elbow",
    "right_wrist",
    "right_elbow",
    "right_shoulder",
    "right_ear",
    "left_ear",
    "left_shoulder",
    "left_elbow",
    "left_wrist",
    "left_elbow",
    "left_shoulder",
    "left_hip",
  ];
  outlineOrder.forEach((name) => {
    if (pointMap[name] && pointMap[name].score > MIN_CONFIDENCE) {
      outline.push({ x: pointMap[name].x, y: pointMap[name].y });
    }
  });
  return outline;
}

function showMessage(text, color = "black", persist = false) {
  elements.message.textContent = text;
  elements.message.style.color = color;
  if (!persist) {
    setTimeout(() => {
      if (!state.isCrouching) elements.message.textContent = "";
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
    if (DEBUG_MODE && keypoints.length > 0) {
      console.log(
        "Low confidence in key points:",
        `leftHip: ${leftHip?.score?.toFixed(2) || "missing"}`,
        `rightHip: ${rightHip?.score?.toFixed(2) || "missing"}`,
        `leftKnee: ${leftKnee?.score?.toFixed(2) || "missing"}`,
        `rightKnee: ${rightKnee?.score?.toFixed(2) || "missing"}`
      );
    }
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

  if (state.mode === "standby" && !state.hasCrouched) {
    if (
      state.current.hipY >
      state.baseline.hipY + baselineAdjust + crouchThreshold
    ) {
      state.mode = "crouching";
      state.crouchStartTime = timestamp;
      state.hasCrouched = true;
      state.isCrouching = true;
      showMessage("CROUCH!", "#9C27B0", true);
      if (typeof crouch === "function") crouch(true);
    }
  } else if (state.mode === "crouching") {
    if (
      state.current.hipY <
      state.baseline.hipY + baselineAdjust + crouchThreshold / 2
    ) {
      if (timestamp - state.crouchStartTime >= MIN_CROUCH_HOLD) {
        state.lastActionTime = timestamp;
      }
      state.mode = "standby";
      state.isCrouching = false;
      if (typeof crouch === "function") crouch(false);
      elements.message.textContent = "";
      setTimeout(() => (state.hasCrouched = false), state.actionCooldown);
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
      if (typeof jump === "function") jump();
    }
  } else if (state.mode === "jumping") {
    if (
      state.current.hipY >
      state.baseline.hipY + baselineAdjust - jumpThreshold / 2
    ) {
      state.lastActionTime = timestamp;
      showMessage("JUMP!", "#4CAF50"); // Temporary message like this
      state.mode = "standby";
      setTimeout(() => (state.hasJumped = false), state.actionCooldown);
    }
  }
}

function detectGesture(keypoints, timestamp) {
  const leftShoulder = keypoints.find((k) => k.name === "left_shoulder");
  const rightShoulder = keypoints.find((k) => k.name === "right_shoulder");
  const leftWrist = keypoints.find((k) => k.name === "left_wrist");
  const rightWrist = keypoints.find((k) => k.name === "right_wrist");

  if (
    !leftShoulder?.score ||
    !rightShoulder?.score ||
    !leftWrist?.score ||
    !rightWrist?.score ||
    leftShoulder.score < MIN_CONFIDENCE ||
    rightShoulder.score < MIN_CONFIDENCE ||
    leftWrist.score < MIN_CONFIDENCE ||
    rightWrist.score < MIN_CONFIDENCE
  ) {
    if (DEBUG_MODE) {
      console.log(
        "Gesture detection failed due to low confidence:",
        `leftShoulder: ${leftShoulder?.score?.toFixed(2) || "missing"}`,
        `rightShoulder: ${rightShoulder?.score?.toFixed(2) || "missing"}`,
        `leftWrist: ${leftWrist?.score?.toFixed(2) || "missing"}`,
        `rightWrist: ${rightWrist?.score?.toFixed(2) || "missing"}`
      );
    }
    resetGestureState();
    return;
  }

  const isHandsUp =
    leftWrist.y < leftShoulder.y - 50 && // Reduced threshold from 100 to 50 for easier detection
    rightWrist.y < rightShoulder.y - 50 &&
    Math.abs(leftWrist.y - rightWrist.y) < 50;

  if (isHandsUp && !state.hasGestured) {
    if (!state.isGesturing) {
      state.isGesturing = true;
      state.gestureStartTime = timestamp;
      showMessage("Hold hands up...", "#2196F3", true);
      if (DEBUG_MODE) console.log("Hands-up gesture started");
    }

    const holdTime = timestamp - state.gestureStartTime;
    if (holdTime >= state.gestureHoldDuration) {
      state.hasGestured = true;
      state.lastActionTime = timestamp;
      showMessage("RESTART!", "#FF5722"); // Temporary message like jump/crouch
      resetApp();
      executeGestureAction();
      resetGestureState();
      setTimeout(() => (state.hasGestured = false), state.actionCooldown);
      if (DEBUG_MODE) console.log("Hands-up gesture completed");
    }
  } else if (!isHandsUp) {
    resetGestureState();
  }
}

function resetGestureState() {
  if (state.isGesturing) {
    state.isGesturing = false;
    state.gestureStartTime = null;
    elements.message.textContent = "";
    if (DEBUG_MODE) console.log("Gesture reset");
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

    if (state.isCalibrated) {
      detectGesture(keypoints, timestamp);
      detectCrouch(timestamp);
      detectJump(timestamp);
    }

    if (state.mode === "calibrating") {
      calibrate();
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
  state.lastActionTime = 0;
  state.hasJumped = false;
  state.hasCrouched = false;
  state.isCrouching = false;
  state.hasGestured = false;
  elements.baselineAdjust.disabled = false;
  elements.jumpThreshold.disabled = false;
  elements.crouchThreshold.disabled = false;
  elements.message.textContent = "";
}

if (typeof jump !== "function") {
  window.jump = function () {
    console.log("Jump action triggered");
  };
}

if (typeof crouch !== "function") {
  window.crouch = function (isCrouching) {
    console.log("Crouch action triggered:", isCrouching);
  };
}

async function init() {
  try {
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

document.body.insertAdjacentHTML(
  "afterbegin",
  '<div id="loadingMessage" style="position:absolute;top:10px;left:10px;background:rgba(0,0,0,0.7);color:white;padding:10px;z-index:100;border-radius:5px;">Loading pose detection...</div>'
);

init()
  .then(() => {
    const loadingMessage = document.getElementById("loadingMessage");
    if (loadingMessage) loadingMessage.remove();
  })
  .catch((error) => {
    console.error("Failed to initialize:", error);
    const loadingMessage = document.getElementById("loadingMessage");
    if (loadingMessage) {
      loadingMessage.textContent = "Error: " + error.message;
      loadingMessage.style.backgroundColor = "rgba(255,0,0,0.7)";
    }
  });
