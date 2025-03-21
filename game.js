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
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
scene.background = new THREE.Color(0x87ceeb);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

// Ground with texture
const groundTexture = new THREE.TextureLoader().load(
  "https://threejs.org/examples/textures/terrain/grasslight-big.jpg"
);
groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
groundTexture.repeat.set(25, 25);
const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
const groundMaterial = new THREE.MeshLambertMaterial({ map: groundTexture });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Improved Dino
const dinoGroup = new THREE.Group();
const bodyGeometry = new THREE.BoxGeometry(1.5, 1, 0.5);
const headGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
const legGeometry = new THREE.BoxGeometry(0.4, 0.8, 0.4);
const dinoMaterial = new THREE.MeshLambertMaterial({ color: 0x228b22 });
const body = new THREE.Mesh(bodyGeometry, dinoMaterial);
const head = new THREE.Mesh(headGeometry, dinoMaterial);
const leftLeg = new THREE.Mesh(legGeometry, dinoMaterial);
const rightLeg = new THREE.Mesh(legGeometry, dinoMaterial);

head.position.set(0.75, 0.8, 0);
leftLeg.position.set(-0.4, 0.2, 0);
rightLeg.position.set(0.4, 0.2, 0);
dinoGroup.add(body, head, leftLeg, rightLeg);
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
const gravity = 0.02;
const obstacles = [];
const maxJumpHeight = 8;
let lastObstacleTime = 0;
const minSpawnGap = 2000; // Minimum time between spawns in milliseconds
const maxObstacles = 3; // Maximum obstacles on screen at once

// Enhanced Obstacle creation with better control
function createObstacle(currentTime) {
  const height = Math.random() * 0.5; // Reduced max height for jumpability
  const obstacleGroup = new THREE.Group();
  const baseGeometry = new THREE.CylinderGeometry(0.3, 0.3, height, 8);
  const obstacleMaterial = new THREE.MeshLambertMaterial({ color: 0x006400 });

  const base = new THREE.Mesh(baseGeometry, obstacleMaterial);
  base.position.y = height / 2;
  base.castShadow = true;

  obstacleGroup.add(base);
  obstacleGroup.position.set(20, 0, Math.random() * 1 - 0.5); // Reduced Z variation
  scene.add(obstacleGroup);
  obstacles.push({ mesh: obstacleGroup, height: height });
}

// Control functions
function jump() {
  if (!isJumping && !gameOver) {
    isJumping = true;
    jumpVelocity = 0.35;
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
  const deltaTime = currentTime - lastFrameTime;
  lastFrameTime = currentTime;

  if (gameOver) return;

  // Jump mechanics
  if (isJumping) {
    dinoGroup.position.y += jumpVelocity;
    jumpVelocity -= gravity;
    if (dinoGroup.position.y <= 0.5) {
      dinoGroup.position.y = 0.5;
      isJumping = false;
    }
    if (dinoGroup.position.y > maxJumpHeight) {
      jumpVelocity = -0.1;
    }
  }

  // Move obstacles
  obstacles.forEach((obstacle, index) => {
    obstacle.mesh.position.x -= gameSpeed;

    // Improved collision detection
    const dinoHeight = isCrouching ? 0.5 : 1;
    const dinoWidth = 1.5;
    const obstacleBox = new THREE.Box3().setFromObject(obstacle.mesh);

    if (
      obstacle.mesh.position.x < -4 &&
      obstacle.mesh.position.x > -6 &&
      Math.abs(obstacle.mesh.position.z - dinoGroup.position.z) < 1 &&
      dinoGroup.position.y < obstacle.height + 0.2
    ) {
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

  // Update game state
  gameSpeed = Math.min(0.05 + score / 1000, 0.15); // Smoother speed progression
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
  dinoGroup.position.set(-5, 0.5, 0);
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

// Export functions for external use
window.jump = jump;
window.crouch = crouch;
