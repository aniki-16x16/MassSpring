import { BaseRenderPipeline, type PipelineConfig } from "./BaseRenderPipeline";

export class ShapeRenderPipeline extends BaseRenderPipeline {
  constructor(device: GPUDevice, canvasFormat: GPUTextureFormat) {
    super(device, canvasFormat);
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
            buffer: this.registry.getBuffer("obstacleBuffer"),
          },
        },
      ],
    ];
  }
}
