import { fetchShaderCode } from "../infrastructure/utils";

type PipelineKey = "particle" | "spring";

export class Renderer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private canvasFormat: GPUTextureFormat | null = null;

  private vertexBuffer: GPUBuffer | null = null;
  private vertexCount: number = 0;
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

  private initializeSpringBindGroup() {
    const uniformBindGroupLayout = this.device!.createBindGroupLayout({
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
    const uniformBindGroup = this.device!.createBindGroup({
      layout: uniformBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.uniformBuffer!,
          },
        },
      ],
    });

    const storageBindGroupLayout = this.device!.createBindGroupLayout({
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
    const storageBindGroup = this.device!.createBindGroup({
      layout: storageBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.vertexBuffer!,
          },
        },
      ],
    });

    this.bindGroups.spring = [uniformBindGroup, storageBindGroup];

    this.pipelineLayouts.spring = this.device!.createPipelineLayout({
      bindGroupLayouts: [uniformBindGroupLayout, storageBindGroupLayout],
    });
  }

  private initializeParticleBindGroup() {
    const bindGroupLayout = this.device!.createBindGroupLayout({
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
    this.bindGroups.particle = [
      this.device!.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: {
              buffer: this.uniformBuffer!,
            },
          },
        ],
      }),
    ];

    this.pipelineLayouts.particle = this.device!.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
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
        buffers: [
          {
            arrayStride: 8 * 4,
            stepMode: "instance",
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: "float32x4",
              },
            ],
          },
        ],
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
        buffers: [
          {
            arrayStride: 4 * 4,
            stepMode: "instance",
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: "uint32x2",
              },
            ],
          },
        ],
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
    vertexBuffer: GPUBuffer,
    vertexCount: number,
    springBuffer: GPUBuffer,
    springCount: number,
  ): Promise<void> {
    this.vertexBuffer = vertexBuffer;
    this.vertexCount = vertexCount;
    this.springBuffer = springBuffer;
    this.springCount = springCount;
    this.initializeUniformBuffer();
    this.initializeParticleBindGroup();
    this.initializeSpringBindGroup();
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

    renderPass.setPipeline(this.pipelines.particle!);
    renderPass.setBindGroup(0, this.bindGroups.particle[0]);
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    renderPass.draw(6, this.vertexCount, 0, 0);

    renderPass.setPipeline(this.pipelines.spring!);
    renderPass.setBindGroup(0, this.bindGroups.spring[0]);
    renderPass.setBindGroup(1, this.bindGroups.spring[1]);
    renderPass.setVertexBuffer(0, this.springBuffer!);
    renderPass.draw(6, this.springCount, 0, 0);

    renderPass.end();
    this.device!.queue.submit([commandEncoder.finish()]);
  }
}
