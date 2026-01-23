import { fetchShaderCode } from "../infrastructure/utils";

type PipelineKey = "particle" | "spring" | "shape";

export class Renderer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private canvasFormat: GPUTextureFormat | null = null;

  private particleCount: number = 0;
  private springCount: number = 0;
  private shapeCount: number = 0;

  private uniformBuffer: GPUBuffer | null = null;
  private globalBindGroupLayout: GPUBindGroupLayout | null = null;
  private globalBindGroup: GPUBindGroup | null = null;

  private bindGroups: Record<PipelineKey, GPUBindGroup[]> = {
    particle: [],
    spring: [],
    shape: [],
  };
  private pipelines: Record<PipelineKey, GPURenderPipeline | null> = {
    particle: null,
    spring: null,
    shape: null,
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

  private async initializeParticlePipeline(particleBuffer: GPUBuffer) {
    const shaderCode = await fetchShaderCode("src/renderer/particle.wgsl");
    const shaderModule = this.device!.createShaderModule({
      code: shaderCode,
    });

    const layout1 = this.device!.createBindGroupLayout({
      label: "renderer particle bind group layout",
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
      label: "renderer particle bind group",
      layout: layout1,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: particleBuffer,
          },
        },
      ],
    });
    this.bindGroups.particle = [this.globalBindGroup!, group1];

    const pipelineLayouts = this.device!.createPipelineLayout({
      label: "renderer particle pipeline layout",
      bindGroupLayouts: [this.globalBindGroupLayout!, layout1],
    });
    this.pipelines.particle = this.device!.createRenderPipeline({
      label: "renderer particle render pipeline",
      layout: pipelineLayouts,
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

  private async initializeSpringPipeline(
    springBuffer: GPUBuffer,
    particleBuffer: GPUBuffer,
  ) {
    const shaderCode = await fetchShaderCode("src/renderer/spring.wgsl");
    const shaderModule = this.device!.createShaderModule({
      code: shaderCode,
    });

    const layout1 = this.device!.createBindGroupLayout({
      label: "renderer spring bind group layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: "read-only-storage",
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
    const group1 = this.device!.createBindGroup({
      label: "renderer spring bind group",
      layout: layout1,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: springBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: particleBuffer,
          },
        },
      ],
    });
    this.bindGroups.spring = [this.globalBindGroup!, group1];

    const pipelineLayouts = this.device!.createPipelineLayout({
      label: "renderer spring pipeline layout",
      bindGroupLayouts: [this.globalBindGroupLayout!, layout1],
    });
    this.pipelines.spring = this.device!.createRenderPipeline({
      label: "renderer spring render pipeline",
      layout: pipelineLayouts,
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

  private async initializeShapePipeline(shapeBuffer: GPUBuffer) {
    const shaderCode = await fetchShaderCode("src/renderer/shape.wgsl");
    const shaderModule = this.device!.createShaderModule({
      code: shaderCode,
    });

    const layout1 = this.device!.createBindGroupLayout({
      label: "renderer shape bind group layout",
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
      label: "renderer shape bind group",
      layout: layout1,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: shapeBuffer,
          },
        },
      ],
    });
    this.bindGroups.shape = [this.globalBindGroup!, group1];

    const pipelineLayouts = this.device!.createPipelineLayout({
      label: "renderer shape pipeline layout",
      bindGroupLayouts: [this.globalBindGroupLayout!, layout1],
    });
    this.pipelines.shape = this.device!.createRenderPipeline({
      label: "renderer shape render pipeline",
      layout: pipelineLayouts,
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
    shapeBuffer: GPUBuffer,
    shapeCount: number,
  ): Promise<void> {
    this.particleCount = particleCount;
    this.springCount = springCount;
    this.shapeCount = shapeCount;
    this.initializeGlobalBindGroup();
    await Promise.all([
      this.initializeParticlePipeline(particleBuffer),
      this.initializeSpringPipeline(springBuffer, particleBuffer),
      this.initializeShapePipeline(shapeBuffer),
    ]);
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

    renderPass.setPipeline(this.pipelines.spring!);
    renderPass.setBindGroup(0, this.bindGroups.spring[0]);
    renderPass.setBindGroup(1, this.bindGroups.spring[1]);
    renderPass.draw(6, this.springCount, 0, 0);

    renderPass.setPipeline(this.pipelines.particle!);
    renderPass.setBindGroup(0, this.bindGroups.particle[0]);
    renderPass.setBindGroup(1, this.bindGroups.particle[1]);
    renderPass.draw(6, this.particleCount, 0, 0);

    renderPass.setPipeline(this.pipelines.shape!);
    renderPass.setBindGroup(0, this.bindGroups.shape[0]);
    renderPass.setBindGroup(1, this.bindGroups.shape[1]);
    renderPass.draw(6, this.shapeCount, 0, 0);

    renderPass.end();
    this.device!.queue.submit([commandEncoder.finish()]);
  }
}
