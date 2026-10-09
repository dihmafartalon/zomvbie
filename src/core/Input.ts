/** Actions that touch controls (or keys) can trigger. */
export type InputAction = 'fire' | 'aim' | 'sprint' | 'jump' | 'reload' | 'interact' | 'swap' | 'pause';

/** A snapshot of player intent for one frame, independent of input device. */
export interface FrameInput {
  /** Strafe, -1 (left) .. 1 (right). */
  moveX: number;
  /** Forward/back, -1 (back) .. 1 (forward). */
  moveY: number;
  /** Yaw change this frame in radians (positive = turn right). */
  lookX: number;
  /** Pitch change this frame in radians (positive = look down). */
  lookY: number;
  fireHeld: boolean;
  firePressed: boolean;
  aimHeld: boolean;
  sprintHeld: boolean;
  jumpPressed: boolean;
  reloadPressed: boolean;
  interactPressed: boolean;
  swapPressed: boolean;
  /** Weapon slot selected directly this frame, or -1. */
  slotPressed: number;
  pausePressed: boolean;
}

const MOUSE_SCALE = 0.0022;
const TOUCH_SCALE = 0.0065;

/**
 * Merges keyboard/mouse (pointer lock) and virtual touch input into one
 * per-frame FrameInput. Edge-triggered actions are latched until consume().
 */
export class Input {
  mouseSensitivity = 1;
  touchSensitivity = 1;
  invertY = false;

  private readonly keys = new Set<string>();
  private mouseFire = false;
  private mouseAim = false;
  private readonly pressed = new Set<InputAction>();
  private readonly virtualHeld = new Set<InputAction>();
  private lookX = 0;
  private lookY = 0;
  private touchMoveX = 0;
  private touchMoveY = 0;
  private slot = -1;

  constructor(private readonly lockTarget: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('blur', () => this.releaseAll());
    lockTarget.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  get pointerLocked(): boolean {
    return document.pointerLockElement === this.lockTarget;
  }

  // ---- Virtual (touch) API -------------------------------------------------

  /** Joystick vector: x right, y forward, each -1..1. */
  setTouchMove(x: number, y: number): void {
    this.touchMoveX = x;
    this.touchMoveY = y;
  }

  /** Look drag in screen pixels. */
  addTouchLook(dxPixels: number, dyPixels: number): void {
    this.lookX += dxPixels * TOUCH_SCALE * this.touchSensitivity;
    this.lookY += dyPixels * TOUCH_SCALE * this.touchSensitivity;
  }

  press(action: InputAction): void {
    this.pressed.add(action);
  }

  setHeld(action: InputAction, held: boolean): void {
    if (held) this.virtualHeld.add(action);
    else this.virtualHeld.delete(action);
  }

  isHeld(action: InputAction): boolean {
    return this.virtualHeld.has(action);
  }

  // ---- Frame snapshot -------------------------------------------------------

  consume(): FrameInput {
    const k = this.keys;
    const axis = (pos: boolean, neg: boolean): number => (pos ? 1 : 0) - (neg ? 1 : 0);
    const moveX = clampUnit(
      axis(k.has('KeyD') || k.has('ArrowRight'), k.has('KeyA') || k.has('ArrowLeft')) + this.touchMoveX,
    );
    const moveY = clampUnit(
      axis(k.has('KeyW') || k.has('ArrowUp'), k.has('KeyS') || k.has('ArrowDown')) + this.touchMoveY,
    );

    const frame: FrameInput = {
      moveX,
      moveY,
      lookX: this.lookX,
      lookY: this.invertY ? -this.lookY : this.lookY,
      fireHeld: this.mouseFire || this.virtualHeld.has('fire'),
      firePressed: this.pressed.has('fire'),
      aimHeld: this.mouseAim || this.virtualHeld.has('aim'),
      sprintHeld: k.has('ShiftLeft') || k.has('ShiftRight') || this.virtualHeld.has('sprint'),
      jumpPressed: this.pressed.has('jump'),
      reloadPressed: this.pressed.has('reload'),
      interactPressed: this.pressed.has('interact'),
      swapPressed: this.pressed.has('swap'),
      slotPressed: this.slot,
      pausePressed: this.pressed.has('pause'),
    };

    this.lookX = 0;
    this.lookY = 0;
    this.slot = -1;
    this.pressed.clear();
    return frame;
  }

  /** Drops all held state (focus loss, pause). */
  releaseAll(): void {
    this.keys.clear();
    this.mouseFire = false;
    this.mouseAim = false;
    this.virtualHeld.clear();
    this.pressed.clear();
    this.touchMoveX = 0;
    this.touchMoveY = 0;
    this.lookX = 0;
    this.lookY = 0;
  }

  // ---- DOM handlers ---------------------------------------------------------

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    if (e.code === 'Space') e.preventDefault();
    if (e.repeat) return;
    switch (e.code) {
      case 'Space':
        this.pressed.add('jump');
        break;
      case 'KeyR':
        this.pressed.add('reload');
        break;
      case 'KeyF':
      case 'KeyE':
        this.pressed.add('interact');
        break;
      case 'KeyQ':
        this.pressed.add('swap');
        break;
      case 'Digit1':
        this.slot = 0;
        break;
      case 'Digit2':
        this.slot = 1;
        break;
      case 'KeyP':
      case 'Escape':
        this.pressed.add('pause');
        break;
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    if (!this.pointerLocked) return;
    this.lookX += e.movementX * MOUSE_SCALE * this.mouseSensitivity;
    this.lookY += e.movementY * MOUSE_SCALE * this.mouseSensitivity;
  };

  private readonly onMouseDown = (e: MouseEvent): void => {
    if (!this.pointerLocked) return;
    if (e.button === 0) {
      this.mouseFire = true;
      this.pressed.add('fire');
    } else if (e.button === 2) {
      this.mouseAim = true;
    }
  };

  private readonly onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseFire = false;
    else if (e.button === 2) this.mouseAim = false;
  };

  private readonly onWheel = (e: WheelEvent): void => {
    if (this.pointerLocked && Math.abs(e.deltaY) > 0) this.pressed.add('swap');
  };
}

function clampUnit(v: number): number {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}
