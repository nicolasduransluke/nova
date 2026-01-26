import { NovaPoints } from './nova-points.value-object';

describe('NovaPoints Value Object', () => {
  describe('create', () => {
    it('should create valid nova points', () => {
      const points = NovaPoints.create(100);
      expect(points.value).toBe(100);
    });

    it('should floor decimal values', () => {
      const points = NovaPoints.create(99.9);
      expect(points.value).toBe(99);
    });

    it('should throw error for negative points', () => {
      expect(() => NovaPoints.create(-10)).toThrow(
        'Nova points cannot be negative',
      );
    });
  });

  describe('zero', () => {
    it('should create zero points', () => {
      const points = NovaPoints.zero();
      expect(points.value).toBe(0);
    });
  });

  describe('add', () => {
    it('should add two nova points', () => {
      const points1 = NovaPoints.create(50);
      const points2 = NovaPoints.create(30);
      const result = points1.add(points2);
      expect(result.value).toBe(80);
    });
  });

  describe('subtract', () => {
    it('should subtract nova points', () => {
      const points1 = NovaPoints.create(100);
      const points2 = NovaPoints.create(30);
      const result = points1.subtract(points2);
      expect(result.value).toBe(70);
    });

    it('should throw error when result would be negative', () => {
      const points1 = NovaPoints.create(30);
      const points2 = NovaPoints.create(50);
      expect(() => points1.subtract(points2)).toThrow(
        'Cannot subtract: would result in negative points',
      );
    });
  });

  describe('multiply', () => {
    it('should multiply nova points', () => {
      const points = NovaPoints.create(50);
      const result = points.multiply(2);
      expect(result.value).toBe(100);
    });

    it('should floor the result', () => {
      const points = NovaPoints.create(33);
      const result = points.multiply(1.5);
      expect(result.value).toBe(49);
    });

    it('should throw error for negative multiplier', () => {
      const points = NovaPoints.create(50);
      expect(() => points.multiply(-1)).toThrow(
        'Multiplication factor cannot be negative',
      );
    });
  });

  describe('comparisons', () => {
    it('should compare points correctly', () => {
      const points1 = NovaPoints.create(50);
      const points2 = NovaPoints.create(30);
      const points3 = NovaPoints.create(50);

      expect(points1.isGreaterThan(points2)).toBe(true);
      expect(points2.isLessThan(points1)).toBe(true);
      expect(points1.equals(points3)).toBe(true);
    });
  });

  describe('toString', () => {
    it('should return formatted string', () => {
      const points = NovaPoints.create(100);
      expect(points.toString()).toBe('100 NP');
    });
  });
});
