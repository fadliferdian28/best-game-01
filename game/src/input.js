// input.js — mouse and keyboard for ROOTBOUND.
// The game polls this once per frame: queued clicks, pressed keys, and the
// live mouse position plus the path the player is currently drawing.

import { W, H } from './config.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mouse = { x: W / 2, y: H / 2, inside: false };
    this.down = false; // left button held
    this.drawPath = []; // points of the path being drawn right now
    this.drawStart = null; // where the current draw began
    this.clicks = []; // {x, y} — consumed once per frame
    this.keys = []; // key strings pressed since last poll
    this.keysDown = new Set();
    this._bound = [];
  }

  attach() {
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      this._bound.push([target, type, fn, opts]);
    };
    on(this.canvas, 'pointermove', (e) => {
      const p = this._toGame(e);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouse.inside = true;
      if (this.down && this.drawStart) {
        const last = this.drawPath[this.drawPath.length - 1];
        // Keep the path smooth: only add points a few pixels apart.
        if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= 4) {
          this.drawPath.push({ x: p.x, y: p.y });
        }
      }
    });
    on(this.canvas, 'pointerdown', (e) => {
      if (e.button !== 0) return;
      const p = this._toGame(e);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.down = true;
      this.drawStart = { x: p.x, y: p.y };
      this.drawPath = [{ x: p.x, y: p.y }];
      this.canvas.setPointerCapture(e.pointerId);
    });
    on(this.canvas, 'pointerup', (e) => {
      if (e.button !== 0) return;
      const p = this._toGame(e);
      this.down = false;
      // A press that barely moved is a click (grub squash, button, branch).
      const moved = this.drawPath.reduce((sum, pt, i, arr) => {
        if (i === 0) return 0;
        return sum + Math.hypot(pt.x - arr[i - 1].x, pt.y - arr[i - 1].y);
      }, 0);
      if (moved < 8) this.clicks.push({ x: p.x, y: p.y });
      this.drawStart = null;
    });
    on(this.canvas, 'pointerleave', () => {
      this.mouse.inside = false;
    });
    on(this.canvas, 'contextmenu', (e) => e.preventDefault());
    on(window, 'keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      this.keys.push(k);
      this.keysDown.add(k);
      // Space scrolls the page; we own it.
      if (k === ' ' || k === 'arrowup' || k === 'arrowdown') e.preventDefault();
    });
    on(window, 'keyup', (e) => {
      this.keysDown.delete(e.key.toLowerCase());
    });
    on(window, 'blur', () => {
      this.keysDown.clear();
      this.down = false;
      this.drawStart = null;
    });
  }

  detach() {
    for (const [target, type, fn, opts] of this._bound) {
      target.removeEventListener(type, fn, opts);
    }
    this._bound = [];
  }

  // Convert a pointer event's client coordinates into game coordinates.
  _toGame(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  // Take the queued clicks and keys, clearing both queues.
  poll() {
    const out = { clicks: this.clicks, keys: this.keys };
    this.clicks = [];
    this.keys = [];
    return out;
  }

  // The path the player has drawn so far this press (live preview).
  currentPath() {
    return this.drawPath;
  }

  // True while the player is mid-draw with a path worth showing.
  isDrawing() {
    return this.down && this.drawPath.length > 1;
  }
}
