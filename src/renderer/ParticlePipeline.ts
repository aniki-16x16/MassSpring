import { BasePipeline, type PipelineConfig } from "./BasePipeline";

export class ParticlePipeline extends BasePipeline {
  private particleBuffer: GPUBuffer;

  constructor(
    device: GPUDevice,
    canvasFormat: GPUTextureFormat,
    particleBuffer: GPUBuffer,
  ) {
    super(device, canvasFormat);
    this.particleBuffer = particleBuffer;
  }

  protected getConfig(): PipelineConfig {
    return {
      shaderPath: "src/shader/render_particle.wgsl",
      label: "[Renderer][Particle]",
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
            buffer: this.particleBuffer,
          },
        },
      ],
    ];
  }
}
