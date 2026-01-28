import {
  BaseComputePipeline,
  type ComputePipelineConfig,
  type PipelineDescriptor,
} from "./BaseComputePipeline";

export class GridComputePipeline extends BaseComputePipeline {
  private gridBuffer: GPUBuffer | null = null;
  private particleNextBuffer: GPUBuffer | null = null;
  public gridCellCount: number = 0;

  getDescriptor(): PipelineDescriptor {
    return {
      provides: {
        buffers: ["gridBuffer", "particleNextBuffer"],
      },
      requires: {
        buffers: ["particleBuffer"],
      },
    };
  }

  protected getConfig(): ComputePipelineConfig {
    return {
      shaderPath: "src/shader/compute_uniform_grid.wgsl",
      label: "[Compute][Grid]",
      workgroupSize: 64,
      bindGroupConfigs: [
        {
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.COMPUTE,
              buffer: {
                type: "read-only-storage",
              },
            },
            {
              binding: 1,
              visibility: GPUShaderStage.COMPUTE,
              buffer: {
                type: "storage",
              },
            },
            {
              binding: 2,
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

  protected async createOwnedResources(): Promise<void> {
    // TODO 此处的常量需要手动与shader同步，考虑改为动态传参
    const cellSize = 0.01 * 4;
    const xBoundary = 2.0;
    const yBoundary = 1.0;
    const columnNum = Math.floor((xBoundary * 2) / cellSize) + 1;
    const rowNum = Math.floor((yBoundary * 2) / cellSize) + 1;
    this.gridCellCount = columnNum * rowNum;

    this.gridBuffer = this.device.createBuffer({
      label: "grid buffer",
      size: this.gridCellCount * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Int32Array(this.gridBuffer.getMappedRange()).fill(-1);
    this.gridBuffer.unmap();
    this.registry.registerBuffer("gridBuffer", this.gridBuffer);

    this.particleNextBuffer = this.device.createBuffer({
      label: "particle next buffer",
      size: this.instanceCount * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Int32Array(this.particleNextBuffer.getMappedRange()).fill(-1);
    this.particleNextBuffer.unmap();
    this.registry.registerBuffer("particleNextBuffer", this.particleNextBuffer);
  }

  completeInitialization(): void {
    const bindGroup = this.device.createBindGroup({
      label: "[Compute][Grid] bind group",
      layout: this.bindGroupLayouts[0],
      entries: [
        {
          binding: 0,
          resource: { buffer: this.registry.getBuffer("particleBuffer") },
        },
        {
          binding: 1,
          resource: { buffer: this.gridBuffer! },
        },
        {
          binding: 2,
          resource: { buffer: this.particleNextBuffer! },
        },
      ],
    });
    this.bindGroups = [bindGroup];
  }
}
