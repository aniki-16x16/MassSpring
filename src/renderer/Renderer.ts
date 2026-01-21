import { fetchShaderCode } from "../infrastructure/utils";

type PipelineKey = "particle" | "spring";

export class Renderer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private canvasFormat: GPUTextureFormat | null = null;

  private particleBuffer: GPUBuffer | null = null;
  private particleCount: number = 0;
  private springBuffer: GPUBuffer | null = null;
  private springCount: number = 0;
  private uniformBuffer: GPUBuffer | null = null;

  private bindGroups: Record<PipelineKey, GPUBindGroup[]> = {
    particle: [],
    spring: [],
  };
  private pipelines: Record<PipelineKey, GPURenderPipeline | null> = {
    particle: null,
    spring: null,
  };
  private pipelineLayouts: Record<PipelineKey, GPUPipelineLayout | null> = {
    particle: null,
    spring: null,
  };

  constructor(
    device: GPUDevice,
    context: GPUCanvasContext,
    canvasFormat: GPUTextureFormat,
  ) {
    this.device = device;
    this.context = context;
    this.canvasFormat = canvasFormat;
  }

  private initializeUniformBuffer() {
    this.uniformBuffer = this.device!.createBuffer({
      size: 1 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.uniformBuffer.getMappedRange()).set([1.0]);
    this.uniformBuffer.unmap();
  }

  private initializeBindGroups() {
    const layout0 = this.device!.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: "uniform",
          },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: "read-only-storage",
          },
        },
      ],
    });
    const group0 = this.device!.createBindGroup({
      layout: layout0,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.uniformBuffer!,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this.springBuffer!,
          },
        },
      ],
    });

    const layout1 = this.device!.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: "read-only-storage",
          },
        },
      ],
    });
    const group1 = this.device!.createBindGroup({
      layout: layout1,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.particleBuffer!,
          },
        },
      ],
    });

    this.bindGroups.particle = [group0, group1];
    this.bindGroups.spring = [group0, group1];

    this.pipelineLayouts.particle = this.device!.createPipelineLayout({
      bindGroupLayouts: [layout0, layout1],
    });
    this.pipelineLayouts.spring = this.device!.createPipelineLayout({
      bindGroupLayouts: [layout0, layout1],
    });
  }

  private async initializeParticlePipeline() {
    const shaderCode = await fetchShaderCode("src/renderer/particle.wgsl");
    const shaderModule = this.device!.createShaderModule({
      code: shaderCode,
    });

    this.pipelines.particle = this.device!.createRenderPipeline({
      layout: this.pipelineLayouts.particle!,
      vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [],
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main",
        targets: [
          {
            format: this.canvasFormat!,
            blend: {
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
        topology: "triangle-list",
      },
    });
  }

  private async initializeSpringPipeline() {
    const shaderCode = await fetchShaderCode("src/renderer/spring.wgsl");
    const shaderModule = this.device!.createShaderModule({
      code: shaderCode,
    });

    this.pipelines.spring = this.device!.createRenderPipeline({
      layout: this.pipelineLayouts.spring!,
      vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [],
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main",
        targets: [
          {
            format: this.canvasFormat!,
            blend: {
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
        topology: "triangle-list",
      },
    });
  }

  async initialize(
    particleBuffer: GPUBuffer,
    particleCount: number,
    springBuffer: GPUBuffer,
    springCount: number,
  ): Promise<void> {
    this.particleBuffer = particleBuffer;
    this.particleCount = particleCount;
    this.springBuffer = springBuffer;
    this.springCount = springCount;
    this.initializeUniformBuffer();
    this.initializeBindGroups();
    await this.initializeParticlePipeline();
    await this.initializeSpringPipeline();
  }

  updateAspectRatio(aspectRatio: number) {
    this.device!.queue.writeBuffer(
      this.uniformBuffer!,
      0,
      new Float32Array([1.0 / aspectRatio]).buffer,
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

    renderPass.setPipeline(this.pipelines.spring!);
    renderPass.setBindGroup(0, this.bindGroups.spring[0]);
    renderPass.setBindGroup(1, this.bindGroups.spring[1]);
    renderPass.draw(6, this.springCount, 0, 0);

    renderPass.setPipeline(this.pipelines.particle!);
    renderPass.setBindGroup(0, this.bindGroups.particle[0]);
    renderPass.setBindGroup(1, this.bindGroups.particle[1]);
    renderPass.draw(6, this.particleCount, 0, 0);

    renderPass.end();
    this.device!.queue.submit([commandEncoder.finish()]);
  }
}
