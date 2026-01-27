import { fetchShaderCode } from "../infrastructure/utils";
import { ResourceRegistry } from "./ResourceRegistry";

/**
 * PipelineDescriptor - 描述 Pipeline 的资源依赖关系
 */
export interface PipelineDescriptor {
  // Pipeline 提供的资源（注册到 Registry）
  provides: {
    buffers?: string[];
    bindGroups?: string[];
    bindGroupLayouts?: string[];
  };
  // Pipeline 需要的资源（从 Registry 获取）
  requires: {
    buffers?: string[];
    bindGroups?: string[];
    bindGroupLayouts?: string[];
  };
}

export interface BindGroupConfig {
  entries: GPUBindGroupLayoutEntry[];
}

export interface ComputePipelineConfig {
  shaderPath: string;
  entryPoint?: string;
  label: string;
  workgroupSize: number;
  bindGroupConfigs: BindGroupConfig[];
}

/**
 * BaseComputePipeline - 计算管线基类
 *
 * 核心理念：
 * - 每个 Pipeline 完全自包含
 * - 通过 ResourceRegistry 共享资源
 * - 自动验证依赖关系
 */
export abstract class BaseComputePipeline {
  protected device: GPUDevice;
  protected registry: ResourceRegistry;
  protected pipeline: GPUComputePipeline | null = null;
  protected bindGroupLayouts: GPUBindGroupLayout[] = [];
  protected bindGroups: GPUBindGroup[] = [];
  public instanceCount: number = 0;

  constructor(device: GPUDevice, registry: ResourceRegistry) {
    this.device = device;
    this.registry = registry;
  }

  // ========== 子类必须实现 ==========

  /**
   * 描述资源依赖关系
   */
  abstract getDescriptor(): PipelineDescriptor;

  /**
   * 配置管线
   */
  protected abstract getConfig(): ComputePipelineConfig;

  /**
   * 创建自己拥有的资源并注册到 Registry
   */
  protected abstract createOwnedResources(): Promise<void>;

  // ========== 初始化流程 ==========

  async initialize(): Promise<void> {
    const descriptor = this.getDescriptor();
    const pipelineName = this.constructor.name;

    // 1. 验证所有依赖的资源都已存在
    this.validateDependencies(descriptor, pipelineName);

    // 2. 创建自己的资源并注册
    await this.createOwnedResources();

    // 3. 创建管线
    await this.createPipeline();
  }

  /**
   * 验证依赖资源
   */
  private validateDependencies(
    descriptor: PipelineDescriptor,
    pipelineName: string,
  ): void {
    descriptor.requires.buffers?.forEach((name) => {
      if (!this.registry.hasBuffer(name)) {
        throw new Error(`${pipelineName} requires buffer: ${name}`);
      }
    });

    descriptor.requires.bindGroups?.forEach((name) => {
      if (!this.registry.hasBindGroup(name)) {
        throw new Error(`${pipelineName} requires bindGroup: ${name}`);
      }
    });

    descriptor.requires.bindGroupLayouts?.forEach((name) => {
      if (!this.registry.hasBindGroupLayout(name)) {
        throw new Error(`${pipelineName} requires bindGroupLayout: ${name}`);
      }
    });
  }

  /**
   * 创建计算管线
   */
  private async createPipeline(): Promise<void> {
    const config = this.getConfig();

    // 加载 shader
    const shaderCode = await fetchShaderCode(config.shaderPath);
    const shaderModule = this.device.createShaderModule({
      code: shaderCode,
    });

    // 创建 bind group layouts
    for (const bgConfig of config.bindGroupConfigs) {
      const layout = this.device.createBindGroupLayout({
        label: `${config.label} Bind Group Layout`,
        entries: bgConfig.entries,
      });
      this.bindGroupLayouts.push(layout);
    }

    // 创建 pipeline layout
    const pipelineLayout = this.device.createPipelineLayout({
      label: `${config.label} Pipeline Layout`,
      bindGroupLayouts: this.bindGroupLayouts,
    });

    // 创建计算管线
    this.pipeline = this.device.createComputePipeline({
      label: config.label,
      layout: pipelineLayout,
      compute: {
        module: shaderModule,
        entryPoint: config.entryPoint || "main",
      },
    });
  }

  // ========== 运行 ==========

  run(computePass: GPUComputePassEncoder): void {
    if (!this.pipeline || this.instanceCount === 0) return;

    const config = this.getConfig();
    computePass.setPipeline(this.pipeline);

    for (let i = 0; i < this.bindGroups.length; i++) {
      computePass.setBindGroup(i, this.bindGroups[i]);
    }

    computePass.dispatchWorkgroups(
      Math.ceil(this.instanceCount / config.workgroupSize),
    );
  }
}
