import { useEffect, useRef } from 'react';

const BalanceIsALie = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const CANVAS_WIDTH = 800;
    const CANVAS_HEIGHT = 600;
    
    const BLACK = '#000000';
    const WHITE = '#FFFFFF';
    const CYAN = '#00FFFF';
    const RED = '#FF4444';
    const GRAY = '#666666';
    const GREEN = '#44FF44';
    const YELLOW = '#FFFF44';
    
    const PHYSICS = {
      GRAVITY_BASE: 0.6,
      FRICTION: 0.85,
      AIR_RESISTANCE: 0.98,
      MAX_VELOCITY_X: 8,
      MAX_VELOCITY_Y: 20,
      JUMP_IMPULSE: -12,
      MOVE_ACCELERATION: 1.2
    };
    
    const game = {
      audio: {
        gameBgm: new Audio('/audio/game_bgm.mp3'),
        deathBgm: new Audio('/audio/death_bgm.mp3'),
        nextLevelBgm: new Audio('/audio/next_level_bgm.mp3')
      },
      scene: 'coldOpen' as string,
      currentLevel: 0,
      frameCount: 0,
      coldOpenTimer: 0,
      menuSelection: 0,
      pauseSelection: 0,
      deaths: 0,
      
      player: {
        x: 100,
        y: 450,
        vx: 0,
        vy: 0,
        ax: 0,
        size: 20,
        grounded: false,
        alive: true,
        form: 'circle' as 'circle' | 'triangle' | 'square',
        gravityMultiplier: 1.0,
        speedDecay: 1.0,
        idleTime: 0,
        jumpCount: 0,
        lastJumpTime: 0,
        landingCount: 0
      },
      
      camera: {
        viewportLeft: 0,
        viewportTop: 0,
        viewportRight: CANVAS_WIDTH,
        viewportBottom: CANVAS_HEIGHT
      },
      
      levelState: {
        complete: false,
        doorClosing: 0,
        gravityInverted: false,
        delayedSpikeActive: false,
        delayedSpikeTimer: 0,
        chaserActive: false,
        chaserX: 0,
        platformStates: [] as any[],
        compressionActive: false,
        greedMeter: 0,
        doorY: 0,
        exchangeSpeed: false,
        exchangeGravity: false,
        exchangeShrink: false,
        ceilingSpikePassed: false
      },
      
      keys: {} as Record<string, boolean>,
      particles: [] as any[],
      cameraShake: 0,
      screenFlash: 0
    };

    // Configure Audio Loops
    game.audio.gameBgm.loop = true;
    game.audio.nextLevelBgm.loop = true;
    
    class Particle {
      x: number; y: number; vx: number; vy: number;
      life: number; maxLife: number; color: string; size: number;
      
      constructor(x: number, y: number, color: string, vx: number, vy: number, life: number, size = 3) {
        this.x = x; this.y = y; this.color = color;
        this.vx = vx; this.vy = vy;
        this.life = life; this.maxLife = life; this.size = size;
      }
      
      update() {
        this.x += this.vx; this.y += this.vy;
        this.vy += 0.15; this.life--;
      }
      
      draw(ctx: CanvasRenderingContext2D) {
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    
    function createParticles(x: number, y: number, color: string, count: number, speed = 3) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        game.particles.push(new Particle(
          x, y, color,
          Math.cos(angle) * (speed + Math.random() * 2),
          Math.sin(angle) * (speed + Math.random() * 2) - 2,
          25 + Math.random() * 15
        ));
      }
    }
    
    function getFormStats(form: string) {
      switch(form) {
        case 'circle': return { speed: 1.5, jump: 1.0 };
        case 'triangle': return { speed: 1.0, jump: 1.4 };
        case 'square': return { speed: 0.8, jump: 1.0 };
        default: return { speed: 1.0, jump: 1.0 };
      }
    }
    
    const levels = [
      {
        id: 1,
        name: "Trust",
        subtitle: "The door is open. Walk through.",
        platforms: [{ x: 0, y: 550, w: 800, h: 50, type: 'static' }],
        door: { x: 720, y: 490, w: 40, h: 60 },
        spikes: [],
        ceilingSpikes: [],
        startX: 80, startY: 500
      },
      {
        id: 2,
        name: "Inversion",
        subtitle: "Gravity remembers nothing.",
        platforms: [{ x: 0, y: 550, w: 800, h: 50, type: 'static' }],
        ceiling: { y: 50, h: 30 },
        ceilingSpikes: [{ x: 500, y: 50, w: 60 }],
        door: { x: 720, y: 490, w: 40, h: 60 },
        delayedSpike: { x: 680, y: 550, active: false },
        spikes: [],
        startX: 80, startY: 500,
        gravityFlipAt: 0.7,
        gravityRevertAt: 0.75
      },
      {
        id: 3,
        name: "Pursuit",
        subtitle: "It waits for your first leap.",
        platforms: [
          { x: 50, y: 450, w: 120, h: 20, type: 'floating' },
          { x: 220, y: 400, w: 120, h: 20, type: 'floating' },
          { x: 400, y: 350, w: 120, h: 20, type: 'floating' },
          { x: 580, y: 300, w: 120, h: 20, type: 'floating' }
        ],
        spikePit: { y: 570, h: 30 },
        door: { x: 720, y: 240, w: 40, h: 60 },
        spikes: [],
        ceilingSpikes: [],
        startX: 100, startY: 400,
        chaserSpeed: 4.0
      },
      {
        id: 4,
        name: "False Ground",
        subtitle: "Not all platforms are honest.",
        platforms: [
          { x: 50, y: 500, w: 100, h: 20, type: 'moving', dx: 1, minX: 50, maxX: 150 },
          { x: 200, y: 420, w: 100, h: 20, type: 'false', fallDelay: 30 },
          { x: 350, y: 340, w: 100, h: 20, type: 'growing', minW: 60, maxW: 140, growSpeed: 0.5 },
          { x: 500, y: 260, w: 100, h: 20, type: 'moving', dx: -1, minX: 450, maxX: 600 },
          { x: 650, y: 180, w: 100, h: 20, type: 'static' }
        ],
        door: { x: 680, y: 120, w: 40, h: 60 },
        spikes: [{ x: 0, y: 570 }, { x: 200, y: 570 }, { x: 400, y: 570 }, { x: 600, y: 570 }],
        ceilingSpikes: [],
        startX: 80, startY: 450
      },
      {
        id: 5,
        name: "Compression",
        subtitle: "Space is running out.",
        platforms: [{ x: 0, y: 550, w: 800, h: 50, type: 'static' }],
        ceiling: { y: 100, h: 30 },
        door: { x: 720, y: 490, w: 40, h: 60 },
        fakeSpike: { x: 650, y: 550 },
        spikes: [],
        ceilingSpikes: [],
        startX: 80, startY: 500,
        compression: true
      },
      {
        id: 6,
        name: "Labels Lie",
        subtitle: "Trust nothing written.",
        platforms: [{ x: 0, y: 550, w: 800, h: 50, type: 'static' }],
        doors: [
          { x: 280, y: 490, w: 40, h: 60, label: "SAFE", color: RED, kills: false },
          { x: 480, y: 490, w: 40, h: 60, label: "DANGER", color: GREEN, kills: true }
        ],
        door: { x: 280, y: 490, w: 40, h: 60 },
        spikes: [],
        ceilingSpikes: [],
        startX: 400, startY: 500
      },
      {
        id: 7,
        name: "Greed",
        subtitle: "The door punishes impatience.",
        platforms: [
          { x: 100, y: 520, w: 200, h: 20, type: 'static' },
          { x: 400, y: 450, w: 200, h: 20, type: 'static' },
          { x: 100, y: 380, w: 200, h: 20, type: 'sliding', dx: 0 },
          { x: 400, y: 310, w: 200, h: 20, type: 'static' },
          { x: 100, y: 240, w: 200, h: 20, type: 'static' },
          { x: 350, y: 160, w: 200, h: 20, type: 'static' }
        ],
        door: { x: 420, y: 100, w: 40, h: 60, moving: true },
        spikes: [],
        risingSpikes: [],
        ceilingSpikes: [],
        startX: 180, startY: 470
      },
      {
        id: 8,
        name: "Equivalent Exchange",
        subtitle: "What will you give?",
        platforms: [{ x: 0, y: 550, w: 800, h: 50, type: 'static' }],
        door: { x: 380, y: 490, w: 40, h: 60, locked: true },
        movingSpikes: [
          { x: 200, y: 550, dx: 1, delay: 60 },
          { x: 600, y: 550, dx: -1, delay: 120 }
        ],
        spikes: [],
        ceilingSpikes: [],
        startX: 100, startY: 500
      }
    ];
    
    function loadLevel(levelIndex: number) {
      const level = levels[levelIndex] as any;
      
      game.player.x = level.startX;
      game.player.y = level.startY;
      game.player.vx = 0;
      game.player.vy = 0;
      game.player.ax = 0;
      game.player.alive = true;
      game.player.grounded = false;
      game.player.form = 'circle';
      game.player.gravityMultiplier = 1.0;
      game.player.speedDecay = 1.0;
      game.player.idleTime = 0;
      game.player.jumpCount = 0;
      game.player.lastJumpTime = 0;
      game.player.landingCount = 0;
      
      game.camera = {
        viewportLeft: 0,
        viewportTop: 0,
        viewportRight: CANVAS_WIDTH,
        viewportBottom: CANVAS_HEIGHT
      };
      
      game.levelState = {
        complete: false,
        doorClosing: 0,
        gravityInverted: false,
        delayedSpikeActive: false,
        delayedSpikeTimer: 0,
        chaserActive: false,
        chaserX: 0,
        platformStates: level.platforms.map((p: any) => ({
          fallen: false,
          fallTimer: 0,
          currentW: p.w,
          growing: true,
          activated: false
        })),
        compressionActive: false,
        greedMeter: 0,
        doorY: level.door.y,
        exchangeSpeed: false,
        exchangeGravity: false,
        exchangeShrink: false,
        ceilingSpikePassed: false
      };
      
      game.particles = [];
      game.cameraShake = 0;
    }
    
    function killPlayer() {
      if (!game.player.alive) return;
      game.player.alive = false;
      game.cameraShake = 15;
      createParticles(game.player.x, game.player.y, RED, 20, 4);
      game.deaths++;
      
      // Stop Game BGM and play Death BGM
      game.audio.gameBgm.pause();
      game.audio.deathBgm.currentTime = 0;
      game.audio.deathBgm.play().catch(e => console.error("Audio play failed", e));

      // Wait 2 seconds before respawning
      setTimeout(() => {
        loadLevel(game.currentLevel);
        // Resume Game BGM
        game.audio.gameBgm.play().catch(e => console.error("Audio play failed", e));
      }, 2000);
    }
    
    function handleKeyDown(e: KeyboardEvent) {
      // Start background music on first interaction
      if (game.audio.gameBgm.paused && game.scene !== 'levelComplete' && game.player.alive && game.scene !== 'ending') {
        game.audio.gameBgm.play().catch(() => {});
      }

      if (e.key === ' ' || e.key === 'Tab') e.preventDefault();
      game.keys[e.key] = true;
      
      if (game.scene === 'coldOpen' && (e.key === 'Enter' || e.key === ' ')) {
        game.scene = 'menu';
        return;
      }
      
      if (game.scene === 'playing' && (e.key === 'Escape' || e.key === 'Tab')) {
        game.scene = 'paused';
        game.pauseSelection = 0;
        return;
      }
      
      if (game.scene === 'paused') {
        if (e.key === 'ArrowUp' || e.key === 'w') game.pauseSelection = Math.max(0, game.pauseSelection - 1);
        if (e.key === 'ArrowDown' || e.key === 's') game.pauseSelection = Math.min(2, game.pauseSelection + 1);
        if (e.key === 'Enter' || e.key === ' ') {
          if (game.pauseSelection === 0) game.scene = 'playing';
          else if (game.pauseSelection === 1) { loadLevel(game.currentLevel); game.scene = 'playing'; }
          else { game.scene = 'menu'; game.menuSelection = 0; }
        }
        if (e.key === 'Escape') game.scene = 'playing';
        return;
      }
      
      if (game.scene === 'menu') {
        if (e.key === 'ArrowUp' || e.key === 'w') game.menuSelection = Math.max(0, game.menuSelection - 1);
        if (e.key === 'ArrowDown' || e.key === 's') game.menuSelection = Math.min(3, game.menuSelection + 1);
        if (e.key === 'Enter' || e.key === ' ') {
          if (game.menuSelection === 0) { game.currentLevel = 0; game.deaths = 0; loadLevel(0); game.scene = 'playing'; }
          else if (game.menuSelection === 1) game.scene = 'howToPlay';
          else if (game.menuSelection === 2) game.scene = 'about';
          else game.scene = 'credits';
        }
        return;
      }
      
      if ((game.scene === 'credits' || game.scene === 'howToPlay' || game.scene === 'about' || game.scene === 'ending') && 
          (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'Enter')) {
        game.scene = 'menu';
        return;
      }
      
      if (game.scene === 'levelComplete' && (e.key === 'Enter' || e.key === ' ')) {
        // Stop Next Level BGM
        game.audio.nextLevelBgm.pause();
        game.audio.nextLevelBgm.currentTime = 0;

        game.currentLevel++;
        if (game.currentLevel >= levels.length) {
          game.scene = 'ending';
        } else {
          loadLevel(game.currentLevel);
          game.scene = 'playing';
          // Resume Game BGM
          game.audio.gameBgm.play().catch(e => console.error("Audio play failed", e));
        }
        return;
      }
      
      if (game.scene === 'playing' && game.player.alive && !game.levelState.complete) {
        if ((e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') && game.player.grounded) {
          const level = levels[game.currentLevel] as any;
          const stats = getFormStats(game.player.form);
          
          let jumpPower = PHYSICS.JUMP_IMPULSE * stats.jump;
          if (game.levelState.gravityInverted) jumpPower = -jumpPower;
          
          game.player.vy = jumpPower;
          game.player.grounded = false;
          game.player.jumpCount++;
          game.player.lastJumpTime = game.frameCount;
          
          if (game.player.form === 'triangle') {
            game.player.gravityMultiplier += 0.05;
          }
          
          if (level.id === 3 && !game.levelState.chaserActive) {
            game.levelState.chaserActive = true;
            game.levelState.chaserX = 0;
          }
          
          if (level.id === 7) {
            game.levelState.greedMeter += 10;
            if (game.player.jumpCount > 1 && game.frameCount - game.player.lastJumpTime < 30) {
              game.levelState.greedMeter += 20;
            }
          }
          
          if (level.id === 8 && !game.levelState.exchangeGravity && game.player.gravityMultiplier > 1.1) {
            game.levelState.exchangeGravity = true;
            createParticles(game.player.x, game.player.y, CYAN, 12);
          }
          
          createParticles(game.player.x, game.player.y + 10, WHITE, 6, 2);
        }
        
        if ((e.key === 'Shift' || e.key === '1' || e.key === '2' || e.key === '3') && !e.repeat) {
          if (e.key === '1') game.player.form = 'circle';
          else if (e.key === '2') game.player.form = 'triangle';
          else if (e.key === '3') game.player.form = 'square';
          else {
            const forms: Array<'circle' | 'triangle' | 'square'> = ['circle', 'triangle', 'square'];
            const idx = forms.indexOf(game.player.form);
            game.player.form = forms[(idx + 1) % 3];
          }
          createParticles(game.player.x, game.player.y, CYAN, 8, 2);
          game.screenFlash = 3;
        }
      }
    }
    
    function handleKeyUp(e: KeyboardEvent) {
      game.keys[e.key] = false;
    }
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    function update() {
      game.frameCount++;
      
      if (game.scene === 'coldOpen') {
        game.coldOpenTimer++;
        if (game.coldOpenTimer > 360) game.scene = 'menu';
        return;
      }
      
      for (let i = game.particles.length - 1; i >= 0; i--) {
        game.particles[i].update();
        if (game.particles[i].life <= 0) game.particles.splice(i, 1);
      }
      
      if (game.cameraShake > 0) game.cameraShake *= 0.85;
      if (game.screenFlash > 0) game.screenFlash--;
      
      if (game.scene !== 'playing') return;
      
      const level = levels[game.currentLevel] as any;
      
      if (game.levelState.complete) {
        game.levelState.doorClosing++;
        const door = level.doors ? level.doors.find((d: any) => !d.kills) : level.door;
        const doorY = level.id === 7 ? game.levelState.doorY : door.y;
        game.player.x += (door.x + door.w/2 - game.player.x) * 0.1;
        game.player.y += (doorY + door.h/2 - game.player.y) * 0.1;
        if (game.levelState.doorClosing >= 60) {
          if (game.scene !== 'levelComplete') {
            game.scene = 'levelComplete';
            // Stop Game BGM and play Next Level BGM
            game.audio.gameBgm.pause();
            game.audio.nextLevelBgm.currentTime = 0;
            game.audio.nextLevelBgm.play().catch(e => console.error("Audio play failed", e));
          }
        }
        return;
      }
      
      if (!game.player.alive) return;
      
      const stats = getFormStats(game.player.form);
      
      const isLeft = game.keys['ArrowLeft'] || game.keys['a'];
      const isRight = game.keys['ArrowRight'] || game.keys['d'];
      const isMoving = isLeft || isRight;
      
      if (isLeft) {
        game.player.ax = -PHYSICS.MOVE_ACCELERATION * stats.speed;
        game.player.idleTime = 0;
      } else if (isRight) {
        game.player.ax = PHYSICS.MOVE_ACCELERATION * stats.speed;
        game.player.idleTime = 0;
      } else {
        game.player.ax = 0;
        if (game.player.grounded) game.player.idleTime++;
      }
      
      if (game.player.form === 'circle' && game.player.idleTime > 180) {
        game.camera.viewportLeft += 1.5;
        
        if (level.id === 8 && !game.levelState.exchangeShrink) {
          game.levelState.exchangeShrink = true;
          createParticles(game.player.x, game.player.y, CYAN, 12);
        }
      }
      
      if (game.player.form === 'square') {
        game.player.speedDecay *= 0.9985;
        
        if (level.id === 8 && !game.levelState.exchangeSpeed && game.player.speedDecay < 0.95) {
          game.levelState.exchangeSpeed = true;
          createParticles(game.player.x, game.player.y, CYAN, 12);
        }
      }
      
      game.player.vx += game.player.ax;
      game.player.vx *= game.player.grounded ? PHYSICS.FRICTION : PHYSICS.AIR_RESISTANCE;
      game.player.vx *= game.player.speedDecay;
      game.player.vx = Math.max(-PHYSICS.MAX_VELOCITY_X, Math.min(PHYSICS.MAX_VELOCITY_X, game.player.vx));
      
      let gravity = PHYSICS.GRAVITY_BASE * game.player.gravityMultiplier;
      if (game.levelState.gravityInverted) gravity = -gravity;
      game.player.vy += gravity;
      game.player.vy = Math.max(-PHYSICS.MAX_VELOCITY_Y, Math.min(PHYSICS.MAX_VELOCITY_Y, game.player.vy));
      
      game.player.x += game.player.vx;
      game.player.y += game.player.vy;
      
      if (level.id === 2) {
        const progress = game.player.x / CANVAS_WIDTH;
        
        if (progress > level.gravityFlipAt && !game.levelState.gravityInverted && !game.levelState.ceilingSpikePassed) {
          game.levelState.gravityInverted = true;
          game.cameraShake = 8;
        }
        
        if (game.levelState.gravityInverted && game.player.x > 560) {
          game.levelState.ceilingSpikePassed = true;
          game.levelState.gravityInverted = false;
          game.cameraShake = 5;
        }
        
        if (game.levelState.ceilingSpikePassed && game.player.grounded && !game.levelState.delayedSpikeActive) {
          game.levelState.delayedSpikeActive = true;
          game.levelState.delayedSpikeTimer = 30;
        }
        
        if (game.levelState.delayedSpikeActive && game.levelState.delayedSpikeTimer > 0) {
          game.levelState.delayedSpikeTimer--;
        }
        
        level.ceilingSpikes?.forEach((spike: any) => {
          if (game.player.x + game.player.size > spike.x &&
              game.player.x - game.player.size < spike.x + spike.w &&
              game.player.y - game.player.size < spike.y + 20) {
            killPlayer();
          }
        });
        
        if (game.levelState.delayedSpikeActive && game.levelState.delayedSpikeTimer <= 0) {
          const ds = level.delayedSpike;
          if (game.player.x + game.player.size > ds.x &&
              game.player.x - game.player.size < ds.x + 40 &&
              game.player.y + game.player.size > ds.y - 20) {
            killPlayer();
          }
        }
      }
      
      if (level.id === 3) {
        if (game.player.y > 560) {
          killPlayer();
        }
        
        if (game.levelState.chaserActive) {
          const chaserSpeed = level.chaserSpeed;
          game.levelState.chaserX += chaserSpeed;
          
          if (game.player.x < game.levelState.chaserX + 30) {
            killPlayer();
          }
        }
      }
      
      if (level.id === 5) {
        if (!game.levelState.compressionActive) {
          game.levelState.compressionActive = true;
        }
        
        game.camera.viewportLeft += 0.8;
        game.camera.viewportTop += 0.4;
        game.camera.viewportBottom -= 0.4;
        
        if (game.player.x < game.camera.viewportLeft ||
            game.player.y < game.camera.viewportTop ||
            game.player.y > game.camera.viewportBottom) {
          killPlayer();
        }
      }
      
      if (level.id === 7) {
        if (game.levelState.greedMeter > 50) {
          game.levelState.doorY = Math.max(40, level.door.y - game.levelState.greedMeter * 0.5);
        }
        
        if (game.levelState.greedMeter > 0 && game.player.grounded) {
          game.levelState.greedMeter -= 0.5;
        }
        
        const platform3 = level.platforms[2];
        if (game.player.landingCount >= 3 && platform3.type === 'sliding') {
          platform3.dx = 0.5;
        }
      }
      
      if (level.id === 8 && level.movingSpikes) {
        level.movingSpikes.forEach((spike: any, i: number) => {
          if (game.frameCount > spike.delay) {
            spike.x += spike.dx * 2;
            if (spike.x < 100 || spike.x > 700) spike.dx *= -1;
            
            if (game.player.x + game.player.size > spike.x &&
                game.player.x - game.player.size < spike.x + 20 &&
                game.player.y + game.player.size > spike.y - 20) {
              killPlayer();
            }
          }
        });
      }
      
      game.player.grounded = false;
      
      level.platforms.forEach((plat: any, idx: number) => {
        const state = game.levelState.platformStates[idx];
        if (!state) return;
        
        let platX = plat.x;
        let platY = plat.y;
        let platW = plat.w;
        
        if (plat.type === 'moving' && state.activated) {
          platX += plat.dx || 0;
          plat.x = platX;
          if (platX <= plat.minX || platX >= plat.maxX) plat.dx *= -1;
        }
        
        if (plat.type === 'sliding' && plat.dx) {
          plat.x += plat.dx;
          platX = plat.x;
        }
        
        if (plat.type === 'growing') {
          if (state.growing) {
            state.currentW += plat.growSpeed;
            if (state.currentW >= plat.maxW) state.growing = false;
          } else {
            state.currentW -= plat.growSpeed;
            if (state.currentW <= plat.minW) state.growing = true;
          }
          platW = state.currentW;
        }
        
        if (plat.type === 'false' && state.fallen) {
          return;
        }
        
        const onPlatform = game.player.x + game.player.size > platX &&
                          game.player.x - game.player.size < platX + platW &&
                          game.player.y + game.player.size > platY &&
                          game.player.y + game.player.size < platY + 25 &&
                          game.player.vy >= 0;
        
        if (onPlatform) {
          game.player.y = platY - game.player.size;
          game.player.vy = 0;
          game.player.grounded = true;
          
          if (!state.activated) {
            state.activated = true;
            game.player.landingCount++;
            
            if (level.id === 4) {
              game.levelState.platformStates.forEach((s: any, i: number) => {
                if (level.platforms[i].type === 'moving') s.activated = true;
              });
            }
          }
          
          if (plat.type === 'false' && !state.fallen) {
            state.fallTimer++;
            if (state.fallTimer > (plat.fallDelay || 30)) {
              state.fallen = true;
              game.cameraShake = 5;
            }
          }
          
          if (plat.type === 'moving' || plat.type === 'sliding') {
            game.player.x += (plat.dx || 0);
          }
        }
      });
      
      if (game.player.x < game.camera.viewportLeft + game.player.size) {
        if (level.id === 5 || game.camera.viewportLeft > 10) {
          killPlayer();
        } else {
          game.player.x = game.player.size;
        }
      }
      if (game.player.x > CANVAS_WIDTH - game.player.size) game.player.x = CANVAS_WIDTH - game.player.size;
      
      if (game.player.y > CANVAS_HEIGHT) {
        killPlayer();
      }
      
      level.spikes?.forEach((spike: any) => {
        if (game.player.x + game.player.size > spike.x &&
            game.player.x - game.player.size < spike.x + 20 &&
            game.player.y + game.player.size > (spike.y || 550) - 20) {
          killPlayer();
        }
      });
      
      if (level.doors) {
        level.doors.forEach((door: any) => {
          if (game.player.x + game.player.size > door.x &&
              game.player.x - game.player.size < door.x + door.w &&
              game.player.y + game.player.size > door.y &&
              game.player.y - game.player.size < door.y + door.h) {
            if (door.kills) {
              killPlayer();
            } else {
              game.levelState.complete = true;
              createParticles(door.x + 20, door.y + 30, GREEN, 15, 3);
            }
          }
        });
      } else {
        const door = level.door;
        const doorY = level.id === 7 ? game.levelState.doorY : door.y;
        const inDoor = game.player.x + game.player.size > door.x &&
                       game.player.x - game.player.size < door.x + door.w &&
                       game.player.y + game.player.size > doorY &&
                       game.player.y - game.player.size < doorY + door.h;
        
        if (inDoor && !game.levelState.complete) {
          if (level.id === 8) {
            const allTriggered = game.levelState.exchangeSpeed && 
                                game.levelState.exchangeGravity && 
                                game.levelState.exchangeShrink;
            if (allTriggered) {
              game.levelState.complete = true;
              createParticles(door.x + 20, doorY + 30, GREEN, 15, 3);
            }
          } else {
            game.levelState.complete = true;
            createParticles(door.x + 20, doorY + 30, GREEN, 15, 3);
          }
        }
      }
    }
    
    function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, blur = 15) {
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
      ctx.shadowBlur = 0;
    }
    
    function drawPlayer(ctx: CanvasRenderingContext2D) {
      const p = game.player;
      
      ctx.save();
      ctx.translate(p.x, p.y);
      
      const angle = Math.atan2(p.vy, p.vx) * 0.2;
      ctx.rotate(angle);
      
      ctx.fillStyle = WHITE;
      ctx.shadowBlur = 20;
      ctx.shadowColor = CYAN;
      
      switch(p.form) {
        case 'circle':
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'triangle':
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size, p.size);
          ctx.lineTo(-p.size, p.size);
          ctx.closePath();
          ctx.fill();
          break;
        case 'square':
          ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);
          break;
      }
      
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    
    function draw() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      const shakeX = game.cameraShake > 0.5 ? (Math.random() - 0.5) * game.cameraShake : 0;
      const shakeY = game.cameraShake > 0.5 ? (Math.random() - 0.5) * game.cameraShake : 0;
      ctx.save();
      ctx.translate(shakeX, shakeY);
      
      if (game.screenFlash > 0) {
        ctx.fillStyle = `rgba(0, 255, 255, ${game.screenFlash * 0.1})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
      
      if (game.scene === 'coldOpen') {
        ctx.fillStyle = BLACK;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        const alpha = Math.min(1, game.coldOpenTimer / 60);
        const fadeOut = game.coldOpenTimer > 280 ? (360 - game.coldOpenTimer) / 80 : 1;
        
        ctx.globalAlpha = alpha * fadeOut;
        ctx.fillStyle = WHITE;
        ctx.font = '22px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('"Progress always removes something of equal value."', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        
        if (game.coldOpenTimer > 120) {
          ctx.font = '16px monospace';
          ctx.fillStyle = GRAY;
          ctx.fillText('Press ENTER to continue', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
        }
        ctx.globalAlpha = 1;
      }
      
      else if (game.scene === 'menu') {
        ctx.fillStyle = BLACK;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        ctx.fillStyle = WHITE;
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = WHITE;
        ctx.shadowBlur = 25;
        ctx.fillText('BALANCE IS A LIE', CANVAS_WIDTH / 2, 150);
        ctx.shadowBlur = 0;
        
        ctx.font = '14px monospace';
        ctx.fillStyle = GRAY;
        ctx.fillText('A game about Equivalent Exchange', CANVAS_WIDTH / 2, 190);
        
        const options = ['Start Game', 'How to Play', 'About', 'Credits'];
        ctx.font = '22px monospace';
        options.forEach((opt, i) => {
          ctx.fillStyle = i === game.menuSelection ? CYAN : GRAY;
          if (i === game.menuSelection) {
            ctx.shadowColor = CYAN;
            ctx.shadowBlur = 12;
          }
          ctx.fillText(opt, CANVAS_WIDTH / 2, 290 + i * 50);
          ctx.shadowBlur = 0;
        });
        
        ctx.font = '12px monospace';
        ctx.fillStyle = GRAY;
        ctx.fillText('Arrow Keys to navigate, Enter to select', CANVAS_WIDTH / 2, 540);
      }
      
      else if (game.scene === 'howToPlay') {
        ctx.fillStyle = BLACK;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        ctx.fillStyle = WHITE;
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('HOW TO PLAY', CANVAS_WIDTH / 2, 70);
        
        ctx.font = '15px monospace';
        ctx.textAlign = 'left';
        const controls = [
          { label: 'Move:', value: 'Arrow Keys or A/D' },
          { label: 'Jump:', value: 'Space or W or Up' },
          { label: 'Switch Form:', value: 'Shift (or 1/2/3)' },
          { label: 'Pause:', value: 'Tab or Escape' }
        ];
        
        controls.forEach((c, i) => {
          ctx.fillStyle = WHITE;
          ctx.fillText(c.label, 180, 140 + i * 35);
          ctx.fillStyle = CYAN;
          ctx.fillText(c.value, 340, 140 + i * 35);
        });
        
        ctx.fillStyle = WHITE;
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('FORMS & COSTS', CANVAS_WIDTH / 2, 320);
        
        ctx.font = '13px monospace';
        ctx.textAlign = 'left';
        const forms = [
          { name: 'Circle', bonus: '1.5x speed', cost: 'Screen shrinks if idle 3s' },
          { name: 'Triangle', bonus: '1.4x jump', cost: 'Gravity +5% per jump' },
          { name: 'Square', bonus: 'Stable', cost: 'Speed decays over time' }
        ];
        
        forms.forEach((f, i) => {
          const y = 360 + i * 55;
          ctx.fillStyle = CYAN;
          ctx.fillText(f.name, 120, y);
          ctx.fillStyle = WHITE;
          ctx.fillText(f.bonus, 220, y);
          ctx.fillStyle = RED;
          ctx.fillText('Cost: ' + f.cost, 220, y + 18);
        });
        
        ctx.fillStyle = GRAY;
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Press ESC or ENTER to return', CANVAS_WIDTH / 2, 570);
      }
      
      else if (game.scene === 'about') {
        ctx.fillStyle = BLACK;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        ctx.fillStyle = WHITE;
        ctx.font = 'bold 26px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ABOUT', CANVAS_WIDTH / 2, 60);
        
        ctx.font = '14px monospace';
        ctx.fillStyle = GRAY;
        const aboutText = [
          '"Balance is a Lie" is a precision platformer',
          'exploring the theme of Equivalent Exchange.',
          '',
          'Every advantage comes with a cost.',
          'Every action has consequences.',
          'Every form demands a sacrifice.',
          '',
          'The game features 8 levels, each introducing',
          'a new twist. Deaths feel fair but unexpected.',
          '',
          'This is about understanding rules and',
          'choosing what you are willing to lose.'
        ];
        
        aboutText.forEach((line, i) => {
          ctx.fillStyle = line.includes('Equivalent Exchange') ? CYAN : 
                          line.includes('sacrifice') || line.includes('cost') ? RED : GRAY;
          ctx.fillText(line, CANVAS_WIDTH / 2, 110 + i * 26);
        });
        
        ctx.fillStyle = YELLOW;
        ctx.font = 'bold 14px monospace';
        ctx.fillText('THE 8 LEVELS:', CANVAS_WIDTH / 2, 440);
        
        ctx.font = '11px monospace';
        ctx.fillStyle = WHITE;
        const lvlNames = [
          '1. Trust - Build confidence',
          '2. Inversion - Gravity betrayal',
          '3. Pursuit - Delayed punishment',
          '4. False Ground - Platform lies',
          '5. Compression - Shrinking space',
          '6. Labels Lie - Mind games',
          '7. Greed - Patience test',
          '8. Equivalent Exchange - Final cost'
        ];
        lvlNames.forEach((n, i) => {
          ctx.fillText(n, CANVAS_WIDTH / 2, 465 + i * 16);
        });
        
        ctx.fillStyle = GRAY;
        ctx.font = '14px monospace';
        ctx.fillText('Press ESC or ENTER to return', CANVAS_WIDTH / 2, 580);
      }
      
      else if (game.scene === 'credits') {
        ctx.fillStyle = BLACK;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        ctx.fillStyle = WHITE;
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CREDITS', CANVAS_WIDTH / 2, 120);
        
        ctx.font = '18px monospace';
        ctx.fillStyle = CYAN;
        ctx.fillText('Team Zero One', CANVAS_WIDTH / 2, 200);
        
        ctx.fillStyle = WHITE;
        ctx.font = '16px monospace';
        const names = ['Nabidnur Abrar', 'Shovon Das', 'Fardin Eihosan Shadin'];
        names.forEach((name, i) => {
          ctx.fillText(name, CANVAS_WIDTH / 2, 260 + i * 35);
        });
        
        ctx.fillStyle = GRAY;
        ctx.font = '14px monospace';
        ctx.fillText('Built for Game Jam', CANVAS_WIDTH / 2, 400);
        ctx.fillText('Theme: Equivalent Exchange', CANVAS_WIDTH / 2, 430);
        
        ctx.fillText('Press ESC or ENTER to return', CANVAS_WIDTH / 2, 550);
      }
      
      else if (game.scene === 'ending') {
        ctx.fillStyle = BLACK;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        ctx.fillStyle = WHITE;
        ctx.font = '26px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('You have finished the game.', CANVAS_WIDTH / 2, 180);
        
        ctx.fillStyle = CYAN;
        ctx.font = '22px monospace';
        ctx.fillText('"What did it cost?"', CANVAS_WIDTH / 2, 240);
        
        ctx.fillStyle = RED;
        ctx.font = '18px monospace';
        ctx.fillText(`Deaths: ${game.deaths}`, CANVAS_WIDTH / 2, 300);
        
        ctx.fillStyle = GRAY;
        ctx.font = '16px monospace';
        ctx.fillText('Team Zero One', CANVAS_WIDTH / 2, 380);
        ctx.fillStyle = WHITE;
        ctx.font = '14px monospace';
        ctx.fillText('Nabidnur Abrar', CANVAS_WIDTH / 2, 415);
        ctx.fillText('Shovon Das', CANVAS_WIDTH / 2, 438);
        ctx.fillText('Fardin Eihosan Shadin', CANVAS_WIDTH / 2, 461);
        
        ctx.fillStyle = GRAY;
        ctx.fillText('Thanks for playing', CANVAS_WIDTH / 2, 510);
        ctx.fillText('Press ENTER to return to menu', CANVAS_WIDTH / 2, 550);
      }
      
      else if (game.scene === 'paused') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        ctx.fillStyle = WHITE;
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', CANVAS_WIDTH / 2, 200);
        
        const options = ['Resume', 'Restart Level', 'Exit to Menu'];
        ctx.font = '22px monospace';
        options.forEach((opt, i) => {
          ctx.fillStyle = i === game.pauseSelection ? CYAN : GRAY;
          ctx.fillText(opt, CANVAS_WIDTH / 2, 300 + i * 50);
        });
      }
      
      else if (game.scene === 'levelComplete') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        ctx.fillStyle = GREEN;
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = GREEN;
        ctx.shadowBlur = 20;
        ctx.fillText('LEVEL COMPLETE', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);
        ctx.shadowBlur = 0;
        
        ctx.fillStyle = GRAY;
        ctx.font = '16px monospace';
        ctx.fillText('Press ENTER to continue', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);
      }
      
      else if (game.scene === 'playing') {
        ctx.fillStyle = BLACK;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        const level = levels[game.currentLevel] as any;
        
        if (game.camera.viewportLeft > 0) {
          ctx.fillStyle = RED;
          ctx.globalAlpha = 0.4;
          ctx.fillRect(0, 0, game.camera.viewportLeft, CANVAS_HEIGHT);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = RED;
          ctx.lineWidth = 3;
          ctx.shadowColor = RED;
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.moveTo(game.camera.viewportLeft, 0);
          ctx.lineTo(game.camera.viewportLeft, CANVAS_HEIGHT);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
        
        if (level.id === 5) {
          ctx.fillStyle = RED;
          ctx.globalAlpha = 0.4;
          ctx.fillRect(0, 0, CANVAS_WIDTH, game.camera.viewportTop);
          ctx.fillRect(0, game.camera.viewportBottom, CANVAS_WIDTH, CANVAS_HEIGHT - game.camera.viewportBottom);
          ctx.globalAlpha = 1;
        }
        
        if (level.id === 3 && game.levelState.chaserActive) {
          ctx.fillStyle = RED;
          ctx.globalAlpha = 0.4;
          ctx.fillRect(0, 0, game.levelState.chaserX, CANVAS_HEIGHT);
          ctx.globalAlpha = 1;
          
          for (let y = 0; y < CANVAS_HEIGHT; y += 25) {
            ctx.fillStyle = RED;
            ctx.beginPath();
            ctx.moveTo(game.levelState.chaserX, y);
            ctx.lineTo(game.levelState.chaserX + 15, y + 12);
            ctx.lineTo(game.levelState.chaserX, y + 25);
            ctx.fill();
          }
        }
        
        if (level.ceiling) {
          drawGlow(ctx, 0, level.ceiling.y, CANVAS_WIDTH, level.ceiling.h, WHITE, 8);
        }
        
        level.ceilingSpikes?.forEach((spike: any) => {
          ctx.fillStyle = RED;
          ctx.shadowColor = RED;
          ctx.shadowBlur = 12;
          for (let x = spike.x; x < spike.x + spike.w; x += 20) {
            ctx.beginPath();
            ctx.moveTo(x + 10, spike.y + 25);
            ctx.lineTo(x + 20, spike.y);
            ctx.lineTo(x, spike.y);
            ctx.closePath();
            ctx.fill();
          }
          ctx.shadowBlur = 0;
        });
        
        level.platforms.forEach((plat: any, idx: number) => {
          const state = game.levelState.platformStates[idx];
          if (!state || (plat.type === 'false' && state.fallen)) return;
          
          let platW = plat.type === 'growing' ? state.currentW : plat.w;
          let color = WHITE;
          
          if (plat.type === 'false' && state.fallTimer > 0) {
            color = YELLOW;
          }
          
          drawGlow(ctx, plat.x, plat.y, platW, plat.h || 20, color, 10);
        });
        
        if (level.spikePit) {
          ctx.fillStyle = RED;
          ctx.globalAlpha = 0.3;
          ctx.fillRect(0, level.spikePit.y, CANVAS_WIDTH, level.spikePit.h);
          ctx.globalAlpha = 1;
        }
        
        level.spikes?.forEach((spike: any) => {
          ctx.fillStyle = RED;
          ctx.shadowColor = RED;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.moveTo(spike.x + 10, (spike.y || 550) - 20);
          ctx.lineTo(spike.x + 20, spike.y || 550);
          ctx.lineTo(spike.x, spike.y || 550);
          ctx.closePath();
          ctx.fill();
          ctx.shadowBlur = 0;
        });
        
        if (level.id === 2 && game.levelState.delayedSpikeActive && game.levelState.delayedSpikeTimer <= 0) {
          const ds = level.delayedSpike;
          ctx.fillStyle = RED;
          ctx.shadowColor = RED;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.moveTo(ds.x + 20, ds.y - 30);
          ctx.lineTo(ds.x + 40, ds.y);
          ctx.lineTo(ds.x, ds.y);
          ctx.closePath();
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        
        if (level.id === 5 && level.fakeSpike) {
          ctx.fillStyle = GRAY;
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.moveTo(level.fakeSpike.x + 10, level.fakeSpike.y - 20);
          ctx.lineTo(level.fakeSpike.x + 20, level.fakeSpike.y);
          ctx.lineTo(level.fakeSpike.x, level.fakeSpike.y);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        
        if (level.id === 8 && level.movingSpikes) {
          level.movingSpikes.forEach((spike: any) => {
            if (game.frameCount > spike.delay) {
              ctx.fillStyle = RED;
              ctx.shadowColor = RED;
              ctx.shadowBlur = 12;
              ctx.beginPath();
              ctx.moveTo(spike.x + 10, spike.y - 25);
              ctx.lineTo(spike.x + 20, spike.y);
              ctx.lineTo(spike.x, spike.y);
              ctx.closePath();
              ctx.fill();
              ctx.shadowBlur = 0;
            }
          });
        }
        
        if (level.doors) {
          level.doors.forEach((door: any) => {
            ctx.fillStyle = door.color;
            ctx.shadowColor = door.color;
            ctx.shadowBlur = 15;
            ctx.fillRect(door.x, door.y, door.w, door.h);
            ctx.shadowBlur = 0;
            
            if (door.label) {
              ctx.fillStyle = WHITE;
              ctx.font = 'bold 12px monospace';
              ctx.textAlign = 'center';
              ctx.fillText(door.label, door.x + door.w / 2, door.y - 8);
            }
          });
        } else {
          const door = level.door;
          const doorY = level.id === 7 ? game.levelState.doorY : door.y;
          let doorColor = GREEN;
          
          if (level.id === 8) {
            const allTriggered = game.levelState.exchangeSpeed && 
                                game.levelState.exchangeGravity && 
                                game.levelState.exchangeShrink;
            doorColor = allTriggered ? GREEN : GRAY;
          }
          
          ctx.fillStyle = doorColor;
          ctx.shadowColor = doorColor;
          ctx.shadowBlur = 15;
          ctx.fillRect(door.x, doorY, door.w, door.h);
          ctx.shadowBlur = 0;
        }
        
        if (game.player.alive) {
          drawPlayer(ctx);
        }
        
        game.particles.forEach(p => p.draw(ctx));
        
        ctx.fillStyle = WHITE;
        ctx.font = '14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`Level ${game.currentLevel + 1}: ${level.name}`, 15, 25);
        ctx.fillStyle = GRAY;
        ctx.font = '11px monospace';
        ctx.fillText(level.subtitle, 15, 42);
        
        ctx.textAlign = 'right';
        ctx.fillStyle = GRAY;
        ctx.font = '13px monospace';
        const formName = game.player.form.charAt(0).toUpperCase() + game.player.form.slice(1);
        ctx.fillText(`Form: ${formName}`, CANVAS_WIDTH - 15, 25);
        
        if (game.player.gravityMultiplier > 1.01) {
          ctx.fillStyle = RED;
          ctx.fillText(`Gravity: +${Math.round((game.player.gravityMultiplier - 1) * 100)}%`, CANVAS_WIDTH - 15, 42);
        }
        
        if (game.player.speedDecay < 0.99) {
          ctx.fillStyle = RED;
          ctx.fillText(`Speed: ${Math.round(game.player.speedDecay * 100)}%`, CANVAS_WIDTH - 15, 59);
        }
        
        if (game.player.form === 'circle' && game.player.idleTime > 60) {
          const warning = game.player.idleTime > 150 ? 'SHRINKING!' : `Idle: ${Math.ceil((180 - game.player.idleTime) / 60)}s`;
          ctx.fillStyle = game.player.idleTime > 150 ? RED : YELLOW;
          ctx.fillText(warning, CANVAS_WIDTH - 15, 76);
        }
        
        if (level.id === 8) {
          ctx.textAlign = 'center';
          ctx.fillStyle = CYAN;
          ctx.font = '16px monospace';
          ctx.fillText('"What will you give?"', CANVAS_WIDTH / 2, 85);
          
          ctx.font = '11px monospace';
          ctx.fillStyle = game.levelState.exchangeSpeed ? GREEN : GRAY;
          ctx.fillText(`Speed Loss: ${game.levelState.exchangeSpeed ? 'YES' : 'Use Square'}`, CANVAS_WIDTH / 2, 105);
          ctx.fillStyle = game.levelState.exchangeGravity ? GREEN : GRAY;
          ctx.fillText(`Gravity Tax: ${game.levelState.exchangeGravity ? 'YES' : 'Jump as Triangle'}`, CANVAS_WIDTH / 2, 120);
          ctx.fillStyle = game.levelState.exchangeShrink ? GREEN : GRAY;
          ctx.fillText(`Screen Shrink: ${game.levelState.exchangeShrink ? 'YES' : 'Idle as Circle'}`, CANVAS_WIDTH / 2, 135);
        }
        
        ctx.textAlign = 'left';
        ctx.fillStyle = GRAY;
        ctx.font = '11px monospace';
        ctx.fillText(`Deaths: ${game.deaths}`, 15, CANVAS_HEIGHT - 15);
        
        if (!game.player.alive) {
          ctx.fillStyle = RED;
          ctx.font = 'bold 40px monospace';
          ctx.textAlign = 'center';
          ctx.shadowColor = RED;
          ctx.shadowBlur = 25;
          ctx.fillText('DEATH', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
          ctx.shadowBlur = 0;
        }
      }
      
      ctx.restore();
    }
    
    function gameLoop() {
      update();
      draw();
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    }
    
    gameLoop();
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div 
      style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        backgroundColor: '#000',
        margin: 0,
        padding: 0
      }}
      data-testid="game-container"
    >
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={600}
        style={{ 
          border: '1px solid #222',
          display: 'block'
        }}
        data-testid="game-canvas"
      />
    </div>
  );
};

export default BalanceIsALie;
