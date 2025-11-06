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
  
  private player: GameObject & { direction: number; onLadder: boolean; speed: number; speedBoost: number; invincible: number };
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
  private highScore = 0;
  private animFrame = 0;
  
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
      y: 100,
      width: 24,
      height: 24,
      vx: 0,
      vy: 0,
      direction: 1,
      onLadder: false,
      speed: this.PLAYER_SPEED,
      speedBoost: 0,
      invincible: 180
    };
    
    this.dog = {
      x: 400,
      y: 560,
      width: 32,
      height: 32,
      vx: 3,
      vy: 0
    };
    
    this.highScore = parseInt(localStorage.getItem('catsHighScore') || '0');
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
    
    // Generate mice (not too close to spawn)
    for (let i = 0; i < this.micePerLevel; i++) {
      const platform = this.platforms[Math.floor(Math.random() * (this.platforms.length - 1))];
      const x = platform.x + Math.random() * platform.width;
      
      // Make sure not too close to player spawn
      if (Math.abs(x - 100) < 150 && platform.y < 200) continue;
      
      this.mice.push({
        x,
        y: platform.y - 22,
        width: 20,
        height: 20,
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
    
    // Invincibility decay
    if (this.player.invincible > 0) {
      this.player.invincible--;
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
      
      if (distance < 22) {
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
        } else if (this.player.invincible === 0) {
          // Mouse bites (only if not invincible)
          this.loseLife();
        }
      }
    });
    
    // Check dog collision (only if not invincible)
    if (this.player.invincible === 0) {
      const dogDx = this.player.x - this.dog.x;
      const dogDy = this.player.y - this.dog.y;
      const dogDistance = Math.sqrt(dogDx * dogDx + dogDy * dogDy);
      if (dogDistance < 28) {
        this.loseLife();
      }
    }
    
    // Check teleporter collision (only when moving over center)
    this.teleporters.forEach((teleporter, index) => {
      const dx = Math.abs(this.player.x + this.player.width / 2 - teleporter.x);
      const dy = Math.abs(this.player.y + this.player.height / 2 - teleporter.y);
      
      // Only teleport when directly on top
      if (dx < 8 && dy < 8 && (Math.abs(this.player.vx) > 1 || Math.abs(this.player.vy) > 1)) {
        const linked = this.teleporters[teleporter.linkedTo];
        if (linked) {
          this.player.x = linked.x - this.player.width / 2;
          this.player.y = linked.y - this.player.height / 2;
          // Add a small cooldown to prevent instant re-teleport
          this.player.invincible = Math.max(this.player.invincible, 30);
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
    this.player.y = 100;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.invincible = 120;
    
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
    this.player.y = 100;
    this.player.invincible = 120;
  }

  private gameOver() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('catsHighScore', this.score.toString());
      alert(`NEW HIGH SCORE! ${this.score}`);
    } else {
      alert(`GAME OVER! Score: ${this.score}\nHigh Score: ${this.highScore}`);
    }
    location.reload();
  }
  
  public getHighScore(): number {
    return this.highScore;
  }

  private drawSprite(x: number, y: number, width: number, height: number, color: string, type: 'cat' | 'mouse' | 'dog', direction: number) {
    this.animFrame++;
    const walkCycle = Math.floor(this.animFrame / 8) % 2;
    
    // Disable anti-aliasing for crisp pixels
    this.ctx.imageSmoothingEnabled = false;
    
    if (type === 'cat') {
      // Classic 8-bit cat in Ice Climber style
      const leftFacing = direction < 0;
      
      // Body (main color)
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x + 6, y + 10, 12, 10);
      
      // Head
      this.ctx.fillRect(x + 4, y + 4, 16, 8);
      
      // Ears
      this.ctx.fillRect(x + 4, y + 2, 3, 3);
      this.ctx.fillRect(x + 13, y + 2, 3, 3);
      
      // Eyes (white)
      this.ctx.fillStyle = '#FFFFFF';
      if (leftFacing) {
        this.ctx.fillRect(x + 6, y + 6, 2, 2);
      } else {
        this.ctx.fillRect(x + 12, y + 6, 2, 2);
      }
      
      // Pupils (black)
      this.ctx.fillStyle = '#000000';
      if (leftFacing) {
        this.ctx.fillRect(x + 6, y + 6, 1, 2);
      } else {
        this.ctx.fillRect(x + 13, y + 6, 1, 2);
      }
      
      // Whiskers
      this.ctx.fillStyle = '#FFFFFF';
      if (leftFacing) {
        this.ctx.fillRect(x + 2, y + 8, 2, 1);
      } else {
        this.ctx.fillRect(x + 16, y + 8, 2, 1);
      }
      
      // Legs (walking animation)
      this.ctx.fillStyle = color;
      if (walkCycle === 0) {
        this.ctx.fillRect(x + 7, y + 20, 3, 4);
        this.ctx.fillRect(x + 14, y + 20, 3, 4);
      } else {
        this.ctx.fillRect(x + 7, y + 20, 3, 4);
        this.ctx.fillRect(x + 14, y + 20, 3, 4);
      }
      
    } else if (type === 'mouse') {
      // Cute mouse in New Zealand Story style
      const leftFacing = direction < 0;
      
      // Body
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x + 6, y + 10, 8, 6);
      
      // Head
      this.ctx.fillRect(x + (leftFacing ? 4 : 8), y + 6, 8, 6);
      
      // Round ear
      this.ctx.fillRect(x + (leftFacing ? 4 : 12), y + 4, 4, 4);
      
      // Eye
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(x + (leftFacing ? 6 : 13), y + 8, 2, 2);
      
      // Nose
      this.ctx.fillStyle = '#FF69B4';
      this.ctx.fillRect(x + (leftFacing ? 4 : 14), y + 10, 2, 1);
      
      // Legs
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x + 7, y + 16, 2, 4);
      this.ctx.fillRect(x + 11, y + 16, 2, 4);
      
      // Round tail (not scorpion-like!)
      this.ctx.fillRect(x + (leftFacing ? 14 : 4), y + 12, 2, 2);
      this.ctx.fillRect(x + (leftFacing ? 16 : 2), y + 10, 2, 2);
      
    } else if (type === 'dog') {
      // Angry dog in classic arcade style
      const leftFacing = direction < 0;
      
      // Body
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x + 4, y + 12, 24, 12);
      
      // Head
      this.ctx.fillRect(x + (leftFacing ? 2 : 20), y + 6, 10, 10);
      
      // Ear
      this.ctx.fillRect(x + (leftFacing ? 2 : 26), y + 4, 4, 4);
      
      // Snout
      this.ctx.fillStyle = '#FFB6C1';
      this.ctx.fillRect(x + (leftFacing ? 0 : 28), y + 10, 4, 4);
      
      // Eye (angry)
      this.ctx.fillStyle = '#FF0000';
      this.ctx.fillRect(x + (leftFacing ? 6 : 22), y + 8, 2, 2);
      
      // Teeth
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.fillRect(x + (leftFacing ? 0 : 28), y + 12, 2, 2);
      
      // Legs
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x + 6, y + 24, 3, 8);
      this.ctx.fillRect(x + 12, y + 24, 3, 8);
      this.ctx.fillRect(x + 18, y + 24, 3, 8);
      this.ctx.fillRect(x + 24, y + 24, 3, 8);
    }
  }

  private draw() {
    // Clear with classic dark blue background (like Ice Climber)
    this.ctx.fillStyle = '#0000AA';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw platforms in classic brick style
    this.platforms.forEach(p => {
      // Main platform color
      this.ctx.fillStyle = '#FF8800';
      this.ctx.fillRect(p.x, p.y, p.width, 8);
      
      // Brick pattern
      this.ctx.fillStyle = '#CC6600';
      for (let i = 0; i < p.width; i += 16) {
        this.ctx.fillRect(p.x + i, p.y + 2, 14, 2);
      }
      
      // Top highlight
      this.ctx.fillStyle = '#FFAA44';
      this.ctx.fillRect(p.x, p.y, p.width, 2);
    });
    
    // Draw ladders in classic style
    this.ctx.fillStyle = '#FFFF00';
    this.ladders.forEach(l => {
      // Vertical rails
      this.ctx.fillRect(l.x - 6, l.y, 3, l.height);
      this.ctx.fillRect(l.x + 3, l.y, 3, l.height);
      
      // Rungs
      for (let i = 0; i < l.height; i += 8) {
        this.ctx.fillRect(l.x - 6, l.y + i, 12, 2);
      }
    });
    
    // Draw teleporters as warp zones
    this.teleporters.forEach((t, idx) => {
      const pulse = Math.sin(this.animFrame / 15) * 0.5 + 0.5;
      
      // Rotating effect
      const colors = ['#FF00FF', '#00FFFF', '#FFFF00', '#00FF00'];
      const colorIdx = (idx + Math.floor(this.animFrame / 10)) % colors.length;
      
      // Main portal
      this.ctx.fillStyle = colors[colorIdx];
      this.ctx.fillRect(t.x - 8, t.y - 8, 16, 16);
      
      // Inner square
      this.ctx.fillStyle = colors[(colorIdx + 2) % colors.length];
      this.ctx.fillRect(t.x - 4, t.y - 4, 8, 8);
      
      // Sparkle effect
      if (pulse > 0.7) {
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(t.x - 1, t.y - 12, 2, 2);
        this.ctx.fillRect(t.x - 12, t.y - 1, 2, 2);
      }
    });
    
    // Draw power-ups with classic icons
    this.powerUps.forEach(p => {
      const bob = Math.sin(this.animFrame / 12) * 3;
      
      if (p.type === 'vitamin') {
        // Heart power-up
        this.ctx.fillStyle = '#FF0000';
        this.ctx.fillRect(p.x - 6, p.y - 4 + bob, 4, 4);
        this.ctx.fillRect(p.x + 2, p.y - 4 + bob, 4, 4);
        this.ctx.fillRect(p.x - 8, p.y + bob, 16, 8);
        this.ctx.fillRect(p.x - 6, p.y + 8 + bob, 12, 4);
        this.ctx.fillRect(p.x - 4, p.y + 12 + bob, 8, 2);
        
        // Shine
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(p.x - 2, p.y + 2 + bob, 2, 2);
      } else {
        // Star power-up
        this.ctx.fillStyle = '#FFFF00';
        // Center
        this.ctx.fillRect(p.x - 2, p.y - 6 + bob, 4, 12);
        this.ctx.fillRect(p.x - 6, p.y - 2 + bob, 12, 4);
        // Diagonals
        this.ctx.fillRect(p.x - 4, p.y - 4 + bob, 2, 2);
        this.ctx.fillRect(p.x + 2, p.y - 4 + bob, 2, 2);
        this.ctx.fillRect(p.x - 4, p.y + 2 + bob, 2, 2);
        this.ctx.fillRect(p.x + 2, p.y + 2 + bob, 2, 2);
      }
    });
    
    // Draw dog
    this.drawSprite(this.dog.x, this.dog.y, this.dog.width, this.dog.height, '#FF0000', 'dog', this.dog.vx > 0 ? 1 : -1);
    
    // Draw mice
    this.mice.forEach(m => {
      this.drawSprite(m.x, m.y, m.width, m.height, '#FFDD00', 'mouse', m.direction);
    });
    
    // Draw player with invincibility flash
    if (this.player.invincible === 0 || Math.floor(this.animFrame / 4) % 2 === 0) {
      this.drawSprite(this.player.x, this.player.y, this.player.width, this.player.height, '#00FFFF', 'cat', this.player.direction);
    }
    
    // Draw invincibility shield
    if (this.player.invincible > 0) {
      const shieldPulse = Math.sin(this.animFrame / 8);
      this.ctx.strokeStyle = `rgba(0, 255, 255, ${0.5 + shieldPulse * 0.3})`;
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(
        this.player.x - 2, 
        this.player.y - 2, 
        this.player.width + 4, 
        this.player.height + 4
      );
    }
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
