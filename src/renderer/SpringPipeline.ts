import { BasePipeline, type PipelineConfig } from "./BasePipeline";

export class SpringPipeline extends BasePipeline {
  private springBuffer: GPUBuffer;
  private particleBuffer: GPUBuffer;

  constructor(
    device: GPUDevice,
    canvasFormat: GPUTextureFormat,
    springBuffer: GPUBuffer,
    particleBuffer: GPUBuffer,
  ) {
    super(device, canvasFormat);
    this.springBuffer = springBuffer;
    this.particleBuffer = particleBuffer;
  }

  protected getConfig(): PipelineConfig {
    return {
      shaderPath: "src/shader/render_spring.wgsl",
      label: "[Renderer][Spring]",
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
            {
              binding: 1,
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
            buffer: this.springBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this.particleBuffer,
          },
        },
      ],
    ];
  }
}
