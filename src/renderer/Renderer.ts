import { ParticlePipeline } from "./ParticlePipeline";
import { SpringPipeline } from "./SpringPipeline";
import { ShapePipeline } from "./ShapePipeline";

export class Renderer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private canvasFormat: GPUTextureFormat | null = null;

  private uniformBuffer: GPUBuffer | null = null;
  private globalBindGroupLayout: GPUBindGroupLayout | null = null;
  private globalBindGroup: GPUBindGroup | null = null;

  private particlePipeline: ParticlePipeline | null = null;
  private springPipeline: SpringPipeline | null = null;
  private shapePipeline: ShapePipeline | null = null;

  constructor(
    device: GPUDevice,
    context: GPUCanvasContext,
    canvasFormat: GPUTextureFormat,
  ) {
    this.device = device;
    this.context = context;
    this.canvasFormat = canvasFormat;
  }

  private initializeGlobalBindGroup() {
    this.uniformBuffer = this.device!.createBuffer({
      label: "aspect ratio uniform buffer",
      size: 1 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.uniformBuffer.getMappedRange()).set([1.0]);
    this.uniformBuffer.unmap();

    this.globalBindGroupLayout = this.device!.createBindGroupLayout({
      label: "renderer global bind group layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: "uniform",
          },
        },
      ],
    });
    this.globalBindGroup = this.device!.createBindGroup({
      label: "renderer global bind group",
      layout: this.globalBindGroupLayout!,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.uniformBuffer!,
          },
        },
      ],
    });
  }

  async initialize(
    particleBuffer: GPUBuffer,
    particleCount: number,
    springBuffer: GPUBuffer,
    springCount: number,
    shapeBuffer: GPUBuffer,
    shapeCount: number,
  ): Promise<void> {
    this.initializeGlobalBindGroup();

    // 创建管线实例
    this.particlePipeline = new ParticlePipeline(
      this.device!,
      this.canvasFormat!,
      particleBuffer,
    );
    this.springPipeline = new SpringPipeline(
      this.device!,
      this.canvasFormat!,
      springBuffer,
      particleBuffer,
    );
    this.shapePipeline = new ShapePipeline(
      this.device!,
      this.canvasFormat!,
      shapeBuffer,
    );

    // 并行初始化所有管线
    await Promise.all([
      this.particlePipeline.initialize(
        this.globalBindGroupLayout!,
        this.globalBindGroup!,
      ),
      this.springPipeline.initialize(
        this.globalBindGroupLayout!,
        this.globalBindGroup!,
      ),
      this.shapePipeline.initialize(
        this.globalBindGroupLayout!,
        this.globalBindGroup!,
      ),
    ]);

    // 设置实例数量
    this.particlePipeline.setInstanceCount(particleCount);
    this.springPipeline.setInstanceCount(springCount);
    this.shapePipeline.setInstanceCount(shapeCount);
  }

  updateAspectRatio(aspectRatio: number) {
    this.device!.queue.writeBuffer(
      this.uniformBuffer!,
      0,
      new Float32Array([aspectRatio]).buffer,
    );
  }

  render() {
    const canvasTexture = this.context!.getCurrentTexture();
    const renderView = canvasTexture.createView();
    const commandEncoder = this.device!.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: renderView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    // 按顺序渲染：弹簧 -> 粒子 -> 形状
    this.springPipeline?.render(renderPass);
    this.particlePipeline?.render(renderPass);
    this.shapePipeline?.render(renderPass);

    renderPass.end();
    this.device!.queue.submit([commandEncoder.finish()]);
  }
}
