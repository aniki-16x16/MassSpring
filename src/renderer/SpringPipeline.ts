import { BaseRenderPipeline, type PipelineConfig } from "./BaseRenderPipeline";

export class SpringRenderPipeline extends BaseRenderPipeline {
  constructor(device: GPUDevice, canvasFormat: GPUTextureFormat) {
    super(device, canvasFormat);
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
            buffer: this.registry.getBuffer("springBuffer"),
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this.registry.getBuffer("particleBuffer"),
          },
        },
      ],
    ];
  }
}
