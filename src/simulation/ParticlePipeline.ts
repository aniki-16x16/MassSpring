import { MyRandom } from "../infrastructure/utils";
import {
  BaseComputePipeline,
  type ComputePipelineConfig,
  type PipelineDescriptor,
} from "./BaseComputePipeline";

/**
 * ParticleComputePipeline - 粒子计算管线
 *
 * 职责：
 * - 管理粒子 buffer（位置、速度、质量等）
 * - 根据力更新粒子状态
 * - 处理与障碍物的碰撞
 *
 * 提供：particleBuffer
 * 需要：forceBuffer, obstacleBuffer, globalBindGroup
 */
export class ParticleComputePipeline extends BaseComputePipeline {
  public instanceCount: number = 1024;
  private particleBuffer: GPUBuffer | null = null;

  // ========== 描述资源依赖 ==========

  getDescriptor(): PipelineDescriptor {
    return {
      provides: {
        buffers: ["particleBuffer"],
      },
      requires: {
        buffers: [], // 延迟依赖检查
        bindGroups: ["globalBindGroup"],
        bindGroupLayouts: ["globalBindGroupLayout"],
      },
    };
  }

  // ========== 配置管线 ==========

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
              buffer: { type: "uniform" },
            },
          ],
        },
        {
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.COMPUTE,
              buffer: { type: "storage" },
            },
            {
              binding: 1,
              visibility: GPUShaderStage.COMPUTE,
              buffer: { type: "storage" },
            },
            {
              binding: 2,
              visibility: GPUShaderStage.COMPUTE,
              buffer: { type: "read-only-storage" },
            },
            {
              binding: 3,
              visibility: GPUShaderStage.COMPUTE,
              buffer: { type: "read-only-storage" },
            },
            {
              binding: 4,
              visibility: GPUShaderStage.COMPUTE,
              buffer: { type: "read-only-storage" },
            },
          ],
        },
      ],
    };
  }

  // ========== 创建资源 ==========

  protected async createOwnedResources(): Promise<void> {
    // 创建粒子 buffer
    this.particleBuffer = this.device.createBuffer({
      label: "particle buffer",
      size: this.instanceCount * 8 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    // 初始化粒子数据
    const particleData = this.particleBuffer.getMappedRange();
    const ropeParticleCount = 32;
    for (let i = 0; i < ropeParticleCount; i++) {
      const byteOffset = i * 8 * 4;
      const floatView = new Float32Array(particleData, byteOffset, 7);
      const uintView = new Uint32Array(particleData, byteOffset + 7 * 4, 1);

      // pos (vec4f) -> offset + 0, 1, 2, 3
      floatView[0] = -1 + (2 / (ropeParticleCount - 1)) * i;
      floatView[1] = 0.8;
      floatView[2] = 0;
      floatView[3] = 1;
      // velocity (vec2f) -> offset + 4, 5
      floatView[4] = 0;
      floatView[5] = 0;
      // mass (f32) -> offset + 6
      floatView[6] = 1 + (1 / (ropeParticleCount - 1)) * i;
      // is_static (u32) -> offset + 7
      uintView[0] = [ropeParticleCount - 1].includes(i) ? 1 : 0;
    }
    for (let i = ropeParticleCount; i < this.instanceCount; i++) {
      const byteOffset = i * 8 * 4;
      const floatView = new Float32Array(particleData, byteOffset, 7);
      const uintView = new Uint32Array(particleData, byteOffset + 7 * 4, 1);

      const randomGen = MyRandom.randomGenerator(-1, 1);
      floatView[0] = randomGen(); // x
      floatView[1] = randomGen();
      floatView[2] = 0; // z
      floatView[3] = 1; // w

      floatView[4] = randomGen() * 2; // vx
      floatView[5] = randomGen() * 2; // vy

      floatView[6] = MyRandom.random(0.5, 2.0); // mass

      uintView[0] = 0; // is_static
    }
    this.particleBuffer.unmap();

    // 注册到 Registry
    this.registry.registerBuffer("particleBuffer", this.particleBuffer);

    // 延迟创建 bind group（需要等 forceBuffer 创建完成）
  }

  /**
   * 在所有依赖资源准备好后，创建 bind group
   */
  completeInitialization(): void {
    const bindGroup = this.device.createBindGroup({
      label: "[Compute][Particle] Bind Group",
      layout: this.bindGroupLayouts[1],
      entries: [
        {
          binding: 0,
          resource: { buffer: this.particleBuffer! },
        },
        {
          binding: 1,
          resource: { buffer: this.registry.getBuffer("forceBuffer") },
        },
        {
          binding: 2,
          resource: { buffer: this.registry.getBuffer("obstacleBuffer") },
        },
        {
          binding: 3,
          resource: { buffer: this.registry.getBuffer("gridBuffer") },
        },
        {
          binding: 4,
          resource: { buffer: this.registry.getBuffer("particleNextBuffer") },
        },
      ],
    });

    // 设置 bind groups（global + own）
    this.bindGroups = [
      this.registry.getBindGroup("globalBindGroup"),
      bindGroup,
    ];
  }
}
