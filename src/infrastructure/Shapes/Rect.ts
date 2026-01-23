import { Shape, ShapeEnum } from "./Base";

export class Rect extends Shape {
  width: number;
  height: number;

  constructor(position: [number, number], width: number, height: number) {
    super();
    this.position = position;
    this.width = width;
    this.height = height;
  }

  writeToComputeBuffer(buffer: ArrayBuffer, offset: number): void {
    const floatView = new Float32Array(buffer, offset, 7);
    const uintView = new Uint32Array(buffer, offset + 7 * 4, 1);
    // params (vec4f) -> offset + 0,1,2,3
    floatView[0] = this.width;
    floatView[1] = this.height;

    floatView[4] = this.position[0];
    floatView[5] = this.position[1];
    floatView[6] = this.rotation;

    uintView[0] = ShapeEnum.RECT;
  }
}
