// Renderer: 负责在屏幕上绘制内容

import { fetchShaderCode } from "../infrastructure/utils";

export class Renderer {
  private pipeline: GPURenderPipeline | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private canvasFormat: GPUTextureFormat | null = null;
  private vertexBuffer: GPUBuffer | null = null;
  private vertexCount: number = 0;

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

    this.pipeline = this.device!.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: 4 * 4,
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
          },
        ],
      },
      primitive: {
        topology: "point-list",
      },
    });

    this.vertexBuffer = vertexBuffer;
    this.vertexCount = vertexCount;
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
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    renderPass.draw(this.vertexCount, 1, 0, 0);
    renderPass.end();
    this.device!.queue.submit([commandEncoder.finish()]);
  }
}
