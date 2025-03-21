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
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
scene.background = new THREE.Color(0xe68a3d); // Deeper desert sunset sky
scene.fog = new THREE.FogExp2(0xe68a3d, 0.02); // Exponential fog for depth

// Lighting (harsh desert sunlight with warm tone)
const ambientLight = new THREE.AmbientLight(0xffd1a3, 0.4); // Warm ambient
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffe6cc, 1.3); // Warm sunlight
directionalLight.position.set(15, 25, 10);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
scene.add(directionalLight);

// Desert ground with dunes
const textureLoader = new THREE.TextureLoader();
const groundTexture = textureLoader.load(
  "https://threejs.org/examples/textures/terrain/sand.jpg"
);
const groundNormal = textureLoader.load(
  "https://threejs.org/examples/textures/terrain/sand-nm.jpg"
);
const groundDisplacement = textureLoader.load(
  "https://threejs.org/examples/textures/terrain/sand-disp.jpg"
); // Displacement for dunes
groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
groundNormal.wrapS = groundNormal.wrapT = THREE.RepeatWrapping;
groundDisplacement.wrapS = groundDisplacement.wrapT = THREE.RepeatWrapping;
groundTexture.repeat.set(25, 25);
groundNormal.repeat.set(25, 25);
groundDisplacement.repeat.set(25, 25);
const groundGeometry = new THREE.PlaneGeometry(1000, 1000, 64, 64); // Higher resolution for displacement
const groundMaterial = new THREE.MeshStandardMaterial({
  map: groundTexture,
  normalMap: groundNormal,
  displacementMap: groundDisplacement,
  displacementScale: 2, // Subtle dune height
  roughness: 0.9,
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Improved Dino
const dinoGroup = new THREE.Group();
const bodyGeometry = new THREE.BoxGeometry(1.5, 1, 0.5);
const headGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
const legGeometry = new THREE.BoxGeometry(0.4, 0.8, 0.4);
const tailGeometry = new THREE.ConeGeometry(0.3, 1, 8);
const eyeGeometry = new THREE.SphereGeometry(0.1, 16, 16);
const dinoMaterial = new THREE.MeshStandardMaterial({
  color: 0x8b5a2b,
  roughness: 0.7,
}); // Desert-brown
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
dinoGroup.position.set(-5, 0.5, 0);
dinoGroup.castShadow = true;
scene.add(dinoGroup);

// Camera position
camera.position.set(0, 5, 15);
camera.lookAt(0, 0, 0);

// Game variables
let isJumping = false;
let isCrouching = false;
let jumpVelocity = 0;
let gameSpeed = 0.05;
let score = 0;
let gameOver = false;
const gravity = 0.025; // Chrome Dino gravity
const initialJumpVelocity = 0.45; // Slightly reduced jump
const obstacles = [];
let lastObstacleTime = 0;
const minSpawnGap = 2000;
const maxObstacles = 3;

// Enhanced cactus obstacles
function createObstacle(currentTime) {
  const height = Math.random() * 0.6 + 0.2; // Max height 0.8
  const obstacleGroup = new THREE.Group();

  // Multi-segment cactus
  const segmentCount = Math.floor(Math.random() * 2) + 1; // 1-2 segments
  const segmentHeight = height / segmentCount;
  const cactusMaterial = new THREE.MeshStandardMaterial({
    color: 0x355e3b,
    roughness: 0.8,
  });

  for (let i = 0; i < segmentCount; i++) {
    const geometry = new THREE.CylinderGeometry(
      0.2 - i * 0.05,
      0.3 - i * 0.05,
      segmentHeight,
      8
    );
    const segment = new THREE.Mesh(geometry, cactusMaterial);
    segment.position.y = i * segmentHeight + segmentHeight / 2;
    segment.castShadow = true;
    obstacleGroup.add(segment);
  }

  obstacleGroup.position.set(20, 0, Math.random() * 1 - 0.5);
  scene.add(obstacleGroup);
  obstacles.push({ mesh: obstacleGroup, height: height });
}

// Control functions
function jump() {
  if (!isJumping && !gameOver) {
    isJumping = true;
    jumpVelocity = initialJumpVelocity;
  }
}

function crouch(start = true) {
  if (!isJumping && !gameOver) {
    if (start) {
      isCrouching = true;
      dinoGroup.scale.y = 0.5;
      dinoGroup.position.y = 0.25;
    } else {
      isCrouching = false;
      dinoGroup.scale.y = 1;
      dinoGroup.position.y = 0.5;
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
  requestAnimationFrame(animate);
  const currentTime = performance.now();
  const deltaTime = Math.min(currentTime - lastFrameTime, 100) / 1000; // Cap deltaTime
  lastFrameTime = currentTime;

  if (gameOver) return;

  // Chrome Dino-style jump
  if (isJumping) {
    dinoGroup.position.y += jumpVelocity;
    jumpVelocity -= gravity;
    if (dinoGroup.position.y <= 0.5) {
      dinoGroup.position.y = 0.5;
      isJumping = false;
      jumpVelocity = 0;
    }
  }

  // Move obstacles
  obstacles.forEach((obstacle, index) => {
    obstacle.mesh.position.x -= gameSpeed;

    // Collision detection
    const dinoBox = new THREE.Box3().setFromObject(dinoGroup);
    const obstacleBox = new THREE.Box3().setFromObject(obstacle.mesh);

    if (dinoBox.intersectsBox(obstacleBox)) {
      gameOver = true;
      alert(`Game Over! Score: ${Math.floor(score)}\nPress OK to restart`);
      restartGame();
      return;
    }

    if (obstacle.mesh.position.x < -20) {
      scene.remove(obstacle.mesh);
      obstacles.splice(index, 1);
      score += 10;
    }
  });

  // Controlled obstacle spawning
  if (
    currentTime - lastObstacleTime > minSpawnGap &&
    obstacles.length < maxObstacles &&
    obstacles.every((obs) => obs.mesh.position.x < 15)
  ) {
    createObstacle(currentTime);
    lastObstacleTime = currentTime;
  }

  // Update game state with faster speed increase
  gameSpeed = Math.min(0.05 + score / 500, 0.2); // Faster ramp-up, max speed 0.2
  score += gameSpeed * 2;
  scoreElement.textContent = `Score: ${Math.floor(score)}`;

  renderer.render(scene, camera);
}

function restartGame() {
  obstacles.forEach((o) => scene.remove(o.mesh));
  obstacles.length = 0;
  score = 0;
  gameSpeed = 0.05;
  gameOver = false;
  dinoGroup.position.y = 0.5;
  dinoGroup.position.x = -5;
  isJumping = false;
  isCrouching = false;
  dinoGroup.scale.y = 1;
  lastObstacleTime = performance.now();
}

// Window resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();

// Export functions
window.jump = jump;
window.crouch = crouch;
