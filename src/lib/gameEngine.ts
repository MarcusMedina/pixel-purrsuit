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
    const walkCycle = Math.floor(this.animFrame / 10) % 2;
    
    // Shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.fillRect(x + 2, y + height, width - 4, 3);
    
    // Body with outline
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 2;
    this.ctx.fillStyle = color;
    
    if (type === 'cat') {
      // Cat body
      this.ctx.fillRect(x + 4, y + 8, width - 8, height - 12);
      this.ctx.strokeRect(x + 4, y + 8, width - 8, height - 12);
      
      // Cat head
      this.ctx.fillRect(x + 2, y + 2, width - 4, 10);
      this.ctx.strokeRect(x + 2, y + 2, width - 4, 10);
      
      // Ears
      this.ctx.fillRect(x + 2, y, 4, 4);
      this.ctx.fillRect(x + width - 6, y, 4, 4);
      
      // Eyes
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.fillRect(x + 6, y + 4, 3, 3);
      this.ctx.fillRect(x + width - 9, y + 4, 3, 3);
      
      // Legs (walking animation)
      this.ctx.fillStyle = color;
      if (walkCycle === 0) {
        this.ctx.fillRect(x + 4, y + height - 4, 3, 4);
        this.ctx.fillRect(x + width - 7, y + height - 6, 3, 6);
      } else {
        this.ctx.fillRect(x + 4, y + height - 6, 3, 6);
        this.ctx.fillRect(x + width - 7, y + height - 4, 3, 4);
      }
      
    } else if (type === 'mouse') {
      // Mouse body
      this.ctx.fillRect(x + 4, y + 8, width - 8, height - 10);
      this.ctx.strokeRect(x + 4, y + 8, width - 8, height - 10);
      
      // Mouse head
      this.ctx.fillRect(x + (direction > 0 ? width - 8 : 2), y + 4, 6, 8);
      this.ctx.strokeRect(x + (direction > 0 ? width - 8 : 2), y + 4, 6, 8);
      
      // Ear
      this.ctx.fillRect(x + (direction > 0 ? width - 6 : 4), y + 2, 4, 4);
      
      // Tail
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(x + (direction > 0 ? 4 : width - 4), y + height - 4);
      this.ctx.lineTo(x + (direction > 0 ? 0 : width), y + height - 8);
      this.ctx.stroke();
      
    } else if (type === 'dog') {
      // Dog body
      this.ctx.fillRect(x + 4, y + 10, width - 8, height - 14);
      this.ctx.strokeRect(x + 4, y + 10, width - 8, height - 14);
      
      // Dog head
      this.ctx.fillRect(x + 8, y + 4, width - 16, 12);
      this.ctx.strokeRect(x + 8, y + 4, width - 16, 12);
      
      // Snout
      this.ctx.fillRect(x + (direction > 0 ? width - 10 : 6), y + 8, 6, 6);
      
      // Legs
      this.ctx.fillRect(x + 6, y + height - 4, 4, 4);
      this.ctx.fillRect(x + width - 10, y + height - 4, 4, 4);
    }
  }

  private draw() {
    // Clear with lighter background
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw platforms with gradient
    this.platforms.forEach(p => {
      const gradient = this.ctx.createLinearGradient(p.x, p.y, p.x, p.y + 8);
      gradient.addColorStop(0, '#ff00ff');
      gradient.addColorStop(1, '#cc00cc');
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(p.x, p.y, p.width, 8);
      
      // Platform outline
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(p.x, p.y, p.width, 8);
    });
    
    // Draw ladders
    this.ctx.strokeStyle = '#ffff00';
    this.ctx.lineWidth = 3;
    this.ladders.forEach(l => {
      for (let i = 0; i < l.height; i += 10) {
        this.ctx.strokeRect(l.x - 8, l.y + i, 16, 10);
      }
    });
    
    // Draw teleporters with glow
    this.teleporters.forEach(t => {
      const pulse = Math.sin(this.animFrame / 20) * 0.3 + 0.7;
      this.ctx.fillStyle = `rgba(160, 32, 240, ${pulse})`;
      this.ctx.beginPath();
      this.ctx.arc(t.x, t.y, 12, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    });
    
    // Draw power-ups
    this.powerUps.forEach(p => {
      const bob = Math.sin(this.animFrame / 15) * 2;
      this.ctx.fillStyle = p.type === 'vitamin' ? '#00ff00' : '#ff8800';
      this.ctx.fillRect(p.x - 8, p.y - 8 + bob, 16, 16);
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(p.x - 8, p.y - 8 + bob, 16, 16);
    });
    
    // Draw dog
    this.drawSprite(this.dog.x, this.dog.y, this.dog.width, this.dog.height, '#ff0000', 'dog', this.dog.vx > 0 ? 1 : -1);
    
    // Draw mice
    this.mice.forEach(m => {
      this.drawSprite(m.x, m.y, m.width, m.height, '#ffff00', 'mouse', m.direction);
    });
    
    // Draw player with invincibility flash
    if (this.player.invincible === 0 || Math.floor(this.animFrame / 5) % 2 === 0) {
      this.drawSprite(this.player.x, this.player.y, this.player.width, this.player.height, '#00ffff', 'cat', this.player.direction);
    }
    
    // Draw invincibility indicator
    if (this.player.invincible > 0) {
      this.ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
      this.ctx.beginPath();
      this.ctx.arc(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, 18, 0, Math.PI * 2);
      this.ctx.fill();
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
