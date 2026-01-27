import {
  BaseComputePipeline,
  type ComputePipelineConfig,
  type PipelineDescriptor,
} from "./BaseComputePipeline";

/**
 * SpringComputePipeline - 弹簧计算管线
 *
 * 职责：
 * - 管理弹簧 buffer（连接关系、刚度等）
 * - 管理力 buffer（计算的力结果）
 * - 根据粒子位置计算弹簧力
 *
 * 提供：springBuffer, forceBuffer
 * 需要：particleBuffer（注意：这是循环依赖，需要特殊处理）
 */
export class SpringComputePipeline extends BaseComputePipeline {
  public instanceCount: number = 31;
  private springBuffer: GPUBuffer | null = null;
  private forceBuffer: GPUBuffer | null = null;

  // ========== 描述资源依赖 ==========

  getDescriptor(): PipelineDescriptor {
    return {
      provides: {
        buffers: ["springBuffer", "forceBuffer"],
      },
      requires: {
        buffers: [], // 先不依赖 particleBuffer，在创建 bindGroup 时再获取
      },
    };
  }

  // ========== 配置管线 ==========

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
              buffer: { type: "storage" },
            },
            {
              binding: 1,
              visibility: GPUShaderStage.COMPUTE,
              buffer: { type: "read-only-storage" },
            },
            {
              binding: 2,
              visibility: GPUShaderStage.COMPUTE,
              buffer: { type: "storage" },
            },
          ],
        },
      ],
    };
  }

  // ========== 创建资源 ==========

  protected async createOwnedResources(): Promise<void> {
    // 创建弹簧 buffer
    this.springBuffer = this.device.createBuffer({
      label: "spring buffer",
      size: this.instanceCount * 8 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    // 初始化弹簧数据
    const springData = this.springBuffer.getMappedRange();
    for (let i = 0; i < this.instanceCount; i++) {
      const byteOffset = i * 8 * 4;
      const uintView = new Uint32Array(springData, byteOffset, 2);
      const floatView = new Float32Array(springData, byteOffset + 2 * 4, 6);

      // 粒子索引
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
    this.springBuffer.unmap();

    // 创建力 buffer
    this.forceBuffer = this.device.createBuffer({
      label: "force buffer",
      size: 32 * 2 * 4, // 注意：这里硬编码了粒子数量，后续可以改进
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // 注册到 Registry
    this.registry.registerBuffer("springBuffer", this.springBuffer);
    this.registry.registerBuffer("forceBuffer", this.forceBuffer);

    // 延迟创建 bind group（需要等 particleBuffer 创建完成）
  }

  /**
   * 在 particleBuffer 创建后调用此方法完成初始化
   */
  completeInitialization(): void {
    const bindGroup = this.device.createBindGroup({
      label: "[Compute][Spring] Bind Group",
      layout: this.bindGroupLayouts[0],
      entries: [
        {
          binding: 0,
          resource: { buffer: this.springBuffer! },
        },
        {
          binding: 1,
          resource: { buffer: this.registry.getBuffer("particleBuffer") },
        },
        {
          binding: 2,
          resource: { buffer: this.forceBuffer! },
        },
      ],
    });

    this.bindGroups = [bindGroup];
  }
}
