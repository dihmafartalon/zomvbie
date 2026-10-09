import type { Input, InputAction } from '../core/Input';
import { byId } from './dom';

const JOYSTICK_RADIUS = 55;
/** Actions that stay active while the button is held (others fire once per tap). */
const HELD_ACTIONS: ReadonlySet<InputAction> = new Set(['fire']);
/** Actions that toggle on tap. */
const TOGGLE_ACTIONS: ReadonlySet<InputAction> = new Set(['aim']);

/**
 * On-screen controls for touch devices: a floating move stick on the left,
 * drag-to-look on the right, and action buttons. Fire also supports dragging
 * to aim while shooting. Everything is routed into the shared Input.
 */
export class TouchControls {
  private readonly root = byId('touch-ui');
  private readonly moveZone = byId('touch-move-zone');
  private readonly lookZone = byId('touch-look-zone');
  private readonly stickBase = byId('joystick-base');
  private readonly stickKnob = byId('joystick-knob');

  private moveId: number | null = null;
  private readonly moveOrigin = { x: 0, y: 0 };
  /** Pointers currently steering the camera, with their last position. */
  private readonly lookPointers = new Map<number, { x: number; y: number }>();
  /** Pointers holding a button, with the action they hold. */
  private readonly buttonPointers = new Map<number, InputAction>();

  constructor(private readonly input: Input) {
    this.moveZone.addEventListener('pointerdown', this.onMoveStart);
    this.lookZone.addEventListener('pointerdown', this.onLookStart);
    for (const btn of this.root.querySelectorAll<HTMLElement>('[data-action]')) {
      btn.addEventListener('pointerdown', (e) => this.onButtonDown(e, btn));
    }
    this.root.addEventListener('pointermove', this.onPointerMove);
    this.root.addEventListener('pointerup', this.onPointerEnd);
    this.root.addEventListener('pointercancel', this.onPointerEnd);
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
    if (!visible) this.reset();
  }

  reset(): void {
    this.moveId = null;
    this.lookPointers.clear();
    this.buttonPointers.clear();
    this.input.setTouchMove(0, 0);
    this.input.setHeld('fire', false);
    this.input.setHeld('aim', false);
    this.input.setHeld('sprint', false);
    this.stickBase.classList.remove('active');
    for (const btn of this.root.querySelectorAll('.touch-btn')) btn.classList.remove('pressed', 'toggled');
  }

  private readonly onMoveStart = (e: PointerEvent): void => {
    if (this.moveId !== null) return;
    e.preventDefault();
    this.moveZone.setPointerCapture(e.pointerId);
    this.moveId = e.pointerId;
    this.moveOrigin.x = e.clientX;
    this.moveOrigin.y = e.clientY;
    this.stickBase.style.left = `${e.clientX}px`;
    this.stickBase.style.top = `${e.clientY}px`;
    this.stickBase.classList.add('active');
    this.updateStick(e.clientX, e.clientY);
  };

  private readonly onLookStart = (e: PointerEvent): void => {
    e.preventDefault();
    this.lookZone.setPointerCapture(e.pointerId);
    this.lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  private onButtonDown(e: PointerEvent, btn: HTMLElement): void {
    e.preventDefault();
    e.stopPropagation();
    btn.setPointerCapture(e.pointerId);
    const action = btn.dataset.action as InputAction;
    if (TOGGLE_ACTIONS.has(action)) {
      const on = !this.input.isHeld(action);
      this.input.setHeld(action, on);
      btn.classList.toggle('toggled', on);
      return;
    }
    btn.classList.add('pressed');
    this.input.press(action);
    if (HELD_ACTIONS.has(action)) this.input.setHeld(action, true);
    this.buttonPointers.set(e.pointerId, action);
    if (btn.hasAttribute('data-look')) this.lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId === this.moveId) {
      this.updateStick(e.clientX, e.clientY);
      return;
    }
    const last = this.lookPointers.get(e.pointerId);
    if (last) {
      this.input.addTouchLook(e.clientX - last.x, e.clientY - last.y);
      last.x = e.clientX;
      last.y = e.clientY;
    }
  };

  private readonly onPointerEnd = (e: PointerEvent): void => {
    if (e.pointerId === this.moveId) {
      this.moveId = null;
      this.input.setTouchMove(0, 0);
      this.input.setHeld('sprint', false);
      this.stickBase.classList.remove('active');
    }
    this.lookPointers.delete(e.pointerId);
    const action = this.buttonPointers.get(e.pointerId);
    if (action) {
      this.buttonPointers.delete(e.pointerId);
      if (HELD_ACTIONS.has(action)) this.input.setHeld(action, false);
      for (const btn of this.root.querySelectorAll(`[data-action="${action}"]`)) btn.classList.remove('pressed');
    }
  };

  private updateStick(x: number, y: number): void {
    let dx = x - this.moveOrigin.x;
    let dy = y - this.moveOrigin.y;
    const len = Math.hypot(dx, dy);
    if (len > JOYSTICK_RADIUS) {
      dx = (dx / len) * JOYSTICK_RADIUS;
      dy = (dy / len) * JOYSTICK_RADIUS;
    }
    this.stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / JOYSTICK_RADIUS;
    const ny = -dy / JOYSTICK_RADIUS;
    this.input.setTouchMove(nx, ny);
    // Pushing the stick all the way forward sprints.
    this.input.setHeld('sprint', ny > 0.9);
  }
}
