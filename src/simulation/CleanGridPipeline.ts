import type {
  ComputePipelineConfig,
  PipelineDescriptor,
} from "./BaseComputePipeline";
import { GridComputePipeline } from "./GridPipeline";

export class CleanGridPipeline extends GridComputePipeline {
  getDescriptor(): PipelineDescriptor {
    return {
      provides: {},
      requires: {
        buffers: ["gridBuffer", "particleNextBuffer"],
      },
    };
  }

  protected getConfig(): ComputePipelineConfig {
    return {
      shaderPath: "src/shader/clean_uniform_grid.wgsl",
      label: "[Compute][Clean Grid]",
      workgroupSize: 64,
      bindGroupConfigs: [
        {
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.COMPUTE,
              buffer: {
                type: "storage",
              },
            },
            {
              binding: 1,
              visibility: GPUShaderStage.COMPUTE,
              buffer: {
                type: "storage",
              },
            },
          ],
        },
      ],
    };
  }

  protected async createOwnedResources(): Promise<void> {}

  completeInitialization(): void {
    const bindGroup = this.device.createBindGroup({
      label: "[Compute][Clean Grid] bind group",
      layout: this.bindGroupLayouts[0],
      entries: [
        {
          binding: 0,
          resource: { buffer: this.registry.getBuffer("gridBuffer")! },
        },
        {
          binding: 1,
          resource: { buffer: this.registry.getBuffer("particleNextBuffer")! },
        },
      ],
    });
    this.bindGroups = [bindGroup];
  }
}
