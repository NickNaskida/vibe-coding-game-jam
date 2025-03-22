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
const DEBUG_MODE = false; // Set to true to see more debug info

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
        // Make canvas match video dimensions exactly
        elements.canvas.width = elements.video.videoWidth;
        elements.canvas.height = elements.video.videoHeight;

        // Add CSS to mirror the video and make canvas and video overlap perfectly
        elements.video.style.transform = "scaleX(-1)";

        // Set canvas to absolute position over video
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

  // Mirror the canvas to match the mirrored video
  ctx.save();
  ctx.scale(-1, 1);
  ctx.translate(-elements.canvas.width, 0);

  // Define colors for different body parts
  const colors = {
    torso: "#00FF00", // Green for torso
    leftArm: "#FF00FF", // Magenta for left arm
    rightArm: "#FFFF00", // Yellow for right arm
    leftLeg: "#00FFFF", // Cyan for left leg
    rightLeg: "#FF8000", // Orange for right leg
  };

  // Enhanced connection drawing with specific colors
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

  // Draw full body outline first
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 8;

  let validKeypoints = keypoints.filter((k) => k.score > MIN_CONFIDENCE);
  if (validKeypoints.length > 8) {
    // Only draw if we have enough valid points
    // Draw body outline
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

  // Draw connections
  ctx.lineWidth = 5; // Thicker lines for better visibility
  connectionStyles.forEach(({ points: [key1, key2], color }) => {
    const p1 = keypoints.find((k) => k.name === key1);
    const p2 = keypoints.find((k) => k.name === key2);
    if (p1?.score > MIN_CONFIDENCE && p2?.score > MIN_CONFIDENCE) {
      // Use direct coordinates since we're mirroring the entire canvas
      const x1 = p1.x;
      const x2 = p2.x;

      // Add slight transparency based on confidence
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

  // Draw keypoints with size based on confidence
  keypoints.forEach((k) => {
    if (k.score > MIN_CONFIDENCE) {
      const radius = 6 + (k.score - MIN_CONFIDENCE) * 7; // Larger radius for better visibility

      // Gradient fill for joints
      const gradient = ctx.createRadialGradient(k.x, k.y, 0, k.x, k.y, radius);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.8)");
      // gradient.addColorStop(1, "rgba(255, 0, 0, 0.2)");

      ctx.beginPath();
      ctx.arc(k.x, k.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Optional: Add keypoint labels in debug mode
      if (DEBUG_MODE) {
        ctx.font = "12px Arial";
        ctx.fillStyle = "white";
        ctx.fillText(k.name, k.x + 8, k.y - 2);
        ctx.fillText(`conf: ${k.score.toFixed(2)}`, k.x + 8, k.y + 12);
      }
    }
  });

  // Restore canvas transform before drawing overlay elements
  ctx.restore();

  // Draw threshold lines with no mirroring
  if (
    (state.mode === "standby" ||
      state.mode === "jumping" ||
      state.mode === "crouching") &&
    state.isCalibrated
  ) {
    const baselineAdjust = parseInt(elements.baselineAdjust.value);
    const jumpThreshold = parseInt(elements.jumpThreshold.value);
    const crouchThreshold = parseInt(elements.crouchThreshold.value);

    // Baseline
    ctx.beginPath();
    ctx.strokeStyle = "rgba(0, 0, 255, 0.7)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.moveTo(0, state.baseline.hipY + baselineAdjust);
    ctx.lineTo(elements.canvas.width, state.baseline.hipY + baselineAdjust);
    ctx.stroke();

    // Jump threshold
    ctx.beginPath();
    ctx.strokeStyle = "rgba(0, 255, 0, 0.7)";
    ctx.moveTo(0, state.baseline.hipY + baselineAdjust - jumpThreshold);
    ctx.lineTo(
      elements.canvas.width,
      state.baseline.hipY + baselineAdjust - jumpThreshold
    );
    ctx.stroke();

    // Crouch threshold
    ctx.beginPath();
    ctx.strokeStyle = "rgba(128, 0, 128, 0.7)";
    ctx.moveTo(0, state.baseline.hipY + baselineAdjust + crouchThreshold);
    ctx.lineTo(
      elements.canvas.width,
      state.baseline.hipY + baselineAdjust + crouchThreshold
    );
    ctx.stroke();

    ctx.setLineDash([]);

    // Add labels to threshold lines
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

  // Debug display
  if (DEBUG_MODE) {
    // Display confidence scores in a corner
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(10, 10, 180, 120);
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
  }
}

// Helper function to create a body outline from keypoints
function getBodyOutline(keypoints) {
  const outline = [];
  const pointMap = {};

  // Create a map for quick access
  keypoints.forEach((kp) => {
    pointMap[kp.name] = kp;
  });

  // Add points in order to create an outline
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
      // Check if crouch function exists
      if (typeof crouch === "function") {
        crouch(true);
      }
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
      // Check if crouch function exists
      if (typeof crouch === "function") {
        crouch(false);
      }
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
      // Check if jump function exists
      if (typeof jump === "function") {
        jump();
      }
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

// Define placeholder functions in case they're called but not defined elsewhere
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

// Add a message to let users know it's working
document.body.insertAdjacentHTML(
  "afterbegin",
  '<div id="loadingMessage" style="position:absolute;top:10px;left:10px;background:rgba(0,0,0,0.7);color:white;padding:10px;z-index:100;border-radius:5px;">Loading pose detection...</div>'
);

// Start the initialization and remove the message when done
init()
  .then(() => {
    const loadingMessage = document.getElementById("loadingMessage");
    if (loadingMessage) {
      loadingMessage.remove();
    }
  })
  .catch((error) => {
    console.error("Failed to initialize:", error);
    const loadingMessage = document.getElementById("loadingMessage");
    if (loadingMessage) {
      loadingMessage.textContent = "Error: " + error.message;
      loadingMessage.style.backgroundColor = "rgba(255,0,0,0.7)";
    }
  });
