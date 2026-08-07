// 1. Setup Canvas & Fullscreen
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth || 800;
  canvas.height = window.innerHeight || 600;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Initial sizing

// 2. Game State Management
let gameState = 'MENU'; // 'MENU', 'PLAYING', 'UPGRADE', or 'GAMEOVER'
let highScore = localStorage.getItem('cyberSurvivorHighScore') || 0;
let finalScore = 0;
let finalEnemiesDefeated = 0;
let gameTimeSurvived = 0;
let runStartTime = 0;
let waveNumber = 1;
let bossSpawned = false;

// Combo / Multi-Kill System State
let comboCount = 0;
let comboTimer = 0;
let comboMultiplier = 1;

// EMP Blast State
let empCooldown = 0;

// Upgrade/Skill Tree System
let upgradePoints = 0;
const upgrades = {
  damage: { level: 0, maxLevel: 5, cost: [1, 2, 3, 4, 5], value: [1.2, 1.4, 1.6, 1.8, 2.0] },
  fireRate: { level: 0, maxLevel: 5, cost: [1, 2, 3, 4, 5], value: [0.85, 0.7, 0.55, 0.4, 0.3] },
  speed: { level: 0, maxLevel: 5, cost: [1, 2, 3, 4, 5], value: [5.0, 5.5, 6.0, 6.5, 7.0] },
  health: { level: 0, maxLevel: 5, cost: [1, 2, 3, 4, 5], value: [120, 140, 160, 180, 200] },
  dash: { level: 0, maxLevel: 3, cost: [2, 3, 4], value: [1.0, 0.8, 0.6] },
  emp: { level: 0, maxLevel: 3, cost: [2, 3, 4], value: [10.0, 8.0, 6.0] },
  pierce: { level: 0, maxLevel: 3, cost: [3, 4, 5], value: [1, 2, 3] },
  lifesteal: { level: 0, maxLevel: 3, cost: [3, 4, 5], value: [0.02, 0.04, 0.06] }
};
let showingUpgradeMenu = false;

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
  
  // Don't play background music here
  if (type === 'music') return;

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

// Background music
let musicOsc = null;
let musicGain = null;
let musicNotes = [110, 130.81, 146.83, 164.81, 196, 220, 246.94];
let musicIndex = 0;
let musicTimer = 0;

function startMusic() {
  if (!audioCtx || musicOsc) return;
  
  musicGain = audioCtx.createGain();
  musicGain.gain.value = 0.03;
  musicGain.connect(audioCtx.destination);
  
  playMusicNote();
}

function playMusicNote() {
  if (!audioCtx || !musicGain) return;
  
  musicOsc = audioCtx.createOscillator();
  musicOsc.type = 'sine';
  musicOsc.frequency.value = musicNotes[musicIndex % musicNotes.length];
  musicOsc.connect(musicGain);
  
  const now = audioCtx.currentTime;
  musicGain.gain.setValueAtTime(0.03, now);
  musicGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
  
  musicOsc.start(now);
  musicOsc.stop(now + 1.5);
  
  musicOsc.onended = () => {
    musicOsc = null;
    musicIndex++;
    setTimeout(playMusicNote, 200);
  };
}

function stopMusic() {
  if (musicOsc) {
    musicOsc.stop();
    musicOsc = null;
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
  if (gameState === 'UPGRADE') {
    handleUpgradeClick(e.clientX, e.clientY);
    return;
  }
  if (e.button === 0) fireProjectile();
});

canvas.addEventListener('touchstart', (e) => {
  initAudio();
  e.preventDefault();
  if (gameState === 'MENU' || gameState === 'GAMEOVER') {
    gameState = 'PLAYING';
    resetGame();
    return;
  }
  if (gameState === 'UPGRADE') {
    const touch = e.touches[0];
    handleUpgradeClick(touch.clientX, touch.clientY);
    return;
  }
  
  for (const touch of e.changedTouches) {
    const x = touch.clientX;
    const y = touch.clientY;
    
    // Check fire button
    if (Math.hypot(x - fireButton.x, y - fireButton.y) < fireButton.radius) {
      fireButton.pressed = true;
      touches[touch.identifier] = { type: 'fire', x, y };
      continue;
    }
    
    // Check dash button
    if (Math.hypot(x - dashButton.x, y - dashButton.y) < dashButton.radius) {
      tryDash();
      touches[touch.identifier] = { type: 'dash', x, y };
      continue;
    }
    
    // Check EMP button
    if (Math.hypot(x - empButton.x, y - empButton.y) < empButton.radius) {
      tryEmpBlast();
      touches[touch.identifier] = { type: 'emp', x, y };
      continue;
    }
    
    // Joystick (left side)
    if (x < canvas.width / 2) {
      joystick.active = true;
      joystick.startX = x;
      joystick.startY = y;
      joystick.currentX = x;
      joystick.currentY = y;
      touches[touch.identifier] = { type: 'move', x, y };
    }
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (const touch of e.changedTouches) {
    const touchData = touches[touch.identifier];
    if (!touchData) continue;
    
    if (touchData.type === 'move') {
      joystick.currentX = touch.clientX;
      joystick.currentY = touch.clientY;
    } else if (touchData.type === 'fire') {
      // Keep fire button pressed if still over it
      const x = touch.clientX;
      const y = touch.clientY;
      fireButton.pressed = Math.hypot(x - fireButton.x, y - fireButton.y) < fireButton.radius;
    }
  }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  for (const touch of e.changedTouches) {
    const touchData = touches[touch.identifier];
    if (!touchData) continue;
    
    if (touchData.type === 'move') {
      joystick.active = false;
    } else if (touchData.type === 'fire') {
      fireButton.pressed = false;
    }
    delete touches[touch.identifier];
  }
}, { passive: false });

// Handle window resize for touch controls
window.addEventListener('resize', () => {
  resizeCanvas();
  setupTouchControls();
});

// 6. Game Objects & Buffs
let score = 0;
let enemiesDefeatedCount = 0;
const particles = [];
const dashTrails = [];
const powerups = [];
const floatingTexts = [];
const screenEffects = [];

let tripleShotTimer = 0;
let rapidFireTimer = 0;
let shieldTimer = 0;
let pierceTimer = 0;
let lifestealTimer = 0;

let lastShotTime = 0;
const FIRE_COOLDOWN = 0.8; 

let mapPowerupTimer = 6.0;

const player = {
  x: 0,
  y: 0,
  size: 32,
  speed: 4.5,
  color: '#ff4757',
  health: 130,
  maxHealth: 130,
  isDashing: false,
  dashTimer: 0,
  dashCooldown: 0,
  damageMultiplier: 1.0,
  pierceCount: 0,
  lifestealRate: 0,
  invulnTimer: 0
};

// Enemy System
const enemies = [];
let spawnTimer = 2.5;
let lastTime = performance.now();

// Touch Controls
const touches = {};
const joystick = { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0, deadzone: 30 };
const fireButton = { x: 0, y: 0, radius: 60, pressed: false };
const dashButton = { x: 0, y: 0, radius: 50, pressed: false };
const empButton = { x: 0, y: 0, radius: 50, pressed: false };

function setupTouchControls() {
  fireButton.x = canvas.width - 80;
  fireButton.y = canvas.height - 80;
  dashButton.x = 80;
  dashButton.y = canvas.height - 80;
  empButton.x = canvas.width - 80;
  empButton.y = 160;
}
setupTouchControls();

// Infinite Random Obstacles
const obstacles = [];
const wallAccents = ['#00d2d3', '#9c27b0', '#ff4757', '#2ed573', '#1e90ff'];
for (let i = 0; i < 2000; i++) {
  obstacles.push({
    x: (Math.random() - 0.5) * 15000,
    y: (Math.random() - 0.5) * 15000,
    width: Math.random() * 150 + 50,
    height: Math.random() * 150 + 50,
    color: '#2f3542',
    accent: wallAccents[Math.floor(Math.random() * wallAccents.length)],
    rivetSeed: Math.random() * 1000
  });
}

// Parallax Starfield Texture (3 depth layers for a sense of scale)
function makeStarLayer(count, spread) {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: (Math.random() - 0.5) * spread,
      y: (Math.random() - 0.5) * spread,
      size: Math.random() * 1.8 + 0.4,
      twinkleSeed: Math.random() * 1000,
      color: Math.random() < 0.15 ? '#00d2d3' : (Math.random() < 0.3 ? '#9c27b0' : '#ffffff')
    });
  }
  return stars;
}
const starLayers = [
  { stars: makeStarLayer(220, 20000), parallax: 0.15 },
  { stars: makeStarLayer(160, 20000), parallax: 0.35 },
  { stars: makeStarLayer(90, 20000), parallax: 0.6 }
];

// Cached diagonal hazard-stripe pattern (used as a texture fill on walls)
const stripePatternCanvas = document.createElement('canvas');
stripePatternCanvas.width = 16;
stripePatternCanvas.height = 16;
const stripeCtx = stripePatternCanvas.getContext('2d');
stripeCtx.fillStyle = 'rgba(255, 255, 255, 0.05)';
stripeCtx.fillRect(0, 0, 16, 16);
stripeCtx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
stripeCtx.lineWidth = 4;
stripeCtx.beginPath();
stripeCtx.moveTo(-4, 20);
stripeCtx.lineTo(20, -4);
stripeCtx.moveTo(4, 20);
stripeCtx.lineTo(20, 4);
stripeCtx.stroke();
const stripePattern = ctx.createPattern(stripePatternCanvas, 'repeat');

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
  player.maxHealth = 130;
  player.health = player.maxHealth;
  player.damageMultiplier = 1.0;
  player.pierceCount = 0;
  player.lifestealRate = 0;
  player.invulnTimer = 0;
  player.speed = 4.5 + (upgrades.speed.value[upgrades.speed.level] || 0);
  enemies.length = 0;
  enemyProjectiles.length = 0;
  powerups.length = 0;
  projectiles.length = 0;
  dashTrails.length = 0;
  particles.length = 0;
  floatingTexts.length = 0;
  screenEffects.length = 0;
  score = 0;
  enemiesDefeatedCount = 0;
  waveNumber = 1;
  bossSpawned = false;
  runStartTime = performance.now();
  comboCount = 0;
  comboMultiplier = 1;
  comboTimer = 0;
  empCooldown = 0;
  tripleShotTimer = 0;
  rapidFireTimer = 0;
  shieldTimer = 0;
  pierceTimer = 0;
  lifestealTimer = 0;
  mapPowerupTimer = 6.0;
  lastTime = performance.now();
  upgradePoints = 0;
  showingUpgradeMenu = false;
  
  // Reset upgrade levels for new run
  Object.keys(upgrades).forEach(key => upgrades[key].level = 0);
  
  // Start background music
  startMusic();
}

function handleGameOver() {
  finalScore = score;
  finalEnemiesDefeated = enemiesDefeatedCount;
  gameTimeSurvived = ((performance.now() - runStartTime) / 1000).toFixed(1);
  if (finalScore > highScore) {
    highScore = finalScore;
    localStorage.setItem('cyberSurvivorHighScore', highScore);
  }
  stopMusic();
  gameState = 'GAMEOVER';
}

// Upgrade System
function showUpgradeMenu() {
  if (upgradePoints <= 0) return;
  gameState = 'UPGRADE';
  showingUpgradeMenu = true;
}

function handleUpgradeClick(x, y) {
  const boxW = 700;
  const boxH = 500;
  const boxX = canvas.width / 2 - boxW / 2;
  const boxY = canvas.height / 2 - boxH / 2;
  
  const upgradeList = Object.keys(upgrades);
  const itemHeight = 60;
  const startY = boxY + 100;
  
  for (let i = 0; i < upgradeList.length; i++) {
    const key = upgradeList[i];
    const upg = upgrades[key];
    const itemY = startY + i * itemHeight;
    const buyBtnX = boxX + boxW - 120;
    const buyBtnY = itemY + 10;
    const buyBtnW = 100;
    const buyBtnH = 40;
    
    if (x >= buyBtnX && x <= buyBtnX + buyBtnW && 
        y >= buyBtnY && y <= buyBtnY + buyBtnH) {
      applyUpgrade(key);
      break;
    }
  }
  
  // Close button
  const closeX = boxX + boxW - 40;
  const closeY = boxY + 20;
  if (x >= closeX && x <= closeX + 30 && y >= closeY && y <= closeY + 30) {
    gameState = 'PLAYING';
    showingUpgradeMenu = false;
  }
}

function applyUpgrade(key) {
  const upg = upgrades[key];
  if (upg.level >= upg.maxLevel) return;
  const cost = upg.cost[upg.level];
  if (upgradePoints < cost) return;
  
  upgradePoints -= cost;
  upg.level++;
  
  // Apply upgrade effects
  switch(key) {
    case 'damage':
      player.damageMultiplier = upg.value[upg.level - 1];
      break;
    case 'fireRate':
      // Handled in fireProjectile
      break;
    case 'speed':
      player.speed = upg.value[upg.level - 1];
      break;
    case 'health':
      player.maxHealth = upg.value[upg.level - 1];
      player.health = player.maxHealth;
      break;
    case 'dash':
      player.dashCooldown = upg.value[upg.level - 1];
      break;
    case 'emp':
      // Handled in tryEmpBlast
      break;
    case 'pierce':
      // Handled in updateProjectiles
      break;
    case 'lifesteal':
      // Handled in updateProjectiles
      break;
  }
  
  playSound('powerup');
  floatingTexts.push({
    x: player.x + player.size/2, y: player.y - 50,
    text: `${key.toUpperCase()} LEVEL ${upg.level}!`, color: '#00d2d3',
    life: 2.0, vy: -30
  });
  
  if (upgradePoints <= 0) {
    gameState = 'PLAYING';
    showingUpgradeMenu = false;
  }
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

  if (rand < 0.2) {
    type = 'TRIPLE';
    color = '#1e90ff';
  } else if (rand < 0.35) {
    type = 'RAPID';
    color = '#fffa65';
  } else if (rand < 0.5) {
    type = 'SHIELD';
    color = '#00d2d3';
  } else if (rand < 0.6) {
    type = 'PIERCE';
    color = '#ff6b35';
  } else if (rand < 0.7) {
    type = 'LIFESTEAL';
    color = '#e91e63';
  } else if (rand < 0.8) {
    type = 'NUKE';
    color = '#ff1744';
  } else if (rand < 0.9) {
    type = 'TIME';
    color = '#9c27b0';
  } else {
    type = 'XP';
    color = '#4caf50';
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
  if (pierceTimer > 0) pierceTimer -= dt;
  if (lifestealTimer > 0) lifestealTimer -= dt;

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
      if (p.type === 'PIERCE') {
        pierceTimer = 6.0;
        player.pierceCount = 2;
      }
      if (p.type === 'LIFESTEAL') {
        lifestealTimer = 10.0;
        player.lifestealRate = 0.05;
      }
      if (p.type === 'NUKE') {
        playSound('emp');
        triggerShake(0.5, 25);
        for (let j = enemies.length - 1; j >= 0; j--) {
          const e = enemies[j];
          createExplosion(e.x + e.size / 2, e.y + e.size / 2, e.color);
          score += (e.scoreValue || 10) * comboMultiplier;
          enemiesDefeatedCount++;
        }
        enemies.length = 0;
        enemyProjectiles.length = 0;
      }
      if (p.type === 'TIME') {
        screenEffects.push({ type: 'slowmo', timer: 5.0 });
        for (const e of enemies) {
          e.speed *= 0.3;
          e.slowed = true;
        }
      }
      if (p.type === 'XP') {
        upgradePoints += 2;
        floatingTexts.push({
          x: player.x + player.size/2,
          y: player.y,
          text: '+2 UPGRADE POINTS',
          color: '#4caf50',
          life: 2.0,
          vy: -30
        });
        if (upgradePoints >= 3) showUpgradeMenu();
      }
      powerups.splice(i, 1);
    }
  }
  
  // Restore enemy speeds after time powerup
  if (screenEffects.some(e => e.type === 'slowmo')) {
    for (const e of enemies) {
      if (e.slowed && !screenEffects.some(se => se.type === 'slowmo')) {
        e.speed = e.baseSpeed || e.speed;
        e.slowed = false;
      }
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
  let activeCooldown = rapidFireTimer > 0 ? 0.2 : FIRE_COOLDOWN;
  if (upgrades.fireRate.level > 0) {
    activeCooldown *= upgrades.fireRate.value[upgrades.fireRate.level - 1];
  }

  if (currentTime - lastShotTime < activeCooldown) {
    return;
  }

  playSound('shoot');

  const playerCenterX = player.x + player.size / 2;
  const playerCenterY = player.y + player.size / 2;
  
  let worldMouseX, worldMouseY;
  if (joystick.active) {
    // Auto-aim towards nearest enemy for touch
    let nearest = null;
    let nearestDist = Infinity;
    for (const e of enemies) {
      const dx = e.x + e.size/2 - playerCenterX;
      const dy = e.y + e.size/2 - playerCenterY;
      const dist = Math.hypot(dx, dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = e;
      }
    }
    if (nearest) {
      worldMouseX = nearest.x + nearest.size/2;
      worldMouseY = nearest.y + nearest.size/2;
    } else {
      worldMouseX = playerCenterX + 100;
      worldMouseY = playerCenterY;
    }
  } else {
    worldMouseX = mouse.x + camera.x;
    worldMouseY = mouse.y + camera.y;
  }

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
      color: rapidFireTimer > 0 ? '#fffa65' : '#eccc68',
      pierce: player.pierceCount || 0
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
    let pierceRemaining = player.pierceCount || 0;

    for (const wall of obstacles) {
      if (isColliding(pBox, wall)) {
        destroyed = true;
        break;
      }
    }
    
    if (!destroyed) {
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (e.phased) continue;
        
        if (isColliding(pBox, { x: e.x, y: e.y, width: e.size, height: e.size })) {
          const damage = Math.ceil((1 * (player.damageMultiplier || 1)));
          e.health -= damage;
          
          if (e.health <= 0) {
            createExplosion(e.x + e.size / 2, e.y + e.size / 2, e.color);
            if (Math.random() < 0.35) {
              spawnPowerup(e.x + e.size / 2, e.y + e.size / 2);
            }
            
            // Splitter death effect
            if (e.specialAbility === 'split' && e.size > 15) {
              for (let s = 0; s < 3; s++) {
                const angle = (Math.PI * 2 / 3) * s;
                enemies.push({
                  x: e.x + e.size/2, y: e.y + e.size/2,
                  size: e.size * 0.5, speed: e.speed * 1.5,
                  health: 1, maxHealth: 1, color: e.color,
                  type: 'mini_splitter', scoreValue: 5,
                  specialAbility: null, shootCooldown: 0,
                  stunnedTimer: 0, baseSpeed: e.speed * 1.5
                });
              }
            }
            
            // Bomber death explosion
            if (e.specialAbility === 'explode' || e.type === 'bomber') {
              createExplosion(e.x + e.size / 2, e.y + e.size / 2, '#ff3300');
              triggerShake(0.3, 15);
              for (let k = enemies.length - 1; k >= 0; k--) {
                const e2 = enemies[k];
                if (e2 !== e && Math.hypot(e2.x - e.x, e2.y - e.y) < 150) {
                  e2.health -= 2;
                  if (e2.health <= 0) {
                    createExplosion(e2.x + e2.size/2, e2.y + e2.size/2, e2.color);
                    enemies.splice(k, 1);
                    enemiesDefeatedCount++;
                    score += (e2.scoreValue || 10) * comboMultiplier;
                  }
                }
              }
            }
            
            enemies.splice(j, 1);
            enemiesDefeatedCount++;
            
            if (e.type === 'boss') {
              bossSpawned = false;
              upgradePoints += 5;
              waveNumber++;
              floatingTexts.push({
                x: e.x + e.size/2, y: e.y,
                text: `BOSS DEFEATED! +5 UPGRADE POINTS`, color: '#ffd700',
                life: 3.0, vy: -40
              });
              showUpgradeMenu();
            } else {
              comboCount++;
              comboTimer = 2.5; 
              comboMultiplier = Math.min(5, 1 + Math.floor(comboCount / 3));
              score += (e.scoreValue || 10) * comboMultiplier;
              
              // Life steal
              if (player.lifestealRate > 0) {
                player.health = Math.min(player.maxHealth, player.health + 5);
                floatingTexts.push({
                  x: e.x + e.size/2, y: e.y,
                  text: `+5 HP`, color: '#e91e63', life: 1.0, vy: -20
                });
              }
            }
          }

          destroyed = true;
          pierceRemaining--;
          if (pierceRemaining <= 0) break;
        }
      }
    }

    if (destroyed && pierceRemaining <= 0) {
      projectiles.splice(i, 1);
    } else if (destroyed) {
      // Continue with reduced pierce
      p.pierce = pierceRemaining;
    }
  }

  for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
    const ep = enemyProjectiles[i];
    
    if (ep.homing) {
      const dx = (player.x + player.size/2) - (ep.x + ep.size/2);
      const dy = (player.y + player.size/2) - (ep.y + ep.size/2);
      const dist = Math.hypot(dx, dy);
      if (dist > 0) {
        ep.vx += (dx/dist) * 0.5;
        ep.vy += (dy/dist) * 0.5;
        const speed = Math.hypot(ep.vx, ep.vy);
        if (speed > 8) {
          ep.vx = (ep.vx/speed) * 8;
          ep.vy = (ep.vy/speed) * 8;
        }
      }
    }
    
    ep.x += ep.vx;
    ep.y += ep.vy;

    const epBox = { x: ep.x, y: ep.y, width: ep.size, height: ep.size };
    const playerBox = { x: player.x, y: player.y, width: player.size, height: player.size };

    if (isColliding(epBox, playerBox)) {
      enemyProjectiles.splice(i, 1);
      if (ep.void) {
        player.speed *= 0.5;
        setTimeout(() => { player.speed = 4.5 + upgrades.speed.value[upgrades.speed.level] || 0; }, 3000);
      }
      if (shieldTimer <= 0 && !player.isDashing && player.invulnTimer <= 0) {
        playSound('hurt');
        triggerShake(0.3, 15);
        player.health -= 12;
        player.invulnTimer = 0.6;
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
function spawnEnemy(isBoss = false) {
  const angle = Math.random() * Math.PI * 2;
  const spawnDistance = Math.max(canvas.width, canvas.height);
  
  if (isBoss) {
    const bossTypes = ['TITAN', 'SWARM_LEADER', 'VOID_WALKER'];
    const bossType = bossTypes[Math.floor(Math.random() * bossTypes.length)];
    
    let size, speed, health, color, scoreValue, behavior;
    
    switch(bossType) {
      case 'TITAN':
        size = 80; speed = 0.8; health = 50; color = '#8b0000'; scoreValue = 500; behavior = 'charge';
        break;
      case 'SWARM_LEADER':
        size = 60; speed = 1.5; health = 30; color = '#4b0082'; scoreValue = 400; behavior = 'summon';
        break;
      case 'VOID_WALKER':
        size = 50; speed = 2.0; health = 25; color = '#000033'; scoreValue = 450; behavior = 'teleport';
        break;
    }
    
    enemies.push({
      x: player.x + Math.cos(angle) * spawnDistance,
      y: player.y + Math.sin(angle) * spawnDistance,
      size: size,
      speed: speed,
      health: health,
      maxHealth: health,
      color: color,
      type: 'boss',
      bossType: bossType,
      behavior: behavior,
      scoreValue: scoreValue,
      shootCooldown: 1.0,
      stunnedTimer: 0,
      phase: 1,
      specialTimer: 0,
      baseSpeed: speed
    });
    bossSpawned = true;
    return;
  }
  
  const randType = Math.random();
  let type = 'chaser';
  let size = 28;
  let speed = 2.5;
  let health = 1;
  let color = '#9b59b6';
  let scoreValue = 10;
  let specialAbility = null;

  if (randType < 0.25) {
    type = 'scout';
    size = 20;
    speed = 4.2;
    health = 1;
    color = '#e67e22';
    scoreValue = 15;
    specialAbility = 'dash';
  } else if (randType < 0.45) {
    type = 'shooter';
    size = 26;
    speed = 2.0;
    health = 2;
    color = '#2ecc71';
    scoreValue = 20;
  } else if (randType < 0.6) {
    type = 'tank';
    size = 44;
    speed = 1.2;
    health = 4;
    color = '#c0392b';
    scoreValue = 30;
    specialAbility = 'armor';
  } else if (randType < 0.7) {
    type = 'splitter';
    size = 30;
    speed = 2.5;
    health = 2;
    color = '#ff6b35';
    scoreValue = 25;
    specialAbility = 'split';
  } else if (randType < 0.8) {
    type = 'sniper';
    size = 24;
    speed = 1.0;
    health = 1;
    color = '#ffd700';
    scoreValue = 35;
    specialAbility = 'snipe';
  } else if (randType < 0.88) {
    type = 'bomber';
    size = 36;
    speed = 1.8;
    health = 3;
    color = '#ff3300';
    scoreValue = 40;
    specialAbility = 'explode';
  } else {
    type = 'phantom';
    size = 28;
    speed = 3.0;
    health = 2;
    color = '#8e24aa';
    scoreValue = 30;
    specialAbility = 'phase';
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
    specialAbility: specialAbility,
    scoreValue: scoreValue,
    shootCooldown: Math.random() * 2,
    stunnedTimer: 0,
    phaseTimer: 0,
    baseSpeed: speed,
    lastPlayerPos: { x: player.x, y: player.y }
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

    if (e.type === 'boss') {
      // Boss behaviors
      e.specialTimer -= dt;
      
      if (e.bossType === 'TITAN') {
        if (distance > 200) {
          moveX = (dx / distance) * e.speed;
          moveY = (dy / distance) * e.speed;
        }
        
        if (e.specialTimer <= 0) {
          // Charge attack
          if (distance < 400) {
            e.speed = e.baseSpeed * 4;
            e.specialTimer = 0.5;
            setTimeout(() => { e.speed = e.baseSpeed; }, 500);
          }
          e.specialTimer = 3.0;
        }
        
        e.shootCooldown -= dt;
        if (e.shootCooldown <= 0) {
          e.shootCooldown = 1.5;
          // Spread shot
          for (let a = -0.5; a <= 0.5; a += 0.25) {
            const angle = Math.atan2(dy, dx) + a;
            enemyProjectiles.push({
              x: enemyCenterX - 6,
              y: enemyCenterY - 6,
              size: 12,
              vx: Math.cos(angle) * 6,
              vy: Math.sin(angle) * 6,
              color: e.color
            });
          }
        }
      } else if (e.bossType === 'SWARM_LEADER') {
        if (distance > 300) {
          moveX = (dx / distance) * e.speed;
          moveY = (dy / distance) * e.speed;
        } else if (distance < 200) {
          moveX = -(dx / distance) * e.speed;
          moveY = -(dy / distance) * e.speed;
        }
        
        if (e.specialTimer <= 0 && enemies.filter(en => en.type !== 'boss').length < 15) {
          // Summon minions
          for (let s = 0; s < 3; s++) {
            spawnEnemy();
            enemies[enemies.length - 1].size *= 0.7;
            enemies[enemies.length - 1].health = 1;
            enemies[enemies.length - 1].maxHealth = 1;
            enemies[enemies.length - 1].scoreValue = 5;
          }
          e.specialTimer = 5.0;
        }
        
        e.shootCooldown -= dt;
        if (e.shootCooldown <= 0) {
          e.shootCooldown = 2.0;
          const angle = Math.atan2(dy, dx);
          enemyProjectiles.push({
            x: enemyCenterX - 4,
            y: enemyCenterY - 4,
            size: 10,
            vx: Math.cos(angle) * 7,
            vy: Math.sin(angle) * 7,
            color: e.color,
            homing: true
          });
        }
      } else if (e.bossType === 'VOID_WALKER') {
        if (distance > 150) {
          moveX = (dx / distance) * e.speed;
          moveY = (dy / distance) * e.speed;
        }
        
        if (e.specialTimer <= 0 && distance < 300) {
          // Teleport behind player
          const teleportAngle = Math.atan2(dy, dx) + Math.PI;
          e.x = playerCenterX + Math.cos(teleportAngle) * 100 - e.size/2;
          e.y = playerCenterY + Math.sin(teleportAngle) * 100 - e.size/2;
          triggerShake(0.2, 15);
          for (let p = 0; p < 20; p++) {
            particles.push({
              x: enemyCenterX, y: enemyCenterY,
              vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10,
              life: 0.5, color: '#9c27b0'
            });
          }
          e.specialTimer = 4.0;
        }
        
        e.shootCooldown -= dt;
        if (e.shootCooldown <= 0) {
          e.shootCooldown = 1.0;
          // Void projectiles that slow player
          enemyProjectiles.push({
            x: enemyCenterX - 4,
            y: enemyCenterY - 4,
            size: 8,
            vx: (dx/distance) * 5,
            vy: (dy/distance) * 5,
            color: '#9c27b0',
            void: true
          });
        }
      }
    } else {
      // Regular enemy behaviors
      if (e.specialAbility === 'dash' && e.type === 'scout') {
        e.phaseTimer -= dt;
        if (distance < 200 && e.phaseTimer <= 0) {
          const dashAngle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.0;
          moveX = Math.cos(dashAngle) * e.speed * 3;
          moveY = Math.sin(dashAngle) * e.speed * 3;
          e.phaseTimer = 2.0;
          for (let p = 0; p < 5; p++) {
            particles.push({
              x: enemyCenterX, y: enemyCenterY,
              vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5,
              life: 0.3, color: e.color
            });
          }
        } else if (distance > 1) {
          moveX = (dx / distance) * e.speed;
          moveY = (dy / distance) * e.speed;
        }
      } else if (e.specialAbility === 'split') {
        if (distance > 1) {
          moveX = (dx / distance) * e.speed;
          moveY = (dy / distance) * e.speed;
        }
      } else if (e.specialAbility === 'snipe') {
        if (distance > 400) {
          moveX = (dx / distance) * e.speed;
          moveY = (dy / distance) * e.speed;
        } else if (distance < 300) {
          moveX = -(dx / distance) * e.speed;
          moveY = -(dy / distance) * e.speed;
        }
        
        e.shootCooldown -= dt;
        if (e.shootCooldown <= 0) {
          e.shootCooldown = 3.0;
          // Warning laser
          screenEffects.push({ type: 'warning', x: enemyCenterX, y: enemyCenterY, angle: Math.atan2(dy, dx), timer: 1.0 });
          setTimeout(() => {
            if (gameState === 'PLAYING') {
              enemyProjectiles.push({
                x: enemyCenterX - 3,
                y: enemyCenterY - 3,
                size: 6,
                vx: (dx/distance) * 15,
                vy: (dy/distance) * 15,
                color: '#ffd700',
                piercing: true
              });
            }
          }, 1000);
        }
      } else if (e.specialAbility === 'bomber') {
        if (distance > 1) {
          moveX = (dx / distance) * e.speed;
          moveY = (dy / distance) * e.speed;
        }
      } else if (e.specialAbility === 'phase') {
        e.phaseTimer -= dt;
        if (e.phaseTimer <= 0) {
          e.phased = !e.phased;
          e.phaseTimer = 2.0 + Math.random() * 2.0;
        }
        if (distance > 1) {
          moveX = (dx / distance) * e.speed;
          moveY = (dy / distance) * e.speed;
        }
      } else if (e.type === 'shooter') {
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
    }

    // Apply movement with collision
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

    // Player collision
    if (isColliding({ x: player.x, y: player.y, width: player.size, height: player.size }, 
                    { x: e.x, y: e.y, width: e.size, height: e.size })) {
      if (e.specialAbility === 'explode' || e.type === 'bomber') {
        createExplosion(e.x + e.size / 2, e.y + e.size / 2, e.color);
        enemies.splice(i, 1);
        if (shieldTimer <= 0 && !player.isDashing && player.invulnTimer <= 0) {
          triggerShake(0.4, 20);
          player.health -= 18;
          player.invulnTimer = 0.6;
          if (player.health <= 0) handleGameOver();
        }
        continue;
      }
      
      if (e.type === 'boss') {
        createExplosion(e.x + e.size / 2, e.y + e.size / 2, e.color);
        if (shieldTimer <= 0 && !player.isDashing && player.invulnTimer <= 0) {
          playSound('hurt');
          triggerShake(0.3, 15);
          player.health -= 22;
          player.invulnTimer = 0.6;
          if (player.health <= 0) handleGameOver();
        }
      } else {
        createExplosion(e.x + e.size / 2, e.y + e.size / 2, e.color);
        enemies.splice(i, 1);

        if (shieldTimer <= 0 && !player.isDashing && player.invulnTimer <= 0) {
          playSound('hurt');
          triggerShake(0.3, 15);
          player.health -= 15;
          player.invulnTimer = 0.6;
          if (player.health <= 0) handleGameOver();
        }
      }
    }
  }
}

// 11. Main Update Loop
function update() {
  if (gameState === 'UPGRADE') return;
  if (gameState !== 'PLAYING') return;

  const now = performance.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  // Difficulty scaling
  const difficulty = 1 + (waveNumber - 1) * 0.1 + (score / 3500);
  const maxEnemies = Math.min(18 + waveNumber * 2, 40);

  if (player.invulnTimer > 0) player.invulnTimer -= dt;

  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) {
      comboCount = 0;
      comboMultiplier = 1;
    }
  }

  if (empCooldown > 0) empCooldown -= dt;

  spawnTimer -= dt;
  const currentSpawnInterval = Math.max(0.7, 2.9 / difficulty - (score / 400));
  if (spawnTimer <= 0 && enemies.filter(e => e.type !== 'boss').length < maxEnemies) {
    spawnEnemy();
    spawnTimer = currentSpawnInterval;
  }

  // Boss spawning
  if (!bossSpawned && enemiesDefeatedCount > 0 && enemiesDefeatedCount % 25 === 0) {
    spawnEnemy(true);
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

  // Touch movement
  let moveX = 0;
  let moveY = 0;

  if (joystick.active) {
    const dx = joystick.currentX - joystick.startX;
    const dy = joystick.currentY - joystick.startY;
    const dist = Math.hypot(dx, dy);
    if (dist > joystick.deadzone) {
      moveX = dx / dist;
      moveY = dy / dist;
    }
  } else {
    if (keys.w || keys.ArrowUp) moveY -= 1;
    if (keys.s || keys.ArrowDown) moveY += 1;
    if (keys.a || keys.ArrowLeft) moveX -= 1;
    if (keys.d || keys.ArrowRight) moveX += 1;
  }

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

  // Update floating texts
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.x += 0;
    ft.y += ft.vy * dt;
    ft.vy *= 0.95;
    ft.life -= dt;
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }

  // Update screen effects
  for (let i = screenEffects.length - 1; i >= 0; i--) {
    const se = screenEffects[i];
    se.timer -= dt;
    if (se.timer <= 0) screenEffects.splice(i, 1);
  }

  camera.x = player.x + player.size / 2 - canvas.width / 2;
  camera.y = player.y + player.size / 2 - canvas.height / 2;

  updateEnemies(dt);
  updateProjectiles(); 
  updateParticles();
  updatePowerups(dt);
  
  // Auto-fire for touch
  if (fireButton.pressed && gameState === 'PLAYING') {
    fireProjectile();
  }
}

// 12. Main Render Loop
function draw() {
  // DEBUG: visible marker
  ctx.fillStyle = 'lime';
  ctx.fillRect(0, 0, 20, 20);
  ctx.font = '14px monospace';
  ctx.fillText('DRAW OK', 25, 15);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // --- UPGRADE MENU ---
  if (gameState === 'UPGRADE') {
    ctx.fillStyle = 'rgba(10, 10, 15, 0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const boxW = 700;
    const boxH = 500;
    const boxX = canvas.width / 2 - boxW / 2;
    const boxY = canvas.height / 2 - boxH / 2;

    ctx.fillStyle = 'rgba(20, 20, 28, 0.95)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = '#00d2d3';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00d2d3';
    ctx.shadowBlur = 20;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.shadowBlur = 0;

    // Header
    ctx.fillStyle = '#00d2d3';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('UPGRADE TERMINAL', canvas.width / 2, boxY + 55);

    // Upgrade points
    ctx.fillStyle = '#4caf50';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`UPGRADE POINTS: ${upgradePoints}`, canvas.width / 2, boxY + 85);

    const upgradeList = Object.keys(upgrades);
    const itemHeight = 55;
    const startY = boxY + 110;

    for (let i = 0; i < upgradeList.length; i++) {
      const key = upgradeList[i];
      const upg = upgrades[key];
      const itemY = startY + i * itemHeight;
      const isMaxed = upg.level >= upg.maxLevel;
      const cost = isMaxed ? 'MAX' : upg.cost[upg.level];
      const canAfford = upgradePoints >= cost && !isMaxed;

      // Item background
      ctx.fillStyle = canAfford ? 'rgba(0, 210, 211, 0.1)' : 'rgba(255, 71, 87, 0.05)';
      ctx.fillRect(boxX + 20, itemY, boxW - 40, 50);
      ctx.strokeStyle = canAfford ? '#00d2d3' : '#2f3542';
      ctx.lineWidth = 1;
      ctx.strokeRect(boxX + 20, itemY, boxW - 40, 50);

      // Name & level
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${key.toUpperCase()} [${upg.level}/${upg.maxLevel}]`, boxX + 40, itemY + 22);

      // Description
      ctx.fillStyle = '#aaaaaa';
      ctx.font = '12px monospace';
      const descs = {
        damage: 'Increase projectile damage',
        fireRate: 'Reduce weapon cooldown',
        speed: 'Increase movement speed',
        health: 'Increase max health',
        dash: 'Reduce dash cooldown',
        emp: 'Reduce EMP cooldown',
        pierce: 'Projectiles pierce enemies',
        lifesteal: 'Heal on enemy kill'
      };
      ctx.fillText(descs[key] || '', boxX + 40, itemY + 40);

      // Buy button
      const buyBtnX = boxX + boxW - 120;
      const buyBtnY = itemY + 5;
      const buyBtnW = 100;
      const buyBtnH = 40;

      ctx.fillStyle = isMaxed ? '#2f3542' : (canAfford ? '#00d2d3' : '#ff4757');
      ctx.fillRect(buyBtnX, buyBtnY, buyBtnW, buyBtnH);
      ctx.strokeStyle = isMaxed ? '#444' : (canAfford ? '#00ffff' : '#ff6b6b');
      ctx.strokeRect(buyBtnX, buyBtnY, buyBtnW, buyBtnH);

      ctx.fillStyle = isMaxed ? '#666' : '#000';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(isMaxed ? 'MAXED' : `BUY (${cost})`, buyBtnX + buyBtnW/2, buyBtnY + 26);
    }

    // Close button
    const closeX = boxX + boxW - 40;
    const closeY = boxY + 20;
    ctx.fillStyle = 'rgba(255, 71, 87, 0.2)';
    ctx.fillRect(closeX, closeY, 30, 30);
    ctx.strokeStyle = '#ff4757';
    ctx.strokeRect(closeX, closeY, 30, 30);
    ctx.fillStyle = '#ff4757';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('×', closeX + 15, closeY + 22);

    ctx.textAlign = 'left';
    return;
  }

  // --- MAIN MENU ---
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
    ctx.fillText('Touch: Joystick (left) | Fire/Dash/EMP (right)', canvas.width / 2, boxY + 275);

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

  // Parallax Starfield (screen space, drawn before world translate so distant
  // layers drift slower than the foreground — gives real sense of depth/scale)
  const nowT = performance.now();
  for (const layer of starLayers) {
    for (const s of layer.stars) {
      const sx = (s.x - renderCamX * layer.parallax) % canvas.width;
      const sy = (s.y - renderCamY * layer.parallax) % canvas.height;
      const screenX = ((sx + canvas.width * 1.5) % canvas.width);
      const screenY = ((sy + canvas.height * 1.5) % canvas.height);
      const twinkle = 0.5 + 0.5 * Math.sin(nowT / 500 + s.twinkleSeed);
      ctx.globalAlpha = 0.35 + twinkle * 0.5;
      ctx.fillStyle = s.color;
      ctx.fillRect(screenX, screenY, s.size, s.size);
    }
  }
  ctx.globalAlpha = 1.0;

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

  // Draw Walls (textured cyber-panels: gradient body + hazard-stripe overlay + glowing trim + rivets)
  for (const wall of obstacles) {
    if (wall.x + wall.width > camera.x && wall.x < camera.x + canvas.width &&
        wall.y + wall.height > camera.y && wall.y < camera.y + canvas.height) {

      // Base panel gradient (subtle depth, top-lit)
      const wallGrad = ctx.createLinearGradient(wall.x, wall.y, wall.x, wall.y + wall.height);
      wallGrad.addColorStop(0, '#3a4055');
      wallGrad.addColorStop(0.5, wall.color);
      wallGrad.addColorStop(1, '#1c1f29');
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#000000';
      ctx.fillStyle = wallGrad;
      ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
      ctx.shadowBlur = 0;

      // Hazard-stripe texture overlay
      ctx.save();
      ctx.beginPath();
      ctx.rect(wall.x, wall.y, wall.width, wall.height);
      ctx.clip();
      ctx.fillStyle = stripePattern;
      ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
      ctx.restore();

      // Glowing accent trim
      ctx.strokeStyle = wall.accent;
      ctx.lineWidth = 2;
      ctx.shadowColor = wall.accent;
      ctx.shadowBlur = 6;
      ctx.strokeRect(wall.x + 1, wall.y + 1, wall.width - 2, wall.height - 2);
      ctx.shadowBlur = 0;

      // Corner rivets
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      const rv = 3;
      ctx.fillRect(wall.x + 4, wall.y + 4, rv, rv);
      ctx.fillRect(wall.x + wall.width - 4 - rv, wall.y + 4, rv, rv);
      ctx.fillRect(wall.x + 4, wall.y + wall.height - 4 - rv, rv, rv);
      ctx.fillRect(wall.x + wall.width - 4 - rv, wall.y + wall.height - 4 - rv, rv, rv);
    }
  }

  // Draw Power-Up Drops
  for (const p of powerups) {
    // Pulsing glow
    ctx.shadowBlur = 20 + Math.sin(performance.now() / 150) * 5;
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    
    // Rotating square for some powerups
    if (['PIERCE', 'LIFESTEAL', 'NUKE', 'TIME', 'XP'].includes(p.type)) {
      ctx.save();
      ctx.translate(p.x + p.size/2, p.y + p.size/2);
      ctx.rotate(performance.now() / 500);
      ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
      ctx.restore();
    } else {
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px monospace';
    let label = '3';
    if (p.type === 'RAPID') label = 'R';
    if (p.type === 'SHIELD') label = 'S';
    if (p.type === 'PIERCE') label = 'P';
    if (p.type === 'LIFESTEAL') label = 'L';
    if (p.type === 'NUKE') label = 'N';
    if (p.type === 'TIME') label = 'T';
    if (p.type === 'XP') label = '+';
    ctx.fillText(label, p.x + 7, p.y + 17);
  }

  // Draw Dash Trails (Ghost Rectangles with fade)
  for (const dt of dashTrails) {
    ctx.globalAlpha = Math.max(0, dt.life * 0.4);
    ctx.shadowBlur = 15;
    ctx.shadowColor = dt.color;
    ctx.fillStyle = dt.color;
    ctx.fillRect(dt.x, dt.y, dt.size, dt.size);
    
    // Inner glow
    ctx.globalAlpha = Math.max(0, dt.life * 0.2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(dt.x + 4, dt.y + 4, dt.size - 8, dt.size - 8);
  }
  ctx.globalAlpha = 1.0;
  ctx.shadowBlur = 0;

  // Draw Particles (enhanced)
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.shadowBlur = 15;
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    
    // Different particle shapes based on type
    if (p.type === 'ring') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8 * (1 - p.life) + 2, 0, Math.PI * 2);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (p.type === 'trail') {
      ctx.fillRect(p.x - 2, p.y - 2, 4, 12);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 * p.life + 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1.0;
  ctx.shadowBlur = 0;

  // Draw screen effects (warnings, slowmo indicators)
  for (const se of screenEffects) {
    if (se.type === 'warning') {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(performance.now() / 50) * 0.5;
      ctx.strokeStyle = '#ff1744';
      ctx.lineWidth = 3;
      ctx.setLineDash([20, 10]);
      ctx.beginPath();
      ctx.moveTo(se.x, se.y);
      ctx.lineTo(se.x + Math.cos(se.angle) * 2000, se.y + Math.sin(se.angle) * 2000);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  // Draw Projectiles with trails
  ctx.shadowBlur = 15;
  for (const p of projectiles) {
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    
    // Trail effect
    ctx.globalAlpha = 0.3;
    for (let t = 1; t <= 5; t++) {
      ctx.beginPath();
      ctx.arc(p.x - p.vx * t * 0.1 + p.size/2, p.y - p.vy * t * 0.1 + p.size/2, p.size/2 * (1 - t * 0.1), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
    
    ctx.beginPath();
    ctx.arc(p.x + p.size/2, p.y + p.size/2, p.size/2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw Enemy Projectiles
  for (const ep of enemyProjectiles) {
    ctx.shadowColor = ep.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = ep.color;
    ctx.beginPath();
    ctx.arc(ep.x + ep.size/2, ep.y + ep.size/2, ep.size/2, 0, Math.PI * 2);
    ctx.fill();
    
    if (ep.void) {
      ctx.shadowColor = '#9c27b0';
      ctx.shadowBlur = 20;
      ctx.strokeStyle = '#9c27b0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ep.x + ep.size/2, ep.y + ep.size/2, ep.size, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Draw Enemies
  for (const e of enemies) {
    // Phased effect
    if (e.phased) {
      ctx.globalAlpha = 0.4;
    }
    
    if (e.type === 'boss') {
      // Boss glow aura
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 30;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x + e.size/2, e.y + e.size/2, e.size/2 + 10 + Math.sin(performance.now() / 200) * 5, 0, Math.PI * 2);
      ctx.stroke();
      
      // Boss body
      ctx.shadowBlur = 25;
      ctx.fillStyle = e.color;
      ctx.fillRect(e.x, e.y, e.size, e.size);
      
      // Boss core
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(e.x + e.size/2, e.y + e.size/2, e.size/4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
      
      // Boss health bar (larger)
      ctx.fillStyle = '#2f3542';
      ctx.fillRect(e.x, e.y - 15, e.size, 8);
      ctx.fillStyle = e.health / e.maxHealth > 0.5 ? '#2ed573' : '#ff4757';
      ctx.fillRect(e.x, e.y - 15, e.size * (e.health / e.maxHealth), 8);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(e.x, e.y - 15, e.size, 8);
      
      // Boss name
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(e.bossType, e.x + e.size/2, e.y - 20);
      ctx.textAlign = 'left';
      
    } else {
      // Regular enemies
      ctx.shadowColor = e.stunnedTimer > 0 ? '#00d2d3' : e.color;
      ctx.shadowBlur = e.stunnedTimer > 0 ? 25 : 20;
      ctx.fillStyle = e.stunnedTimer > 0 ? '#00d2d3' : e.color;
      
      // Special enemy shapes
      if (e.type === 'scout') {
        ctx.beginPath();
        ctx.moveTo(e.x + e.size/2, e.y);
        ctx.lineTo(e.x + e.size, e.y + e.size/2);
        ctx.lineTo(e.x + e.size/2, e.y + e.size);
        ctx.lineTo(e.x, e.y + e.size/2);
        ctx.closePath();
        ctx.fill();
      } else if (e.type === 'splitter' || e.type === 'mini_splitter') {
        ctx.save();
        ctx.translate(e.x + e.size/2, e.y + e.size/2);
        ctx.rotate(performance.now() / 500);
        ctx.fillRect(-e.size/2, -e.size/2, e.size, e.size);
        ctx.restore();
      } else if (e.type === 'sniper') {
        ctx.fillRect(e.x, e.y, e.size, e.size);
        // Scope indicator
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x + e.size/2, e.y + e.size/2, e.size/2 + 3, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.type === 'bomber') {
        ctx.fillRect(e.x, e.y, e.size, e.size);
        // Pulse
        ctx.globalAlpha = 0.5 + Math.sin(performance.now() / 100) * 0.5;
        ctx.strokeStyle = '#ff3300';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x + e.size/2, e.y + e.size/2, e.size/2 + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      } else if (e.type === 'phantom') {
        ctx.globalAlpha = e.phased ? 0.3 : 1.0;
        ctx.fillRect(e.x, e.y, e.size, e.size);
        ctx.globalAlpha = 1.0;
      } else {
        ctx.fillRect(e.x, e.y, e.size, e.size);
      }
      
      if (e.maxHealth > 1) {
        ctx.fillStyle = '#2f3542';
        ctx.fillRect(e.x, e.y - 8, e.size, 4);
        ctx.fillStyle = '#2ed573';
        ctx.fillRect(e.x, e.y - 8, e.size * (e.health / e.maxHealth), 4);
      }
    }
    
    ctx.globalAlpha = 1.0;
  }

  // Draw Shield Aura Around Player
  if (shieldTimer > 0) {
    ctx.strokeStyle = '#00d2d3';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#00d2d3';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(player.x + player.size / 2, player.y + player.size / 2, player.size + 6 + Math.sin(performance.now() / 100) * 3, 0, Math.PI * 2);
    ctx.stroke();
    
    // Inner shield pulse
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x + player.size / 2, player.y + player.size / 2, player.size + 10 + Math.sin(performance.now() / 50) * 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  // Draw Player with combo glow
  ctx.shadowColor = comboMultiplier > 1 ? '#eccc68' : player.color;
  ctx.shadowBlur = player.isDashing ? 30 : (comboMultiplier > 1 ? 12 + comboMultiplier * 6 : 20);
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.size, player.size);
  
  // Player core
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(player.x + 8, player.y + 8, 16, 16);
  
  // Dash effect
  if (player.isDashing) {
    ctx.strokeStyle = '#ff4757';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ff4757';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(player.x + player.size/2, player.y + player.size/2, player.size + 10, 0, Math.PI * 2);
    ctx.stroke();
  }

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

  // Draw Touch Controls (Mobile)
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    // Joystick base
    ctx.fillStyle = 'rgba(255, 71, 87, 0.2)';
    ctx.strokeStyle = '#ff4757';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(joystick.startX || 80, joystick.startY || canvas.height - 80, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Joystick stick
    if (joystick.active) {
      ctx.fillStyle = 'rgba(255, 71, 87, 0.6)';
      ctx.beginPath();
      ctx.arc(joystick.currentX, joystick.currentY, 30, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fire button
    ctx.fillStyle = fireButton.pressed ? 'rgba(0, 210, 211, 0.6)' : 'rgba(0, 210, 211, 0.3)';
    ctx.strokeStyle = '#00d2d3';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(fireButton.x, fireButton.y, fireButton.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FIRE', fireButton.x, fireButton.y + 6);

    // Dash button
    ctx.fillStyle = player.dashCooldown > 0 ? 'rgba(255, 71, 87, 0.3)' : 'rgba(255, 71, 87, 0.5)';
    ctx.strokeStyle = player.dashCooldown > 0 ? '#ff4757' : '#ff6b6b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(dashButton.x, dashButton.y, dashButton.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('DASH', dashButton.x, dashButton.y + 5);
    if (player.dashCooldown > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = '12px monospace';
      ctx.fillText(player.dashCooldown.toFixed(1) + 's', dashButton.x, dashButton.y + 20);
    }

    // EMP button
    ctx.fillStyle = empCooldown > 0 ? 'rgba(156, 39, 176, 0.3)' : 'rgba(156, 39, 176, 0.5)';
    ctx.strokeStyle = empCooldown > 0 ? '#9c27b0' : '#ba68c8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(empButton.x, empButton.y, empButton.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('EMP', empButton.x, empButton.y + 5);
    if (empCooldown > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = '12px monospace';
      ctx.fillText(empCooldown.toFixed(1) + 's', empButton.x, empButton.y + 20);
    }
    
    ctx.textAlign = 'left';
  }
}

// 13. Core Game Loop
function gameLoop() {
  try {
    update();
    draw();
  } catch (e) {
    console.error('Game loop error:', e);
    ctx.fillStyle = 'red';
    ctx.font = '20px monospace';
    ctx.fillText('ERROR: ' + e.message, 20, 50);
  }
  requestAnimationFrame(gameLoop);
}

gameLoop();