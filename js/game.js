// 스네이크 게임 엔진
// -------------------------------------------------------------
// Canvas 위에서 격자 기반 뱀 이동 / 사과 / 충돌 / 점수를 관리한다.
// DOM/Firebase와 분리된 순수 게임 로직 + 렌더링 모듈.

export const COLS = 20;
export const ROWS = 15;

// 점수에 따른 속도(프레임 간격 ms). 낮을수록 빠르다.
const BASE_INTERVAL = 140;
const MIN_INTERVAL = 70;
const SPEEDUP_PER_APPLE = 4;

const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export class SnakeGame {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ onScore?: (score:number)=>void, onGameOver?: (score:number)=>void, onEat?: ()=>void }} callbacks
   */
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.callbacks = callbacks;

    this.cellW = canvas.width / COLS;
    this.cellH = canvas.height / ROWS;

    this._rafId = null;
    this._lastTick = 0;
    this.reset();
  }

  reset() {
    // 보드 중앙에서 오른쪽을 향해 길이 3으로 시작.
    const startX = Math.floor(COLS / 2);
    const startY = Math.floor(ROWS / 2);
    this.snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
    ];
    this.direction = DIRECTIONS.right;
    this.nextDirection = DIRECTIONS.right;
    this.score = 0;
    this.running = false;
    this.paused = false;
    this.gameOver = false;
    this.apple = this._spawnApple();
    this._draw();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.gameOver = false;
    this._lastTick = performance.now();
    this._loop(this._lastTick);
  }

  togglePause() {
    if (!this.running || this.gameOver) return;
    this.paused = !this.paused;
    if (!this.paused) {
      // 재개 시 타이밍이 튀지 않도록 기준 시각을 재설정한다.
      this._lastTick = performance.now();
      this._loop(this._lastTick);
    }
    return this.paused;
  }

  stop() {
    this.running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /** 방향 입력. 반대 방향으로의 즉시 전환은 무시한다. */
  setDirection(name) {
    const dir = DIRECTIONS[name];
    if (!dir) return;
    // 현재 진행 방향의 정반대면 무시(즉사 방지).
    if (dir.x === -this.direction.x && dir.y === -this.direction.y) return;
    this.nextDirection = dir;
  }

  get interval() {
    const interval = BASE_INTERVAL - this.score * SPEEDUP_PER_APPLE;
    return Math.max(MIN_INTERVAL, interval);
  }

  _loop(now) {
    if (!this.running || this.paused) return;
    this._rafId = requestAnimationFrame((t) => this._loop(t));

    if (now - this._lastTick < this.interval) return;
    this._lastTick = now;
    this._step();
  }

  _step() {
    this.direction = this.nextDirection;
    const head = this.snake[0];
    const newHead = { x: head.x + this.direction.x, y: head.y + this.direction.y };

    // 벽 충돌.
    if (newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS) {
      return this._end();
    }
    // 자기 몸 충돌 (사과를 먹지 않는 경우 꼬리는 비워지므로 꼬리 칸은 허용).
    const willGrow = newHead.x === this.apple.x && newHead.y === this.apple.y;
    const body = willGrow ? this.snake : this.snake.slice(0, -1);
    if (body.some((seg) => seg.x === newHead.x && seg.y === newHead.y)) {
      return this._end();
    }

    this.snake.unshift(newHead);

    if (willGrow) {
      this.score += 1;
      this.apple = this._spawnApple();
      this.callbacks.onEat?.();
      this.callbacks.onScore?.(this.score);
    } else {
      this.snake.pop();
    }

    this._draw();
  }

  _end() {
    this.gameOver = true;
    this.stop();
    this.callbacks.onGameOver?.(this.score);
  }

  _spawnApple() {
    // 뱀이 차지하지 않은 빈 칸들 중 하나를 고른다.
    const occupied = new Set(this.snake.map((s) => `${s.x},${s.y}`));
    const free = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!occupied.has(`${x},${y}`)) free.push({ x, y });
      }
    }
    if (free.length === 0) return null; // 보드가 가득 참(승리 상황).
    return free[Math.floor(Math.random() * free.length)];
  }

  _draw() {
    const { ctx, cellW, cellH } = this;
    const styles = getComputedStyle(document.documentElement);
    const gridColor = styles.getPropertyValue("--grid").trim() || "#1f2540";
    const snakeColor = styles.getPropertyValue("--snake").trim() || "#4ade80";
    const headColor = styles.getPropertyValue("--snake-head").trim() || "#22c55e";
    const appleColor = styles.getPropertyValue("--apple").trim() || "#f87171";
    const lineColor = styles.getPropertyValue("--border").trim() || "#323a5e";

    ctx.fillStyle = gridColor;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 격자 선.
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellW, 0);
      ctx.lineTo(x * cellW, this.canvas.height);
      ctx.stroke();
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellH);
      ctx.lineTo(this.canvas.width, y * cellH);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 사과.
    if (this.apple) {
      ctx.fillStyle = appleColor;
      this._roundCell(this.apple.x, this.apple.y, 0.18);
    }

    // 뱀.
    this.snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? headColor : snakeColor;
      this._roundCell(seg.x, seg.y, 0.22);
    });
  }

  _roundCell(cx, cy, padRatio) {
    const { ctx, cellW, cellH } = this;
    const pad = Math.min(cellW, cellH) * padRatio;
    const x = cx * cellW + pad / 2;
    const y = cy * cellH + pad / 2;
    const w = cellW - pad;
    const h = cellH - pad;
    const r = Math.min(w, h) * 0.3;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }
}
