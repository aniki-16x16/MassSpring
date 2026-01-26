import {
  BaseComputePipeline,
  type ComputePipelineConfig,
} from "./BaseComputePipeline";

interface ExtraBuffers {
  particleBuffer: GPUBuffer;
}

export class SpringComputePipeline extends BaseComputePipeline {
  instanceCount: number = 31;
  private springBuffer: GPUBuffer | null = null;
  private forceBuffer: GPUBuffer | null = null;
  private extraBuffers: ExtraBuffers | null = null;

  protected getConfig(): ComputePipelineConfig {
    return {
      shaderPath: "src/shader/compute_spring.wgsl",
      label: "[Compute][Spring]",
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
                type: "read-only-storage",
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

  protected getBindGroupResources(): GPUBindGroupEntry[][] {
    return [
      [
        {
          binding: 0,
          resource: {
            buffer: this.springBuffer!,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this.extraBuffers!.particleBuffer,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: this.forceBuffer!,
          },
        },
      ],
    ];
  }

  initBuffer() {
    const springBuffer = this.device!.createBuffer({
      label: "spring buffer",
      size: this.instanceCount * 8 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    const springData = springBuffer.getMappedRange();
    for (let i = 0; i < this.instanceCount; i++) {
      const byteOffset = i * 8 * 4;
      const uintView = new Uint32Array(springData, byteOffset, 2);
      const floatView = new Float32Array(springData, byteOffset + 2 * 4, 6);
      uintView[0] = i;
      uintView[1] = i + 1;
      // rest_length
      floatView[0] = 0.05;
      // stiffness
      floatView[1] = 500 + (1000 / (this.instanceCount - 1)) * i;
      // is_broken
      floatView[2] = 0.0;
      // breaking_threshold
      floatView[3] = 0.2;
    }
    springBuffer.unmap();

    const forceBuffer = this.device!.createBuffer({
      label: "force buffer",
      size: this.instanceCount * 2 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.springBuffer = springBuffer;
    this.forceBuffer = forceBuffer;
  }

  getBufferResources() {
    return { springBuffer: this.springBuffer!, forceBuffer: this.forceBuffer! };
  }

  setExtraBuffers(buffers: ExtraBuffers) {
    this.extraBuffers = buffers;
  }
}
