import { BasePipeline, type PipelineConfig } from "./BasePipeline";

export class ShapePipeline extends BasePipeline {
  private shapeBuffer: GPUBuffer;

  constructor(
    device: GPUDevice,
    canvasFormat: GPUTextureFormat,
    shapeBuffer: GPUBuffer,
  ) {
    super(device, canvasFormat);
    this.shapeBuffer = shapeBuffer;
  }

  protected getConfig(): PipelineConfig {
    return {
      shaderPath: "src/shader/render_shape.wgsl",
      label: "[Renderer][Shape]",
      bindGroupConfigs: [
        {
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.VERTEX,
              buffer: {
                type: "read-only-storage",
              },
            },
          ],
        },
      ],
    };
  }

  protected getBindGroupResources(): GPUBindGroupEntry[][] {
    return [
      [
        {
          binding: 0,
          resource: {
            buffer: this.shapeBuffer,
          },
        },
      ],
    ];
  }
}
