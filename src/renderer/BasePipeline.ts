import { fetchShaderCode } from "../infrastructure/utils";

export interface BindGroupConfig {
  entries: GPUBindGroupLayoutEntry[];
}

export interface PipelineConfig {
  shaderPath: string;
  label: string;
  bindGroupConfigs: BindGroupConfig[];
  vertexEntryPoint?: string;
  fragmentEntryPoint?: string;
  topology?: GPUPrimitiveTopology;
  blend?: GPUBlendState;
}

export abstract class BasePipeline {
  protected device: GPUDevice;
  protected canvasFormat: GPUTextureFormat;
  protected pipeline: GPURenderPipeline | null = null;
  protected bindGroupLayouts: GPUBindGroupLayout[] = [];
  protected bindGroups: GPUBindGroup[] = [];
  protected instanceCount: number = 0;

  constructor(device: GPUDevice, canvasFormat: GPUTextureFormat) {
    this.device = device;
    this.canvasFormat = canvasFormat;
  }

  // 子类需要提供配置信息
  protected abstract getConfig(): PipelineConfig;

  // 子类需要提供 bind group 的资源绑定
  protected abstract getBindGroupResources(): GPUBindGroupEntry[][];

  async initialize(
    globalBindGroupLayout: GPUBindGroupLayout,
    globalBindGroup: GPUBindGroup,
  ): Promise<void> {
    const config = this.getConfig();

    // 加载 shader
    const shaderCode = await fetchShaderCode(config.shaderPath);
    const shaderModule = this.device.createShaderModule({
      code: shaderCode,
    });

    // 创建所有 bind group layouts（包括全局的）
    this.bindGroupLayouts = [globalBindGroupLayout];
    for (const bgConfig of config.bindGroupConfigs) {
      const layout = this.device.createBindGroupLayout({
        label: `${config.label} Bind Group Layout`,
        entries: bgConfig.entries,
      });
      this.bindGroupLayouts.push(layout);
    }

    // 创建所有 bind groups（包括全局的）
    this.bindGroups = [globalBindGroup];
    const resources = this.getBindGroupResources();
    for (let i = 0; i < config.bindGroupConfigs.length; i++) {
      const bindGroup = this.device.createBindGroup({
        label: `${config.label} Bind Group ${i}`,
        layout: this.bindGroupLayouts[i + 1],
        entries: resources[i],
      });
      this.bindGroups.push(bindGroup);
    }

    // 创建 pipeline layout
    const pipelineLayout = this.device.createPipelineLayout({
      label: `${config.label} Pipeline Layout`,
      bindGroupLayouts: this.bindGroupLayouts,
    });

    // 创建 render pipeline
    this.pipeline = this.device.createRenderPipeline({
      label: `${config.label} Pipeline`,
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: config.vertexEntryPoint || "vs_main",
        buffers: [],
      },
      fragment: {
        module: shaderModule,
        entryPoint: config.fragmentEntryPoint || "fs_main",
        targets: [
          {
            format: this.canvasFormat,
            blend: config.blend || {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: {
        topology: config.topology || "triangle-list",
      },
    });
  }

  setInstanceCount(count: number): void {
    this.instanceCount = count;
  }

  render(renderPass: GPURenderPassEncoder): void {
    if (!this.pipeline || this.instanceCount === 0) return;

    renderPass.setPipeline(this.pipeline);
    for (let i = 0; i < this.bindGroups.length; i++) {
      renderPass.setBindGroup(i, this.bindGroups[i]);
    }
    renderPass.draw(6, this.instanceCount, 0, 0);
  }
}
