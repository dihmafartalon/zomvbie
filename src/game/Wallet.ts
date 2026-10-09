/** The player's points balance. */
export class Wallet {
  private balance: number;

  constructor(initial = 0) {
    this.balance = Math.max(0, Math.floor(initial));
  }

  get points(): number {
    return this.balance;
  }

  set(points: number): void {
    this.balance = Math.max(0, Math.floor(points));
  }

  add(amount: number): void {
    this.balance += Math.max(0, Math.floor(amount));
  }

  canAfford(cost: number): boolean {
    return this.balance >= cost;
  }

  /** Deducts `cost` if affordable. Returns whether the purchase went through. */
  spend(cost: number): boolean {
    if (!this.canAfford(cost)) return false;
    this.balance -= cost;
    return true;
  }
}
