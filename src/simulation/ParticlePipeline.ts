import {
  BaseComputePipeline,
  type ComputePipelineConfig,
} from "./BaseComputePipeline";

interface ExtraBuffers {
  forceBuffer: GPUBuffer;
  obstacleBuffer: GPUBuffer;
}

export class ParticleComputePipeline extends BaseComputePipeline {
  instanceCount: number = 32;
  private buffer: GPUBuffer | null = null;
  private extraBuffers: ExtraBuffers | null = null;

  protected getConfig(): ComputePipelineConfig {
    return {
      shaderPath: "src/shader/compute_particle.wgsl",
      label: "[Compute][Particle]",
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
            {
              binding: 2,
              visibility: GPUShaderStage.COMPUTE,
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
            buffer: this.buffer!,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this.extraBuffers!.forceBuffer,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: this.extraBuffers!.obstacleBuffer,
          },
        },
      ],
    ];
  }

  initBuffer() {
    const particleBuffer = this.device!.createBuffer({
      label: "particle buffer",
      size: this.instanceCount * 8 * 4,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    const particleData = particleBuffer.getMappedRange();

    for (let i = 0; i < this.instanceCount; i++) {
      const byteOffset = i * 8 * 4;
      const floatView = new Float32Array(particleData, byteOffset, 7);
      const uintView = new Uint32Array(particleData, byteOffset + 7 * 4, 1);
      // pos (vec4f) -> offset + 0, 1, 2, 3
      floatView[0] = -1 + (2 / (this.instanceCount - 1)) * i;
      floatView[1] = 0.8;
      floatView[2] = 0;
      floatView[3] = 1;
      // velocity (vec2f) -> offset + 4, 5
      floatView[4] = 0;
      floatView[5] = 0;
      // mass (f32) -> offset + 6
      floatView[6] = 1 + (1 / (this.instanceCount - 1)) * i;
      // is_static (u32) -> offset + 7
      uintView[0] = [this.instanceCount - 1].includes(i) ? 1 : 0;
    }

    particleBuffer.unmap();
    this.buffer = particleBuffer;
  }

  getBufferResource(): GPUBuffer {
    return this.buffer!;
  }

  setExtraBuffers(buffers: ExtraBuffers) {
    this.extraBuffers = buffers;
  }
}
