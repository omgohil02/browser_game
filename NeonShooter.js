// 1. Setup Canvas & Fullscreen
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Initial sizing

// 2. Game State Management
let gameState = 'MENU'; // 'MENU', 'PLAYING', or 'GAMEOVER'
let highScore = localStorage.getItem('cyberSurvivorHighScore') || 0;
let finalScore = 0;
let finalEnemiesDefeated = 0;
let gameTimeSurvived = 0;
let runStartTime = 0;

// Combo / Multi-Kill System State
let comboCount = 0;
let comboTimer = 0;
let comboMultiplier = 1;

// EMP Blast State
let empCooldown = 0;

// 3. Audio System (Web Audio API)
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playSound(type) {
  if (!audioCtx) return;
  
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (type === 'shoot') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
    gainNode.gain.setValueAtTime(0.15, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (type === 'explosion') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(30, now + 0.3);
    gainNode.gain.setValueAtTime(0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'powerup') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
    gainNode.gain.setValueAtTime(0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'hurt') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(50, now + 0.25);
    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  } else if (type === 'dash') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
    gainNode.gain.setValueAtTime(0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'emp') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.5);
    gainNode.gain.setValueAtTime(0.35, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.5);
  }
}

// 4. Camera & Screen Shake Object
const camera = { x: 0, y: 0 };
let shakeDuration = 0;
let shakeIntensity = 0;

function triggerShake(duration, intensity) {
  shakeDuration = duration;
  shakeIntensity = intensity;
}

// 5. Track Keyboard & Mouse
const keys = {
  w: false, a: false, s: false, d: false,
  ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false,
  ' ': false
};

window.addEventListener('keydown', (e) => {
  initAudio();
  if (gameState === 'MENU' || gameState === 'GAMEOVER') {
    gameState = 'PLAYING';
    resetGame();
    return;
  }

  if (e.key in keys || e.key === ' ') keys[e.key === ' ' ? ' ' : e.key] = true;
  if ((e.key === 'e' || e.key === 'E') && !e.repeat) {
    fireProjectile();
  }
  if ((e.key === 'q' || e.key === 'Q') && !e.repeat) {
    tryEmpBlast();
  }
  if (e.key === ' ' && !e.repeat) {
    tryDash();
  }
});

window.addEventListener('keyup', (e) => {
  const k = e.key === ' ' ? ' ' : e.key;
  if (k in keys) keys[k] = false;
});

const projectiles = [];
const enemyProjectiles = [];
const mouse = { x: 0, y: 0 };

canvas.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

canvas.addEventListener('mousedown', (e) => {
  initAudio();
  if (gameState === 'MENU' || gameState === 'GAMEOVER') {
    gameState = 'PLAYING';
    resetGame();
    return;
  }
  if (e.button === 0) fireProjectile();
});

// 6. Game Objects & Buffs
let score = 0;
let enemiesDefeatedCount = 0;
const particles = [];
const dashTrails = [];
const powerups = [];

let tripleShotTimer = 0;
let rapidFireTimer = 0;
let shieldTimer = 0;

let lastShotTime = 0;
const FIRE_COOLDOWN = 1.5; 

let mapPowerupTimer = 6.0;

const player = {
  x: 0,
  y: 0,
  size: 32,
  speed: 4.5,
  color: '#ff4757',
  health: 100,
  maxHealth: 100,
  isDashing: false,
  dashTimer: 0,
  dashCooldown: 0
};

// Enemy System
const enemies = [];
let spawnTimer = 2.5;
let lastTime = performance.now();

// Infinite Random Obstacles
const obstacles = [];
for (let i = 0; i < 2000; i++) {
  obstacles.push({
    x: (Math.random() - 0.5) * 15000,
    y: (Math.random() - 0.5) * 15000,
    width: Math.random() * 150 + 50,
    height: Math.random() * 150 + 50,
    color: '#2f3542'
  });
}

// 7. Collision & Reset Helper
function isColliding(rect1, rect2) {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
}

function resetGame() {
  player.x = 0;
  player.y = 0;
  player.health = player.maxHealth;
  enemies.length = 0;
  enemyProjectiles.length = 0;
  powerups.length = 0;
  projectiles.length = 0;
  dashTrails.length = 0;
  score = 0;
  enemiesDefeatedCount = 0;
  runStartTime = performance.now();
  comboCount = 0;
  comboMultiplier = 1;
  comboTimer = 0;
  empCooldown = 0;
  tripleShotTimer = 0;
  rapidFireTimer = 0;
  shieldTimer = 0;
  mapPowerupTimer = 6.0;
  lastTime = performance.now();
}

function handleGameOver() {
  finalScore = score;
  finalEnemiesDefeated = enemiesDefeatedCount;
  gameTimeSurvived = ((performance.now() - runStartTime) / 1000).toFixed(1);
  if (finalScore > highScore) {
    highScore = finalScore;
    localStorage.setItem('cyberSurvivorHighScore', highScore);
  }
  gameState = 'GAMEOVER';
}

// Particle & Dash Trail Updaters
function createExplosion(x, y, color) {
  playSound('explosion');
  triggerShake(0.2, 10);
  for (let i = 0; i < 15; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      life: 1.0,
      color: color
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.03;

    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }

  for (let i = dashTrails.length - 1; i >= 0; i--) {
    const dt = dashTrails[i];
    dt.life -= 0.05;
    if (dt.life <= 0) {
      dashTrails.splice(i, 1);
    }
  }
}

function spawnPowerup(x, y) {
  const rand = Math.random();
  let type = 'TRIPLE';
  let color = '#1e90ff';

  if (rand < 0.33) {
    type = 'TRIPLE';
    color = '#1e90ff';
  } else if (rand < 0.66) {
    type = 'RAPID';
    color = '#fffa65';
  } else {
    type = 'SHIELD';
    color = '#00d2d3';
  }

  powerups.push({
    x: x - 12,
    y: y - 12,
    size: 24,
    type: type,
    color: color
  });
}

function updatePowerups(dt) {
  if (tripleShotTimer > 0) tripleShotTimer -= dt;
  if (rapidFireTimer > 0) rapidFireTimer -= dt;
  if (shieldTimer > 0) shieldTimer -= dt;

  const playerBox = { x: player.x, y: player.y, width: player.size, height: player.size };
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    const pBox = { x: p.x, y: p.y, width: p.size, height: p.size };

    if (isColliding(playerBox, pBox)) {
      playSound('powerup');
      if (p.type === 'TRIPLE') tripleShotTimer = 8.0;
      if (p.type === 'RAPID') rapidFireTimer = 8.0;
      if (p.type === 'SHIELD') {
        shieldTimer = 8.0;
        player.health = Math.min(player.maxHealth, player.health + 20);
      }
      powerups.splice(i, 1);
    }
  }
}

// 8. Dash & EMP Actions
function tryDash() {
  if (player.dashCooldown <= 0 && !player.isDashing) {
    player.isDashing = true;
    player.dashTimer = 0.15;
    player.dashCooldown = 1.2;
    playSound('dash');
    triggerShake(0.1, 5);
  }
}

function tryEmpBlast() {
  if (empCooldown <= 0 && gameState === 'PLAYING') {
    empCooldown = 12.0;
    playSound('emp');
    triggerShake(0.4, 20);

    enemyProjectiles.length = 0;

    const playerCenterX = player.x + player.size / 2;
    const playerCenterY = player.y + player.size / 2;

    for (const e of enemies) {
      const eCenterX = e.x + e.size / 2;
      const eCenterY = e.y + e.size / 2;
      if (Math.hypot(eCenterX - playerCenterX, eCenterY - playerCenterY) < 400) {
        e.health -= 2;
        e.stunnedTimer = 3.5;
      }
    }

    for (let i = 0; i < 35; i++) {
      particles.push({
        x: playerCenterX,
        y: playerCenterY,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.5) * 16,
        life: 0.8,
        color: '#00d2d3'
      });
    }
  }
}

// 9. Shooting Logic
function fireProjectile() {
  const currentTime = performance.now() / 1000;
  const activeCooldown = rapidFireTimer > 0 ? 0.2 : FIRE_COOLDOWN;

  if (currentTime - lastShotTime < activeCooldown) {
    return;
  }

  playSound('shoot');

  const playerCenterX = player.x + player.size / 2;
  const playerCenterY = player.y + player.size / 2;
  
  const worldMouseX = mouse.x + camera.x;
  const worldMouseY = mouse.y + camera.y;

  const dx = worldMouseX - playerCenterX;
  const dy = worldMouseY - playerCenterY;
  const baseAngle = Math.atan2(dy, dx);

  if (Math.hypot(dx, dy) === 0) return;

  const angles = tripleShotTimer > 0 
    ? [baseAngle - 0.25, baseAngle, baseAngle + 0.25] 
    : [baseAngle];

  for (const angle of angles) {
    projectiles.push({
      x: playerCenterX - 4,
      y: playerCenterY - 4,
      size: 10,
      vx: Math.cos(angle) * 12,
      vy: Math.sin(angle) * 12,
      color: rapidFireTimer > 0 ? '#fffa65' : '#eccc68'
    });
  }

  lastShotTime = currentTime;
}

function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx;
    p.y += p.vy;

    if (Math.hypot(p.x - player.x, p.y - player.y) > 2000) {
      projectiles.splice(i, 1);
      continue;
    }

    const pBox = { x: p.x, y: p.y, width: p.size, height: p.size };
    let destroyed = false;

    for (const wall of obstacles) {
      if (isColliding(pBox, wall)) {
        destroyed = true;
        break;
      }
    }
    
    if (!destroyed) {
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (isColliding(pBox, { x: e.x, y: e.y, width: e.size, height: e.size })) {
          e.health--;
          
          if (e.health <= 0) {
            createExplosion(e.x + e.size / 2, e.y + e.size / 2, e.color);
            if (Math.random() < 0.35) {
              spawnPowerup(e.x + e.size / 2, e.y + e.size / 2);
            }
            enemies.splice(j, 1);
            enemiesDefeatedCount++;

            comboCount++;
            comboTimer = 2.5; 
            comboMultiplier = Math.min(5, 1 + Math.floor(comboCount / 3));
            score += (e.scoreValue || 10) * comboMultiplier;
          }

          destroyed = true;
          break;
        }
      }
    }

    if (destroyed) {
      projectiles.splice(i, 1);
    }
  }

  for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
    const ep = enemyProjectiles[i];
    ep.x += ep.vx;
    ep.y += ep.vy;

    const epBox = { x: ep.x, y: ep.y, width: ep.size, height: ep.size };
    const playerBox = { x: player.x, y: player.y, width: player.size, height: player.size };

    if (isColliding(epBox, playerBox)) {
      enemyProjectiles.splice(i, 1);
      if (shieldTimer <= 0 && !player.isDashing) {
        playSound('hurt');
        triggerShake(0.3, 15);
        player.health -= 20;
        if (player.health <= 0) handleGameOver();
      }
      continue;
    }

    let hitWall = false;
    for (const wall of obstacles) {
      if (isColliding(epBox, wall)) {
        hitWall = true;
        break;
      }
    }
    if (hitWall) {
      enemyProjectiles.splice(i, 1);
    }
  }
}

// 10. Diverse Enemy Types & Spawning
function spawnEnemy() {
  const angle = Math.random() * Math.PI * 2;
  const spawnDistance = Math.max(canvas.width, canvas.height);
  
  const randType = Math.random();
  let type = 'chaser';
  let size = 28;
  let speed = 2.5;
  let health = 1;
  let color = '#9b59b6';
  let scoreValue = 10;

  if (randType < 0.35) {
    type = 'scout';
    size = 20;
    speed = 4.2;
    health = 1;
    color = '#e67e22';
    scoreValue = 15;
  } else if (randType < 0.60) {
    type = 'shooter';
    size = 26;
    speed = 2.0;
    health = 2;
    color = '#2ecc71';
    scoreValue = 20;
  } else if (randType < 0.75) {
    type = 'tank';
    size = 44;
    speed = 1.2;
    health = 4;
    color = '#c0392b';
    scoreValue = 30;
  }

  enemies.push({
    x: player.x + Math.cos(angle) * spawnDistance,
    y: player.y + Math.sin(angle) * spawnDistance,
    size: size,
    speed: speed,
    health: health,
    maxHealth: health,
    color: color,
    type: type,
    scoreValue: scoreValue,
    shootCooldown: Math.random() * 2,
    stunnedTimer: 0
  });
}

function updateEnemies(dt) {
  const playerCenterX = player.x + player.size / 2;
  const playerCenterY = player.y + player.size / 2;

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    if (e.stunnedTimer > 0) {
      e.stunnedTimer -= dt;
      continue;
    }

    const enemyCenterX = e.x + e.size / 2;
    const enemyCenterY = e.y + e.size / 2;

    const dx = playerCenterX - enemyCenterX;
    const dy = playerCenterY - enemyCenterY;
    const distance = Math.hypot(dx, dy);

    let moveX = 0;
    let moveY = 0;

    if (e.type === 'shooter') {
      if (distance > 400) {
        moveX = (dx / distance) * e.speed;
        moveY = (dy / distance) * e.speed;
      } else if (distance < 250) {
        moveX = -(dx / distance) * e.speed;
        moveY = -(dy / distance) * e.speed;
      }

      e.shootCooldown -= dt;
      if (e.shootCooldown <= 0) {
        e.shootCooldown = 2.5;
        const angle = Math.atan2(playerCenterY - enemyCenterY, playerCenterX - enemyCenterX);
        enemyProjectiles.push({
          x: enemyCenterX - 4,
          y: enemyCenterY - 4,
          size: 8,
          vx: Math.cos(angle) * 5,
          vy: Math.sin(angle) * 5,
          color: '#2ecc71'
        });
      }
    } else {
      if (distance > 1) {
        moveX = (dx / distance) * e.speed;
        moveY = (dy / distance) * e.speed;
      }
    }

    e.x += moveX;
    let eBox = { x: e.x, y: e.y, width: e.size, height: e.size };
    for (const wall of obstacles) {
      if (isColliding(eBox, wall)) {
        if (moveX > 0) e.x = wall.x - e.size;
        else if (moveX < 0) e.x = wall.x + wall.width;
      }
    }

    e.y += moveY;
    eBox = { x: e.x, y: e.y, width: e.size, height: e.size };
    for (const wall of obstacles) {
      if (isColliding(eBox, wall)) {
        if (moveY > 0) e.y = wall.y - e.size;
        else if (moveY < 0) e.y = wall.y + wall.height;
      }
    }

    if (isColliding({ x: player.x, y: player.y, width: player.size, height: player.size }, 
                    { x: e.x, y: e.y, width: e.size, height: e.size })) {
      createExplosion(e.x + e.size / 2, e.y + e.size / 2, e.color);
      enemies.splice(i, 1);

      if (shieldTimer <= 0 && !player.isDashing) {
        playSound('hurt');
        triggerShake(0.3, 15);
        player.health -= 25;
        if (player.health <= 0) {
          handleGameOver();
        }
      }
    }
  }
}

// 11. Main Update Loop
function update() {
  if (gameState !== 'PLAYING') return;

  const now = performance.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) {
      comboCount = 0;
      comboMultiplier = 1;
    }
  }

  if (empCooldown > 0) empCooldown -= dt;

  spawnTimer -= dt;
  const currentSpawnInterval = Math.max(0.6, 2.5 - (score / 150));
  if (spawnTimer <= 0) {
    spawnEnemy();
    spawnTimer = currentSpawnInterval;
  }

  mapPowerupTimer -= dt;
  if (mapPowerupTimer <= 0) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 500 + 200;
    spawnPowerup(player.x + Math.cos(angle) * dist, player.y + Math.sin(angle) * dist);
    mapPowerupTimer = 6.0 + Math.random() * 4.0;
  }

  if (player.dashCooldown > 0) player.dashCooldown -= dt;
  if (player.isDashing) {
    player.dashTimer -= dt;
    if (player.dashTimer <= 0) {
      player.isDashing = false;
    }
  }

  let moveX = 0;
  let moveY = 0;

  if (keys.w || keys.ArrowUp) moveY -= 1;
  if (keys.s || keys.ArrowDown) moveY += 1;
  if (keys.a || keys.ArrowLeft) moveX -= 1;
  if (keys.d || keys.ArrowRight) moveX += 1;

  if (moveX !== 0 && moveY !== 0) {
    moveX *= 0.7071;
    moveY *= 0.7071;
  }

  const currentSpeed = player.isDashing ? player.speed * 3.2 : player.speed;

  player.x += moveX * currentSpeed;
  let playerBox = { x: player.x, y: player.y, width: player.size, height: player.size };
  for (const wall of obstacles) {
    if (isColliding(playerBox, wall)) {
      if (moveX > 0) player.x = wall.x - player.size;
      else if (moveX < 0) player.x = wall.x + wall.width;
    }
  }

  player.y += moveY * currentSpeed;
  playerBox = { x: player.x, y: player.y, width: player.size, height: player.size };
  for (const wall of obstacles) {
    if (isColliding(playerBox, wall)) {
      if (moveY > 0) player.y = wall.y - player.size;
      else if (moveY < 0) player.y = wall.y + wall.height;
    }
  }

  if (player.isDashing) {
    dashTrails.push({
      x: player.x,
      y: player.y,
      size: player.size,
      life: 1.0,
      color: player.color
    });
  }

  if (player.isDashing && Math.random() < 0.6) {
    particles.push({
      x: player.x + player.size / 2,
      y: player.y + player.size / 2,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      life: 0.5,
      color: '#ff4757'
    });
  }

  camera.x = player.x + player.size / 2 - canvas.width / 2;
  camera.y = player.y + player.size / 2 - canvas.height / 2;

  updateEnemies(dt);
  updateProjectiles(); 
  updateParticles();
  updatePowerups(dt);
}

// 12. Main Render Loop
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // --- IMPROVED MAIN MENU ---
  if (gameState === 'MENU') {
    ctx.fillStyle = '#0f0f13';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle background grid decoration
    ctx.strokeStyle = 'rgba(255, 71, 87, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Centered Cyber Menu Card Box
    const boxW = 600;
    const boxH = 420;
    const boxX = canvas.width / 2 - boxW / 2;
    const boxY = canvas.height / 2 - boxH / 2;

    ctx.fillStyle = 'rgba(20, 20, 28, 0.9)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = '#ff4757';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff4757';
    ctx.shadowBlur = 15;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.shadowBlur = 0;

    // Title
    ctx.fillStyle = '#ff4757';
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CYBER SURVIVOR', canvas.width / 2, boxY + 65);

    // Subtitle / High Score badge
    ctx.fillStyle = '#eccc68';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`ALL-TIME HIGH SCORE: ${highScore}`, canvas.width / 2, boxY + 110);

    // Controls container
    ctx.fillStyle = '#2f3542';
    ctx.fillRect(boxX + 40, boxY + 140, boxW - 80, 150);
    ctx.strokeStyle = '#00d2d3';
    ctx.strokeRect(boxX + 40, boxY + 140, boxW - 80, 150);

    ctx.fillStyle = '#00d2d3';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('--- COMBAT CONTROLS ---', canvas.width / 2, boxY + 170);

    ctx.fillStyle = '#ffffff';
    ctx.font = '13px monospace';
    ctx.fillText('Move: WASD / Arrow Keys', canvas.width / 2, boxY + 200);
    ctx.fillText('Aim & Shoot: Mouse / Left-Click / E', canvas.width / 2, boxY + 225);
    ctx.fillText('Dash: SPACEBAR  |  EMP Blast: Q', canvas.width / 2, boxY + 250);

    // Prompt to start
    ctx.fillStyle = '#2ed573';
    ctx.font = 'bold 16px monospace';
    const pulseAlpha = 0.5 + Math.abs(Math.sin(performance.now() / 300)) * 0.5;
    ctx.globalAlpha = pulseAlpha;
    ctx.fillText('>>> CLICK ANYWHERE OR PRESS ANY KEY TO START <<<', canvas.width / 2, boxY + 360);
    ctx.globalAlpha = 1.0;

    ctx.textAlign = 'left';
    return;
  }

  // --- IMPROVED GAME OVER / DEATH MENU ---
  if (gameState === 'GAMEOVER') {
    ctx.fillStyle = 'rgba(10, 10, 15, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const boxW = 540;
    const boxH = 400;
    const boxX = canvas.width / 2 - boxW / 2;
    const boxY = canvas.height / 2 - boxH / 2;

    ctx.fillStyle = 'rgba(25, 20, 25, 0.95)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = '#ff4757';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff4757';
    ctx.shadowBlur = 20;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.shadowBlur = 0;

    // Header
    ctx.fillStyle = '#ff4757';
    ctx.font = 'bold 42px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SYSTEM FAILURE', canvas.width / 2, boxY + 65);

    ctx.fillStyle = '#aaaaaa';
    ctx.font = '14px monospace';
    ctx.fillText('Operational vitals dropped to zero. Mission terminated.', canvas.width / 2, boxY + 95);

    // Stats Grid Box
    ctx.fillStyle = '#1e1e24';
    ctx.fillRect(boxX + 40, boxY + 125, boxW - 80, 140);
    ctx.strokeStyle = '#2f3542';
    ctx.strokeRect(boxX + 40, boxY + 125, boxW - 80, 140);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`FINAL SCORE: ${finalScore}`, canvas.width / 2, boxY + 160);

    ctx.fillStyle = '#eccc68';
    ctx.font = '14px monospace';
    ctx.fillText(`High Score: ${highScore}`, canvas.width / 2, boxY + 190);

    ctx.fillStyle = '#00d2d3';
    ctx.font = '14px monospace';
    ctx.fillText(`Enemies Neutralized: ${finalEnemiesDefeated}   |   Time Survived: ${gameTimeSurvived}s`, canvas.width / 2, boxY + 235);

    // Restart prompt
    ctx.fillStyle = '#2ed573';
    ctx.font = 'bold 16px monospace';
    const pulseAlpha = 0.5 + Math.abs(Math.sin(performance.now() / 300)) * 0.5;
    ctx.globalAlpha = pulseAlpha;
    ctx.fillText('>>> CLICK OR PRESS ANY KEY TO REBOOT <<<', canvas.width / 2, boxY + 335);
    ctx.globalAlpha = 1.0;

    ctx.textAlign = 'left';
    return;
  }

  ctx.save();
  
  let renderCamX = camera.x;
  let renderCamY = camera.y;
  if (shakeDuration > 0) {
    renderCamX += (Math.random() - 0.5) * shakeIntensity;
    renderCamY += (Math.random() - 0.5) * shakeIntensity;
    shakeDuration -= 0.016;
  }
  ctx.translate(-renderCamX, -renderCamY);

  // Dynamic Background Cyber Grid
  const gridSize = 100;
  const startX = Math.floor(camera.x / gridSize) * gridSize;
  const startY = Math.floor(camera.y / gridSize) * gridSize;
  
  ctx.strokeStyle = 'rgba(47, 53, 66, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = startX; x < camera.x + canvas.width + gridSize; x += gridSize) {
    ctx.moveTo(x, camera.y);
    ctx.lineTo(x, camera.y + canvas.height);
  }
  for (let y = startY; y < camera.y + canvas.height + gridSize; y += gridSize) {
    ctx.moveTo(camera.x, y);
    ctx.lineTo(camera.x + canvas.width, y);
  }
  ctx.stroke();

  // Draw Walls
  ctx.shadowBlur = 10;
  ctx.shadowColor = '#000000';
  for (const wall of obstacles) {
    if (wall.x + wall.width > camera.x && wall.x < camera.x + canvas.width &&
        wall.y + wall.height > camera.y && wall.y < camera.y + canvas.height) {
      ctx.fillStyle = wall.color;
      ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
    }
  }

  // Draw Power-Up Drops
  for (const p of powerups) {
    ctx.shadowBlur = 15;
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
    
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px monospace';
    let label = '3';
    if (p.type === 'RAPID') label = 'R';
    if (p.type === 'SHIELD') label = 'S';
    ctx.fillText(label, p.x + 7, p.y + 17);
  }

  // Draw Dash Trails (Ghost Rectangles)
  for (const dt of dashTrails) {
    ctx.globalAlpha = Math.max(0, dt.life * 0.4);
    ctx.fillStyle = dt.color;
    ctx.fillRect(dt.x, dt.y, dt.size, dt.size);
  }
  ctx.globalAlpha = 1.0;

  // Draw Particles
  ctx.shadowBlur = 10;
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 6, 6);
  }
  ctx.globalAlpha = 1.0;

  // Draw Projectiles
  ctx.shadowBlur = 15;
  for (const p of projectiles) {
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x + p.size/2, p.y + p.size/2, p.size/2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw Enemy Projectiles
  for (const ep of enemyProjectiles) {
    ctx.shadowColor = ep.color;
    ctx.fillStyle = ep.color;
    ctx.beginPath();
    ctx.arc(ep.x + ep.size/2, ep.y + ep.size/2, ep.size/2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw Enemies
  for (const e of enemies) {
    ctx.shadowColor = e.stunnedTimer > 0 ? '#00d2d3' : e.color;
    ctx.shadowBlur = e.stunnedTimer > 0 ? 25 : 20;
    ctx.fillStyle = e.stunnedTimer > 0 ? '#00d2d3' : e.color;
    ctx.fillRect(e.x, e.y, e.size, e.size);

    if (e.maxHealth > 1) {
      ctx.fillStyle = '#2f3542';
      ctx.fillRect(e.x, e.y - 8, e.size, 4);
      ctx.fillStyle = '#2ed573';
      ctx.fillRect(e.x, e.y - 8, e.size * (e.health / e.maxHealth), 4);
    }
  }

  // Draw Shield Aura Around Player
  if (shieldTimer > 0) {
    ctx.strokeStyle = '#00d2d3';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#00d2d3';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(player.x + player.size / 2, player.y + player.size / 2, player.size + 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw Player
  ctx.shadowColor = comboMultiplier > 1 ? '#eccc68' : player.color;
  ctx.shadowBlur = player.isDashing ? 30 : (comboMultiplier > 1 ? 12 + comboMultiplier * 6 : 20);
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.size, player.size);

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(player.x + 8, player.y + 8, 16, 16);

  ctx.restore();

  // --- HUD SPACE ---

  // Health Bar UI
  const barWidth = 200;
  const barHeight = 20;
  const barX = 20;
  const barY = 20;

  ctx.fillStyle = '#2f3542';
  ctx.fillRect(barX, barY, barWidth, barHeight);

  const healthRatio = Math.max(0, player.health / player.maxHealth);
  ctx.fillStyle = healthRatio > 0.3 ? '#2ed573' : '#ff4757';
  ctx.fillRect(barX, barY, barWidth * healthRatio, barHeight);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barWidth, barHeight);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`HP: ${player.health}/${player.maxHealth}`, barX + 55, barY + 14);

  // HUD Text
  ctx.shadowBlur = 0;
  ctx.font = 'bold 18px monospace';
  ctx.fillText(`Next Spawn: ${Math.max(0, Math.ceil(spawnTimer))}s`, 20, 65);
  ctx.font = '14px monospace';
  ctx.fillStyle = '#aaaaaa';
  ctx.fillText(`Enemies Alive: ${enemies.length}`, 20, 88);

  ctx.fillStyle = '#eccc68';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(`Score: ${score}`, 20, 115);

  if (comboMultiplier > 1) {
    ctx.fillStyle = '#fffa65';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`COMBO x${comboMultiplier} (${comboTimer.toFixed(1)}s)`, 20, 138);
  }

  // Weapon, Dash & EMP UI
  const currentTime = performance.now() / 1000;
  const activeCooldown = rapidFireTimer > 0 ? 0.2 : FIRE_COOLDOWN;
  const cooldownRemaining = Math.max(0, activeCooldown - (currentTime - lastShotTime));
  
  ctx.font = 'bold 14px monospace';
  let hudY = 162;
  if (comboMultiplier > 1) hudY = 184;

  if (cooldownRemaining > 0) {
    ctx.fillStyle = '#ff4757';
    ctx.fillText(`Weapon Cooldown: ${cooldownRemaining.toFixed(1)}s`, 20, hudY);
  } else {
    ctx.fillStyle = '#2ed573';
    ctx.fillText(`Weapon: READY (Click / 'E')`, 20, hudY);
  }
  hudY += 22;

  if (player.dashCooldown > 0) {
    ctx.fillStyle = '#ff4757';
    ctx.fillText(`Dash [SPACE]: ${player.dashCooldown.toFixed(1)}s`, 20, hudY);
  } else {
    ctx.fillStyle = '#2ed573';
    ctx.fillText(`Dash [SPACE]: READY`, 20, hudY);
  }
  hudY += 22;

  if (empCooldown > 0) {
    ctx.fillStyle = '#ff4757';
    ctx.fillText(`EMP Blast [Q]: ${empCooldown.toFixed(1)}s`, 20, hudY);
  } else {
    ctx.fillStyle = '#00d2d3';
    ctx.fillText(`EMP Blast [Q]: READY`, 20, hudY);
  }
  hudY += 22;

  // Active Power-Up Timers
  if (tripleShotTimer > 0) {
    ctx.fillStyle = '#1e90ff';
    ctx.fillText(`TRIPLE SHOT: ${tripleShotTimer.toFixed(1)}s`, 20, hudY);
    hudY += 22;
  }
  if (rapidFireTimer > 0) {
    ctx.fillStyle = '#fffa65';
    ctx.fillText(`RAPID FIRE: ${rapidFireTimer.toFixed(1)}s`, 20, hudY);
    hudY += 22;
  }
  if (shieldTimer > 0) {
    ctx.fillStyle = '#00d2d3';
    ctx.fillText(`SHIELD ACTIVE: ${shieldTimer.toFixed(1)}s`, 20, hudY);
  }

  // Minimap / Radar Overlay
  const radarRadius = 70;
  const radarX = canvas.width - radarRadius - 30;
  const radarY = radarRadius + 30;
  const radarScale = 0.08;

  ctx.save();
  ctx.fillStyle = 'rgba(20, 20, 25, 0.75)';
  ctx.strokeStyle = '#00d2d3';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(radarX, radarY, radarRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.clip();

  ctx.fillStyle = '#ff4757';
  ctx.fillRect(radarX - 2, radarY - 2, 4, 4);

  for (const p of powerups) {
    const relX = (p.x - player.x) * radarScale;
    const relY = (p.y - player.y) * radarScale;
    if (Math.hypot(relX, relY) < radarRadius) {
      ctx.fillStyle = p.color;
      ctx.fillRect(radarX + relX - 1.5, radarY + relY - 1.5, 3, 3);
    }
  }

  for (const e of enemies) {
    const relX = (e.x - player.x) * radarScale;
    const relY = (e.y - player.y) * radarScale;
    if (Math.hypot(relX, relY) < radarRadius) {
      ctx.fillStyle = e.color;
      ctx.fillRect(radarX + relX - 1.5, radarY + relY - 1.5, 3, 3);
    }
  }

  ctx.restore();

  ctx.strokeStyle = 'rgba(0, 210, 211, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(radarX, radarY, radarRadius, 0, Math.PI * 2);
  ctx.stroke();
}

// 13. Core Game Loop
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();