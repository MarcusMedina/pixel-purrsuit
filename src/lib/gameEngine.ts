interface GameCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
}

interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
}

interface Platform {
  x: number;
  y: number;
  width: number;
}

interface Ladder {
  x: number;
  y: number;
  height: number;
}

interface Teleporter {
  x: number;
  y: number;
  linkedTo: number;
}

interface PowerUp {
  x: number;
  y: number;
  type: 'catnip' | 'vitamin';
}

interface Mouse extends GameObject {
  direction: number;
  onPlatform: number;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: GameCallbacks;
  private animationFrame: number = 0;
  private keys: Set<string> = new Set();
  
  private player: GameObject & { direction: number; onLadder: boolean; speed: number; speedBoost: number };
  private mice: Mouse[] = [];
  private dog: GameObject;
  private platforms: Platform[] = [];
  private ladders: Ladder[] = [];
  private teleporters: Teleporter[] = [];
  private powerUps: PowerUp[] = [];
  
  private score = 0;
  private lives = 3;
  private level = 1;
  private miceEaten = 0;
  private micePerLevel = 5;
  
  private readonly GRAVITY = 0.5;
  private readonly JUMP_FORCE = -12;
  private readonly PLAYER_SPEED = 4;
  private readonly MOUSE_SPEED = 2;
  private readonly CELL_SIZE = 40;

  constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, callbacks: GameCallbacks) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.callbacks = callbacks;
    
    this.player = {
      x: 100,
      y: 500,
      width: 20,
      height: 20,
      vx: 0,
      vy: 0,
      direction: 1,
      onLadder: false,
      speed: this.PLAYER_SPEED,
      speedBoost: 0
    };
    
    this.dog = {
      x: 400,
      y: 560,
      width: 30,
      height: 30,
      vx: 3,
      vy: 0
    };
    
    this.setupLevel();
    this.setupControls();
  }

  private setupControls() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key);
      if (e.key === ' ') e.preventDefault();
    });
    
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key);
    });
  }

  private setupLevel() {
    this.platforms = [];
    this.ladders = [];
    this.teleporters = [];
    this.powerUps = [];
    this.mice = [];
    
    // Generate platforms
    const levels = [550, 450, 350, 250, 150];
    levels.forEach((y, i) => {
      const numPlatforms = 2 + Math.floor(Math.random() * 3);
      for (let j = 0; j < numPlatforms; j++) {
        const x = Math.random() * (this.canvas.width - 200);
        const width = 80 + Math.random() * 120;
        this.platforms.push({ x, y, width });
      }
    });
    
    // Add floor
    this.platforms.push({ x: 0, y: 580, width: this.canvas.width });
    
    // Generate ladders
    for (let i = 0; i < 8; i++) {
      const platform = this.platforms[Math.floor(Math.random() * this.platforms.length)];
      if (platform.y < 580) {
        this.ladders.push({
          x: platform.x + platform.width / 2,
          y: platform.y - 80,
          height: 80
        });
      }
    }
    
    // Generate teleporters
    for (let i = 0; i < 4; i += 2) {
      const p1 = this.platforms[Math.floor(Math.random() * this.platforms.length)];
      const p2 = this.platforms[Math.floor(Math.random() * this.platforms.length)];
      this.teleporters.push({ x: p1.x + 20, y: p1.y - 20, linkedTo: i + 1 });
      this.teleporters.push({ x: p2.x + 20, y: p2.y - 20, linkedTo: i });
    }
    
    // Generate power-ups
    for (let i = 0; i < 3; i++) {
      const platform = this.platforms[Math.floor(Math.random() * this.platforms.length)];
      this.powerUps.push({
        x: platform.x + Math.random() * platform.width,
        y: platform.y - 20,
        type: Math.random() > 0.5 ? 'catnip' : 'vitamin'
      });
    }
    
    // Generate mice
    for (let i = 0; i < this.micePerLevel; i++) {
      const platform = this.platforms[Math.floor(Math.random() * (this.platforms.length - 1))];
      this.mice.push({
        x: platform.x + Math.random() * platform.width,
        y: platform.y - 20,
        width: 16,
        height: 16,
        vx: this.MOUSE_SPEED * (Math.random() > 0.5 ? 1 : -1),
        vy: 0,
        direction: Math.random() > 0.5 ? 1 : -1,
        onPlatform: this.platforms.indexOf(platform)
      });
    }
  }

  private handleInput() {
    if (this.keys.has('ArrowLeft')) {
      this.player.vx = -this.player.speed;
      this.player.direction = -1;
    } else if (this.keys.has('ArrowRight')) {
      this.player.vx = this.player.speed;
      this.player.direction = 1;
    } else {
      this.player.vx = 0;
    }
    
    if (this.keys.has('ArrowUp') && this.isOnLadder()) {
      this.player.vy = -this.PLAYER_SPEED;
      this.player.onLadder = true;
    } else if (this.player.onLadder && !this.isOnLadder()) {
      this.player.onLadder = false;
    }
    
    if (this.keys.has(' ') && this.isOnGround()) {
      this.player.vy = this.JUMP_FORCE;
    }
  }

  private isOnGround(): boolean {
    return this.platforms.some(p => 
      this.player.y + this.player.height >= p.y &&
      this.player.y + this.player.height <= p.y + 10 &&
      this.player.x + this.player.width > p.x &&
      this.player.x < p.x + p.width
    );
  }

  private isOnLadder(): boolean {
    return this.ladders.some(l =>
      this.player.x > l.x - 10 &&
      this.player.x < l.x + 10 &&
      this.player.y >= l.y &&
      this.player.y <= l.y + l.height
    );
  }

  private updatePlayer() {
    this.handleInput();
    
    if (!this.player.onLadder) {
      this.player.vy += this.GRAVITY;
    }
    
    this.player.x += this.player.vx;
    this.player.y += this.player.vy;
    
    // Platform collision
    this.platforms.forEach(platform => {
      if (
        this.player.x + this.player.width > platform.x &&
        this.player.x < platform.x + platform.width &&
        this.player.y + this.player.height > platform.y &&
        this.player.y + this.player.height < platform.y + 10 &&
        this.player.vy > 0
      ) {
        this.player.y = platform.y - this.player.height;
        this.player.vy = 0;
      }
    });
    
    // Bounds
    this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.width, this.player.x));
    this.player.y = Math.min(this.canvas.height - this.player.height, this.player.y);
    
    // Speed boost decay
    if (this.player.speedBoost > 0) {
      this.player.speedBoost--;
      this.player.speed = this.PLAYER_SPEED + 2;
    } else {
      this.player.speed = this.PLAYER_SPEED;
    }
  }

  private updateMice() {
    this.mice.forEach(mouse => {
      mouse.x += mouse.vx;
      
      const platform = this.platforms[mouse.onPlatform];
      if (platform) {
        if (mouse.x < platform.x || mouse.x > platform.x + platform.width - mouse.width) {
          mouse.vx *= -1;
          mouse.direction *= -1;
        }
      }
    });
  }

  private updateDog() {
    this.dog.x += this.dog.vx;
    if (this.dog.x < 0 || this.dog.x > this.canvas.width - this.dog.width) {
      this.dog.vx *= -1;
    }
  }

  private checkCollisions() {
    // Check mouse collisions
    this.mice.forEach((mouse, index) => {
      const dx = this.player.x - mouse.x;
      const dy = this.player.y - mouse.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 20) {
        // Check if attacking from behind
        const behindMouse = (this.player.direction === 1 && dx < 0) || (this.player.direction === -1 && dx > 0);
        
        if (behindMouse || Math.abs(dy) > 10) {
          // Eat mouse
          this.mice.splice(index, 1);
          this.score += 50;
          this.miceEaten++;
          this.callbacks.onScoreChange(this.score);
          
          if (this.miceEaten >= this.micePerLevel) {
            this.nextLevel();
          }
        } else {
          // Mouse bites
          this.loseLife();
        }
      }
    });
    
    // Check dog collision
    const dogDx = this.player.x - this.dog.x;
    const dogDy = this.player.y - this.dog.y;
    const dogDistance = Math.sqrt(dogDx * dogDx + dogDy * dogDy);
    if (dogDistance < 25) {
      this.loseLife();
    }
    
    // Check teleporter collision
    this.teleporters.forEach((teleporter, index) => {
      const dx = this.player.x - teleporter.x;
      const dy = this.player.y - teleporter.y;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
        const linked = this.teleporters[teleporter.linkedTo];
        if (linked) {
          this.player.x = linked.x;
          this.player.y = linked.y;
        }
      }
    });
    
    // Check power-up collision
    this.powerUps.forEach((powerUp, index) => {
      const dx = this.player.x - powerUp.x;
      const dy = this.player.y - powerUp.y;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
        this.powerUps.splice(index, 1);
        this.score += 25;
        this.callbacks.onScoreChange(this.score);
        
        if (powerUp.type === 'vitamin') {
          this.player.speedBoost = 300;
          if (this.lives < 3) {
            this.lives++;
            this.callbacks.onLivesChange(this.lives);
          }
        } else {
          this.player.speedBoost = -150; // Slow effect
          if (this.lives < 3) {
            this.lives++;
            this.callbacks.onLivesChange(this.lives);
          }
        }
      }
    });
  }

  private loseLife() {
    this.lives--;
    this.callbacks.onLivesChange(this.lives);
    this.player.x = 100;
    this.player.y = 500;
    this.player.vx = 0;
    this.player.vy = 0;
    
    if (this.lives <= 0) {
      this.gameOver();
    }
  }

  private nextLevel() {
    this.level++;
    this.score += 100;
    this.miceEaten = 0;
    this.callbacks.onLevelChange(this.level);
    this.callbacks.onScoreChange(this.score);
    this.setupLevel();
    this.player.x = 100;
    this.player.y = 500;
  }

  private gameOver() {
    alert(`GAME OVER! Final Score: ${this.score}`);
    location.reload();
  }

  private draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw platforms
    this.ctx.fillStyle = 'hsl(var(--c64-magenta))';
    this.platforms.forEach(p => {
      this.ctx.fillRect(p.x, p.y, p.width, 8);
    });
    
    // Draw ladders
    this.ctx.strokeStyle = 'hsl(var(--c64-yellow))';
    this.ctx.lineWidth = 3;
    this.ladders.forEach(l => {
      for (let i = 0; i < l.height; i += 10) {
        this.ctx.strokeRect(l.x - 8, l.y + i, 16, 10);
      }
    });
    
    // Draw teleporters
    this.ctx.fillStyle = 'hsl(var(--c64-purple))';
    this.teleporters.forEach(t => {
      this.ctx.beginPath();
      this.ctx.arc(t.x, t.y, 10, 0, Math.PI * 2);
      this.ctx.fill();
    });
    
    // Draw power-ups
    this.powerUps.forEach(p => {
      this.ctx.fillStyle = p.type === 'vitamin' ? 'hsl(var(--c64-green))' : 'hsl(var(--c64-orange))';
      this.ctx.fillRect(p.x - 8, p.y - 8, 16, 16);
    });
    
    // Draw dog
    this.ctx.fillStyle = 'hsl(var(--c64-red))';
    this.ctx.fillRect(this.dog.x, this.dog.y, this.dog.width, this.dog.height);
    
    // Draw mice
    this.ctx.fillStyle = 'hsl(var(--c64-yellow))';
    this.mice.forEach(m => {
      this.ctx.fillRect(m.x, m.y, m.width, m.height);
    });
    
    // Draw player
    this.ctx.fillStyle = 'hsl(var(--c64-cyan))';
    this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
  }

  private update() {
    this.updatePlayer();
    this.updateMice();
    this.updateDog();
    this.checkCollisions();
    this.draw();
    
    this.animationFrame = requestAnimationFrame(() => this.update());
  }

  public start() {
    this.update();
  }

  public stop() {
    cancelAnimationFrame(this.animationFrame);
  }
}
