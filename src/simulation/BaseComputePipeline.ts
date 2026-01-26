import { fetchShaderCode } from "../infrastructure/utils";

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

export abstract class BaseComputePipeline {
  protected device: GPUDevice;
  protected pipeline: GPUComputePipeline | null = null;
  protected bindGroupLayouts: GPUBindGroupLayout[] = [];
  protected bindGroups: GPUBindGroup[] = [];
  protected instanceCount: number = 0;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  // 子类需要提供配置信息
  protected abstract getConfig(): ComputePipelineConfig;

  // 子类需要提供 bind group 的资源绑定
  protected abstract getBindGroupResources(): GPUBindGroupEntry[][];

  protected abstract initBuffer(): void;

  async initialize(
    globalBindGroupLayout?: GPUBindGroupLayout,
    globalBindGroup?: GPUBindGroup,
  ): Promise<void> {
    const config = this.getConfig();

    // 加载 shader
    const shaderCode = await fetchShaderCode(config.shaderPath);
    const shaderModule = this.device.createShaderModule({
      code: shaderCode,
    });

    this.bindGroupLayouts = globalBindGroupLayout
      ? [globalBindGroupLayout]
      : [];
    for (const bgConfig of config.bindGroupConfigs) {
      const layout = this.device.createBindGroupLayout({
        label: `${config.label} Bind Group Layout`,
        entries: bgConfig.entries,
      });
      this.bindGroupLayouts.push(layout);
    }

    this.bindGroups = globalBindGroup ? [globalBindGroup] : [];
    const resources = this.getBindGroupResources();
    for (let i = 0; i < resources.length; i++) {
      const bindGroup = this.device.createBindGroup({
        label: `${config.label} Bind Group`,
        layout: this.bindGroupLayouts[i + (globalBindGroupLayout ? 1 : 0)],
        entries: resources[i],
      });
      this.bindGroups.push(bindGroup);
    }

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
