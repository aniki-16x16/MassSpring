// Renderer: 负责在屏幕上绘制内容

import { fetchShaderCode } from "../infrastructure/utils";

export class Renderer {
  private pipeline: GPURenderPipeline | null = null;
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private canvasFormat: GPUTextureFormat | null = null;
  private vertexBuffer: GPUBuffer | null = null;
  private vertexCount: number = 0;
  private uniformBuffer: GPUBuffer | null = null;
  private bindGroup: GPUBindGroup | null = null;

  constructor(
    device: GPUDevice,
    context: GPUCanvasContext,
    canvasFormat: GPUTextureFormat
  ) {
    this.device = device;
    this.context = context;
    this.canvasFormat = canvasFormat;
  }

  async initialize(
    vertexBuffer: GPUBuffer,
    vertexCount: number
  ): Promise<void> {
    const shaderCode = await fetchShaderCode(
      "src/simulation/shaders/render.wgsl"
    );
    const shaderModule = this.device!.createShaderModule({
      code: shaderCode,
    });

    this.uniformBuffer = this.device!.createBuffer({
      size: 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.uniformBuffer.getMappedRange()).set([1.0]);
    this.uniformBuffer.unmap();

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
    this.bindGroup = this.device!.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.uniformBuffer,
          },
        },
      ],
    });

    const pipelineLayout = this.device!.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });
    this.pipeline = this.device!.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: 4 * 8,
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

    this.vertexBuffer = vertexBuffer;
    this.vertexCount = vertexCount;
  }

  updateAspectRatio(aspectRatio: number) {
    this.device!.queue.writeBuffer(
      this.uniformBuffer!,
      0,
      new Float32Array([aspectRatio]).buffer
    );
  }

  render() {
    if (!this.pipeline || !this.vertexBuffer) return;

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
    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.bindGroup!);
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    renderPass.draw(6, this.vertexCount, 0, 0);
    renderPass.end();
    this.device!.queue.submit([commandEncoder.finish()]);
  }
}
