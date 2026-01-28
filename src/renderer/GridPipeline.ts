import { BaseRenderPipeline, type PipelineConfig } from "./BaseRenderPipeline";

export class GridRenderPipeline extends BaseRenderPipeline {
  constructor(device: GPUDevice, canvasFormat: GPUTextureFormat) {
    super(device, canvasFormat);
  }

  protected getConfig(): PipelineConfig {
    return {
      shaderPath: "src/shader/render_uniform_grid.wgsl",
      label: "[Renderer][Grid]",
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
            buffer: this.registry.getBuffer("gridBuffer"),
          },
        },
      ],
    ];
  }
}
