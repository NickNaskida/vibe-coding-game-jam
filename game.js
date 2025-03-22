const canvas = document.getElementById("gameCanvas");
const scoreElement = document.getElementById("score");

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

// Add Audio Listener
const listener = new THREE.AudioListener();
camera.add(listener);

// Audio objects
const audioLoader = new THREE.AudioLoader();
const backgroundMusic = new THREE.Audio(listener);
const jumpSound = new THREE.Audio(listener);
const coinPickupSound = new THREE.Audio(listener);

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
  alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Enhanced desert appearance
scene.background = new THREE.Color(0xffd7a3);
scene.fog = new THREE.FogExp2(0xffd7a3, 0.008);

// Lighting for desert environment
const ambientLight = new THREE.AmbientLight(0xffd1a3, 0.7);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffe6cc, 2.0);
directionalLight.position.set(30, 100, 20);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 4096;
directionalLight.shadow.mapSize.height = 4096;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 200;
directionalLight.shadow.camera.left = -100;
directionalLight.shadow.camera.right = 100;
directionalLight.shadow.camera.top = 100;
directionalLight.shadow.camera.bottom = -100;
scene.add(directionalLight);

// Desert ground with subtle texture
const groundGeometry = new THREE.PlaneGeometry(3000, 3000, 256, 256);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0xe6c088,
  roughness: 0.9,
  metalness: 0.1,
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Define road and divider dimensions
const roadWidth = 36;
const laneWidth = roadWidth / 3;
const laneCenters = [-laneWidth, 0, laneWidth];

// Create roads
const roadGeometry = new THREE.PlaneGeometry(3000, roadWidth);
const roadMaterial = new THREE.MeshStandardMaterial({
  color: 0xad8a56,
  roughness: 0.7,
});
const road = new THREE.Mesh(roadGeometry, roadMaterial);
road.rotation.x = -Math.PI / 2;
road.position.y = 0.05;
scene.add(road);

// Lane dividers
const dividerGeometry = new THREE.PlaneGeometry(3000, 0.8);
const dividerMaterial = new THREE.MeshStandardMaterial({
  color: 0xf2e6d6,
  transparent: true,
  opacity: 0.9,
});

const divider1 = new THREE.Mesh(dividerGeometry, dividerMaterial);
divider1.rotation.x = -Math.PI / 2;
divider1.position.set(0, 0.06, -laneWidth / 2);
scene.add(divider1);

const divider2 = new THREE.Mesh(dividerGeometry, dividerMaterial);
divider2.rotation.x = -Math.PI / 2;
divider2.position.set(0, 0.06, laneWidth / 2);
scene.add(divider2);

// Road borders
const borderWidth = 1.2;
const borderHeight = 6;
const leftBorderGeo = new THREE.BoxGeometry(3000, borderHeight, borderWidth);
const rightBorderGeo = new THREE.BoxGeometry(3000, borderHeight, borderWidth);
const borderMaterial = new THREE.MeshStandardMaterial({
  color: 0xe6c088,
  roughness: 0.9,
  metalness: 0.1,
  bumpScale: 0.02,
});

const leftBorder = new THREE.Mesh(leftBorderGeo, borderMaterial);
leftBorder.position.set(
  0,
  borderHeight / 2 - 3,
  -roadWidth / 2 - borderWidth / 2
);
leftBorder.castShadow = true;
leftBorder.receiveShadow = true;
scene.add(leftBorder);

const rightBorder = new THREE.Mesh(rightBorderGeo, borderMaterial);
rightBorder.position.set(
  0,
  borderHeight / 2 - 3,
  roadWidth / 2 + borderWidth / 2
);
rightBorder.castShadow = true;
rightBorder.receiveShadow = true;
scene.add(rightBorder);

// Add sand dunes
function addSandDunes() {
  const duneCount = 40;
  const duneGeometry = new THREE.ConeGeometry(3, 2, 5);
  const duneMaterial = new THREE.MeshStandardMaterial({
    color: 0xf2e6d6,
    roughness: 0.9,
    metalness: 0.0,
  });

  for (let i = 0; i < duneCount; i++) {
    const leftDune = new THREE.Mesh(duneGeometry, duneMaterial);
    leftDune.position.set(
      (Math.random() - 0.5) * 200,
      -2.5 + Math.random() * 0.5,
      -roadWidth / 2 - borderWidth - 2 - Math.random() * 5
    );
    leftDune.rotation.x = Math.PI / 2;
    leftDune.rotation.z = Math.random() * Math.PI;
    leftDune.scale.set(
      0.7 + Math.random() * 0.6,
      0.7 + Math.random() * 0.6,
      0.4 + Math.random() * 0.3
    );
    scene.add(leftDune);

    const rightDune = new THREE.Mesh(duneGeometry, duneMaterial);
    rightDune.position.set(
      (Math.random() - 0.5) * 200,
      -2.5 + Math.random() * 0.5,
      roadWidth / 2 + borderWidth + 2 + Math.random() * 5
    );
    rightDune.rotation.x = Math.PI / 2;
    rightDune.rotation.z = Math.random() * Math.PI;
    rightDune.scale.set(
      0.7 + Math.random() * 0.6,
      0.7 + Math.random() * 0.6,
      0.4 + Math.random() * 0.3
    );
    scene.add(rightDune);
  }
}
addSandDunes();

// Add desert scenery
function addDesertScenery() {
  const mountainGeometry = new THREE.ConeGeometry(50, 100, 4);
  const mountainMaterial = new THREE.MeshStandardMaterial({
    color: 0xc9a769,
    roughness: 0.95,
  });

  for (let i = 0; i < 10; i++) {
    const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);
    const scale = 1 + Math.random() * 1.5;
    mountain.scale.set(scale, scale * (0.7 + Math.random() * 0.6), scale);
    mountain.rotation.y = Math.random() * Math.PI;
    mountain.position.set(
      Math.random() * 1000 - 500,
      -20 + Math.random() * 10,
      Math.random() * 500 - 700
    );
    scene.add(mountain);
  }

  const cactiPositions = [];
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 600 - 300;
    const z = Math.random() * 600 - 400;
    if (Math.abs(z) > roadWidth) {
      cactiPositions.push({ x, z });
    }
  }

  cactiPositions.forEach((pos) => {
    const cactusHeight = 10 + Math.random() * 15;
    const cactusGeo = new THREE.CylinderGeometry(2, 3, cactusHeight, 8);
    const cactusMat = new THREE.MeshStandardMaterial({
      color: 0x1b512d,
      roughness: 0.8,
    });

    const cactus = new THREE.Mesh(cactusGeo, cactusMat);
    cactus.position.set(pos.x, cactusHeight / 2 - 5, pos.z);
    scene.add(cactus);
  });
}
addDesertScenery();

// Load audio files
audioLoader.load(
  "https://nicknaskida.github.io/vibe-coding-game-jam/sound/theme.mp3",
  function (buffer) {
    backgroundMusic.setBuffer(buffer);
    backgroundMusic.setLoop(true);
    backgroundMusic.setVolume(0.5);
  }
);

audioLoader.load(
  "https://nicknaskida.github.io/vibe-coding-game-jam/sound/jump.wav",
  function (buffer) {
    jumpSound.setBuffer(buffer);
    jumpSound.setVolume(0.7);
  }
);

audioLoader.load(
  "https://nicknaskida.github.io/vibe-coding-game-jam/sound/coin_pickup.wav",
  function (buffer) {
    coinPickupSound.setBuffer(buffer);
    coinPickupSound.setVolume(0.7);
  }
);

// Larger dino
const dinoGroup = new THREE.Group();
const dinoScale = 3.0;

const bodyGeometry = new THREE.BoxGeometry(1.5, 1, 0.5);
const headGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
const legGeometry = new THREE.BoxGeometry(0.4, 0.8, 0.4);
const tailGeometry = new THREE.ConeGeometry(0.3, 1, 12);
const eyeGeometry = new THREE.SphereGeometry(0.1, 16, 16);
const dinoMaterial = new THREE.MeshStandardMaterial({
  color: 0x8b5a2b,
  roughness: 0.6,
});
const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });

const body = new THREE.Mesh(bodyGeometry, dinoMaterial);
const head = new THREE.Mesh(headGeometry, dinoMaterial);
const leftLeg = new THREE.Mesh(legGeometry, dinoMaterial);
const rightLeg = new THREE.Mesh(legGeometry, dinoMaterial);
const tail = new THREE.Mesh(tailGeometry, dinoMaterial);
const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);

head.position.set(0.75, 0.8, 0);
leftLeg.position.set(-0.4, 0.2, 0);
rightLeg.position.set(0.4, 0.2, 0);
tail.position.set(-0.75, 0.5, 0);
tail.rotation.z = Math.PI / 2;
leftEye.position.set(0.85, 0.9, 0.25);
rightEye.position.set(0.85, 0.9, -0.25);

dinoGroup.add(body, head, leftLeg, rightLeg, tail, leftEye, rightEye);
dinoGroup.scale.set(dinoScale, dinoScale, dinoScale);
dinoGroup.position.set(-50, 1, 0);
dinoGroup.castShadow = true;
scene.add(dinoGroup);

// Game variables
let isJumping = false;
let isCrouching = false;
let jumpVelocity = 0;
let gameSpeed = 0.2;
let score = 0;
let coins = 0;
let gameStarted = false;
let gameOver = false;
const gravity = 0.025;
const initialJumpVelocity = 0.6;
const obstacles = [];
const coinsArray = [];
let lastObstacleTime = 0;
let lastCoinTime = 0;
const minSpawnGap = 1500;
const minCoinSpawnGap = 2000;

function createObstacle() {
  const obstacleGroup = new THREE.Group();
  const obstacleScale = 3.0;

  const cactusMaterial = new THREE.MeshStandardMaterial({
    color: 0x355e3b,
    roughness: 0.8,
  });
  const difficulty = Math.min(score / 1000, 1);

  const type = Math.floor(Math.random() * 7);
  const laneSpans = [1, 2, 3];
  let span =
    laneSpans[
      Math.floor(Math.random() * laneSpans.length * (0.5 + difficulty)) %
        laneSpans.length
    ];
  const width = span * laneWidth;

  let requiresJump = false;
  let requiresCrouch = false;
  let obstacleHeight = 0;

  if (type <= 1) {
    const maxHeight = 1 + difficulty * 0.4;
    const height = Math.min(maxHeight, 1.0 + difficulty * 0.3);
    const geometry = new THREE.BoxGeometry(1, height, width);
    const tall = new THREE.Mesh(geometry, cactusMaterial);
    tall.position.y = height / 2;
    tall.castShadow = true;
    obstacleGroup.add(tall);
    requiresJump = true;
    obstacleHeight = height;
  } else if (type >= 2 && type <= 3) {
    const crouchHeight = 0.8;
    const geometry = new THREE.BoxGeometry(1, crouchHeight, width);
    const low = new THREE.Mesh(geometry, cactusMaterial);
    low.position.y = crouchHeight / 2;
    low.castShadow = true;
    obstacleGroup.add(low);
    requiresCrouch = true;
    obstacleHeight = crouchHeight;
  } else if (type >= 4 && type <= 5) {
    const dinoHeightWhenCrouched = dinoScale * 0.5;
    const archHeight = dinoHeightWhenCrouched * 1.2;
    const sideGeo = new THREE.BoxGeometry(1, archHeight, 0.5);
    const topGeo = new THREE.BoxGeometry(1, 0.5, width);
    const leftSide = new THREE.Mesh(sideGeo, cactusMaterial);
    const rightSide = new THREE.Mesh(sideGeo, cactusMaterial);
    const top = new THREE.Mesh(topGeo, cactusMaterial);
    leftSide.position.set(0, archHeight / 2, -width / 2 + 0.25);
    rightSide.position.set(0, archHeight / 2, width / 2 - 0.25);
    top.position.set(0, archHeight + 0.25, 0);
    leftSide.castShadow = true;
    rightSide.castShadow = true;
    top.castShadow = true;
    obstacleGroup.add(leftSide, rightSide, top);
    requiresCrouch = true;
    obstacleHeight = archHeight + 0.5;
  } else if (type >= 6 && type <= 7) {
    const maxWideHeight = 1.5 + difficulty * 0.5;
    const height = Math.min(maxWideHeight, 2 + difficulty);
    const geometry = new THREE.BoxGeometry(1, height, width);
    const wide = new THREE.Mesh(geometry, cactusMaterial);
    wide.position.y = height / 2;
    wide.castShadow = true;
    obstacleGroup.add(wide);
    requiresJump = true;
    obstacleHeight = height;
  }

  obstacleGroup.scale.set(obstacleScale, obstacleScale, obstacleScale);
  const scaledWidth = width * obstacleScale;
  const borderOffset = 1.2;
  const maxZ = (roadWidth - scaledWidth) / 2 - borderOffset;
  const minZ = -maxZ;
  let zPos = Math.random() * (maxZ - minZ) + minZ;

  obstacleGroup.position.set(dinoGroup.position.x + 120, 0, zPos);
  scene.add(obstacleGroup);

  obstacles.push({
    mesh: obstacleGroup,
    requiresJump,
    requiresCrouch,
    width: scaledWidth,
    zPos,
    height: obstacleHeight * obstacleScale,
  });
}

function createCoin() {
  const coinGeometry = new THREE.CylinderGeometry(1, 1, 0.5, 32);
  const coinMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xdda900,
    roughness: 0.3,
    metalness: 0.7,
  });
  const coin = new THREE.Mesh(coinGeometry, coinMaterial);
  coin.rotation.x = Math.PI / 2;
  coin.castShadow = true;

  let laneIndex = Math.floor(Math.random() * 3);
  let zPos = laneCenters[laneIndex];

  coin.position.set(dinoGroup.position.x + 120, 2 * dinoScale * 0.25, zPos);
  scene.add(coin);
  coinsArray.push({
    mesh: coin,
    rotationSpeed: Math.random() * 0.05 + 0.03,
  });
}

// Control functions
function jump() {
  if (!isJumping && !gameOver) {
    isJumping = true;
    jumpVelocity = initialJumpVelocity;
    if (!jumpSound.isPlaying) {
      jumpSound.play();
    }
  }
}

function crouch(start = true) {
  if (!gameOver) {
    if (start && !isCrouching) {
      isCrouching = true;
      dinoGroup.scale.y = dinoScale * 0.5;
      dinoGroup.position.y = dinoScale * 0.25;
    } else if (!start && isCrouching) {
      isCrouching = false;
      dinoGroup.scale.y = dinoScale;
      dinoGroup.position.y = dinoScale * 0.5;
    }
  }
}

// Input handling
document.addEventListener("keydown", (event) => {
  if (event.code === "Space") jump();
  if (event.code === "ArrowDown") crouch(true);
});

document.addEventListener("keyup", (event) => {
  if (event.code === "ArrowDown") crouch(false);
});

// Game loop
let lastFrameTime = performance.now();

function animate() {
  if (!gameStarted) return;

  requestAnimationFrame(animate);
  const currentTime = performance.now();
  const deltaTime = Math.min(currentTime - lastFrameTime, 100) / 1000;
  lastFrameTime = currentTime;

  if (gameOver) {
    showGameOver();
    return;
  }

  dinoGroup.position.x += gameSpeed;

  // Handle jumping physics
  if (isJumping) {
    dinoGroup.position.y += jumpVelocity;
    jumpVelocity -= gravity;
    const baseY = isCrouching ? dinoScale * 0.25 : dinoScale * 0.5;
    if (dinoGroup.position.y <= baseY) {
      dinoGroup.position.y = baseY;
      isJumping = false;
      jumpVelocity = 0;
    }
  }

  // Camera follows player
  const cameraOffset = new THREE.Vector3(-20, 10, 0);
  const targetPosition = dinoGroup.position.clone().add(cameraOffset);
  camera.position.lerp(targetPosition, 0.1);
  camera.lookAt(dinoGroup.position);

  // Process obstacles
  obstacles.forEach((obstacle, index) => {
    obstacle.mesh.position.x -= gameSpeed;

    if (obstacle.mesh.position.x < dinoGroup.position.x - 70) {
      scene.remove(obstacle.mesh);
      obstacles.splice(index, 1);
      score += 10;
      return;
    }

    // Improved collision detection
    const dinoBox = new THREE.Box3().setFromObject(dinoGroup);
    const obstacleBox = new THREE.Box3().setFromObject(obstacle.mesh);

    if (dinoBox.intersectsBox(obstacleBox)) {
      // Handle jump obstacles
      if (obstacle.requiresJump) {
        if (!isJumping || dinoGroup.position.y < obstacle.height) {
          gameOver = true;
          return;
        }
      }

      // Handle crouch obstacles
      if (obstacle.requiresCrouch) {
        const dinoHeight = isCrouching ? dinoScale * 0.5 : dinoScale;
        const dinoTop = dinoGroup.position.y + dinoHeight / 2;
        const obstacleTop = obstacle.mesh.position.y + obstacle.height;

        if (!isCrouching && dinoTop > obstacleTop - dinoScale * 0.2) {
          gameOver = true;
          return;
        }
      }
    }
  });

  // Process coins
  coinsArray.forEach((coin, index) => {
    coin.mesh.position.x -= gameSpeed;
    coin.mesh.rotation.z += coin.rotationSpeed;

    const dinoBox = new THREE.Box3().setFromObject(dinoGroup);
    const coinBox = new THREE.Box3().setFromObject(coin.mesh);

    if (dinoBox.intersectsBox(coinBox)) {
      scene.remove(coin.mesh);
      coinsArray.splice(index, 1);
      coins++;
      if (!coinPickupSound.isPlaying) {
        coinPickupSound.play();
      }
    } else if (coin.mesh.position.x < dinoGroup.position.x - 70) {
      scene.remove(coin.mesh);
      coinsArray.splice(index, 1);
    }
  });

  // Spawn obstacles and coins
  if (
    currentTime - lastObstacleTime >
    minSpawnGap * (1 - Math.min(score / 5000, 0.7))
  ) {
    createObstacle();
    lastObstacleTime = currentTime;
  }

  if (
    currentTime - lastCoinTime >
    minCoinSpawnGap * (1 - Math.min(score / 5000, 0.7))
  ) {
    createCoin();
    lastCoinTime = currentTime;
  }

  // Update game speed and score
  gameSpeed = Math.min(0.2 + score / 500, 0.4);
  score += gameSpeed * 2;
  scoreElement.textContent = `Score: ${Math.floor(score)} Coins: ${coins}`;

  renderer.render(scene, camera);
}

// Countdown function
function startCountdown(callback) {
  let countdown = 3;
  const countdownOverlay = document.getElementById("countdownOverlay");
  countdownOverlay.style.display = "flex";
  countdownOverlay.textContent = countdown;

  const interval = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      countdownOverlay.textContent = countdown;
    } else {
      countdownOverlay.textContent = "GO!";
      setTimeout(() => {
        countdownOverlay.style.display = "none";
        countdownOverlay.textContent = "";
        clearInterval(interval);
        callback();
      }, 500);
    }
  }, 1000);
}

// Start game
function startGame() {
  document.getElementById("overlay").style.display = "none";
  startCountdown(() => {
    gameStarted = true;
    gameOver = false;
    score = 0;
    coins = 0;
    gameSpeed = 0.2;
    lastObstacleTime = performance.now();
    lastCoinTime = performance.now();
    lastFrameTime = performance.now();
    if (!backgroundMusic.isPlaying) {
      backgroundMusic.play();
    }
    animate();
  });
}

// Restart game
function restartGame() {
  obstacles.forEach((o) => scene.remove(o.mesh));
  obstacles.length = 0;
  coinsArray.forEach((c) => scene.remove(c.mesh));
  coinsArray.length = 0;

  score = 0;
  coins = 0;
  gameSpeed = 0.2;
  gameOver = false;
  gameStarted = false;
  dinoGroup.position.set(-50, dinoScale * 0.5, 0);
  dinoGroup.scale.set(dinoScale, dinoScale, dinoScale);
  isJumping = false;
  isCrouching = false;
  jumpVelocity = 0;
  lastObstacleTime = performance.now();
  lastCoinTime = performance.now();

  document.getElementById("gameOverScreen").style.display = "none";

  startCountdown(() => {
    gameStarted = true;
    lastFrameTime = performance.now();
    if (!backgroundMusic.isPlaying) {
      backgroundMusic.play();
    }
    animate();
  });
}

function executeGestureAction() {
  if (gameOver) {
    restartGame();
  } else if (!gameStarted) {
    startGame();
  }
}

// Show game over
function showGameOver() {
  const gameOverScreen = document.getElementById("gameOverScreen");
  document.getElementById(
    "finalScore"
  ).textContent = `Final Score: ${Math.floor(score)} Coins: ${coins}`;
  gameOverScreen.style.display = "flex";
  gameStarted = false;
  backgroundMusic.stop();
}

// Event listeners
document.getElementById("startButton").addEventListener("click", startGame);
document.getElementById("restartButton").addEventListener("click", restartGame);

// Window resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Export functions
window.jump = jump;
window.crouch = crouch;
window.executeGestureAction = executeGestureAction;
