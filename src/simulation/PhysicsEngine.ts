import { fetchShaderCode } from "../infrastructure/utils";

export class PhysicsEngine {
  private device: GPUDevice | null = null;
  private pipeline: GPUComputePipeline | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private dataBuffer: GPUBuffer | null = null;

  // 假设我们要处理 1024 个浮点数
  private numElements = 1024;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  async initialize() {
    // 1. 加载 Shader 代码
    const shaderCode = await fetchShaderCode(
      "src/simulation/shaders/compute.wgsl"
    );
    const shaderModule = this.device!.createShaderModule({
      code: shaderCode,
    });
    // 2. 创建数据缓冲区 (Storage Buffer)
    // 注意：添加 VERTEX 用途，让这个 Buffer 可以同时作为顶点数据
    this.dataBuffer = this.device!.createBuffer({
      size: this.numElements * 4 * 4,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.VERTEX, // 👈 关键：允许作为 Vertex Buffer
      mappedAtCreation: true, // 允许初始化时写入数据
    });
    // 初始化数据...
    new Float32Array(this.dataBuffer.getMappedRange()).set(
      new Float32Array(this.numElements * 4).map((_, i) =>
        i % 4 === 3 ? 1 : Math.random() * 2 - 1
      )
    );
    this.dataBuffer.unmap();
    // 3. 创建 Pipeline
    this.pipeline = this.device!.createComputePipeline({
      layout: "auto",
      compute: {
        module: shaderModule,
        entryPoint: "main",
      },
    });
    // 4. 创建 BindGroup
    this.bindGroup = this.device!.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.dataBuffer } }],
    });
  }

  run() {
    if (!this.pipeline || !this.bindGroup) return;
    // 1. 创建命令编码器
    const commandEncoder = this.device!.createCommandEncoder();
    // 2. 开始计算通道
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.bindGroup);
    // 3. 调度工作组 (Dispatch)
    passEncoder.dispatchWorkgroups(Math.ceil(this.numElements / 64));
    passEncoder.end();
    // 4. 提交命令
    this.device!.queue.submit([commandEncoder.finish()]);
  }

  // 暴露 Buffer 和顶点数量，供 Renderer 使用
  getVertexBuffer(): GPUBuffer {
    return this.dataBuffer!;
  }

  getVertexCount(): number {
    return this.numElements;
  }

  // 用于 Debug: 读取 GPU 数据回 CPU
  async debugGetData(): Promise<Float32Array> {
    const readBuffer = this.device!.createBuffer({
      size: this.numElements * 4 * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const commandEncoder = this.device!.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(
      this.dataBuffer!,
      readBuffer,
      this.numElements * 4 * 4
    );
    this.device!.queue.submit([commandEncoder.finish()]);
    await readBuffer.mapAsync(GPUMapMode.READ);
    const arrayBuffer = readBuffer.getMappedRange();
    const data = new Float32Array(arrayBuffer.slice(0));
    readBuffer.unmap();
    return data;
  }
}
