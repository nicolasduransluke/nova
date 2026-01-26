export class NovaPoints {
  private readonly _value: number;

  private constructor(points: number) {
    this._value = points;
  }

  static create(points: number): NovaPoints {
    if (points < 0) {
      throw new Error('Nova points cannot be negative');
    }

    return new NovaPoints(Math.floor(points));
  }

  static zero(): NovaPoints {
    return new NovaPoints(0);
  }

  get value(): number {
    return this._value;
  }

  add(other: NovaPoints): NovaPoints {
    return new NovaPoints(this._value + other._value);
  }

  subtract(other: NovaPoints): NovaPoints {
    const result = this._value - other._value;
    if (result < 0) {
      throw new Error('Cannot subtract: would result in negative points');
    }
    return new NovaPoints(result);
  }

  multiply(factor: number): NovaPoints {
    if (factor < 0) {
      throw new Error('Multiplication factor cannot be negative');
    }
    return new NovaPoints(Math.floor(this._value * factor));
  }

  isGreaterThan(other: NovaPoints): boolean {
    return this._value > other._value;
  }

  isLessThan(other: NovaPoints): boolean {
    return this._value < other._value;
  }

  equals(other: NovaPoints): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return `${this._value} NP`;
  }
}
