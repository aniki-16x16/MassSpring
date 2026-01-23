export const ShapeEnum = {
  CIRCLE: 0,
  RECT: 1,
} as const;

export abstract class Shape {
  position: [number, number] = [0, 0];
  rotation: number = 0;

  static BYTE_SIZE = 8 * 4;

  abstract writeToComputeBuffer(buffer: ArrayBuffer, offset: number): void;
}
