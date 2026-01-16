import { fetchShaderCode, MyRandom } from "../infrastructure/utils";

type BufferKey = "particle" | "force" | "spring";
type PipelineKey = "final" | "spring";

export class PhysicsEngine {
  private device: GPUDevice | null = null;
  private pipelines: Record<PipelineKey, GPUComputePipeline | null> = {
    final: null,
    spring: null,
  };
  private bindGroups: GPUBindGroup[] = [];
  private pipelineLayout: GPUPipelineLayout | null = null;
  private dataBuffers: Record<BufferKey, GPUBuffer | null> = {
    particle: null,
    force: null,
    spring: null,
  };

  private numParticles = 16;
  private numSprings = 8;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  private initializeParticleBuffer() {
    const particleData = new Float32Array(this.numParticles * 8);
    for (let i = 0; i < this.numParticles; i++) {
      const offset = i * 8;
      const randomGen = MyRandom.randomGenerator(-1, 1);
      // pos (vec4f) -> offset + 0, 1, 2, 3
      particleData[offset + 0] = randomGen(); // x
      particleData[offset + 1] = randomGen(); // y
      particleData[offset + 2] = 0; // z
      particleData[offset + 3] = 1; // w
      // velocity (vec2f) -> offset + 4, 5
      particleData[offset + 4] = randomGen() * 1; // vx
      particleData[offset + 5] = 0; // vy
      // mass (f32) -> offset + 6
      particleData[offset + 6] = 1;
      // padding (f32) -> offset + 7
      particleData[offset + 7] = 0; // 占位符，WGSL 不会读取，但位置必须留着
    }

    this.dataBuffers.particle = this.device!.createBuffer({
      size: particleData.byteLength,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.VERTEX, // 👈 关键：允许作为 Vertex Buffer
      mappedAtCreation: true, // 允许初始化时写入数据
    });

    new Float32Array(this.dataBuffers.particle!.getMappedRange()).set(
      particleData
    );
    this.dataBuffers.particle!.unmap();
  }

  private initializeForceBuffer() {
    const forceData = new Float32Array(this.numParticles * 4);
    this.dataBuffers.force = this.device!.createBuffer({
      size: forceData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.dataBuffers.force!.getMappedRange()).set(forceData);
    this.dataBuffers.force!.unmap();
  }

  private initializeSpringBuffer() {
    const springData = new Float32Array(this.numSprings * 4);
    for (let i = 0; i < this.numSprings; i++) {
      const offset = i * 4;
      springData[offset + 0] = MyRandom.randomInt(0, this.numParticles);
      springData[offset + 1] = MyRandom.randomInt(0, this.numParticles);
      springData[offset + 2] = 0.1;
      springData[offset + 3] = 10;
    }
    this.dataBuffers.spring = this.device!.createBuffer({
      size: springData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.dataBuffers.spring!.getMappedRange()).set(springData);
    this.dataBuffers.spring!.unmap();
  }

  private initializeBindGroup() {
    const layout0 = this.device!.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        },
      ],
    });
    const layout1 = this.device!.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" },
        },
      ],
    });
    this.pipelineLayout = this.device!.createPipelineLayout({
      bindGroupLayouts: [layout0, layout1],
    });
    const bindGroup0 = this.device!.createBindGroup({
      layout: layout0,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.dataBuffers.spring! },
        },
      ],
    });
    const bindGroup1 = this.device!.createBindGroup({
      layout: layout1,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.dataBuffers.particle! },
        },
        {
          binding: 1,
          resource: { buffer: this.dataBuffers.force! },
        },
      ],
    });
    this.bindGroups.push(bindGroup0, bindGroup1);
  }

  private async initializePipeline() {
    const shaderCode = await fetchShaderCode(
      "src/simulation/shaders/compute.wgsl"
    );
    const shaderModule = this.device!.createShaderModule({
      code: shaderCode,
    });
    this.pipelines.spring = this.device!.createComputePipeline({
      layout: this.pipelineLayout!,
      compute: {
        module: shaderModule,
        entryPoint: "spring_main",
      },
    });
    this.pipelines.final = this.device!.createComputePipeline({
      layout: this.pipelineLayout!,
      compute: {
        module: shaderModule,
        entryPoint: "main",
      },
    });
  }

  async initialize(): Promise<void> {
    this.initializeParticleBuffer();
    this.initializeForceBuffer();
    this.initializeSpringBuffer();
    this.initializeBindGroup();
    await this.initializePipeline();
  }

  run() {
    const commandEncoder = this.device!.createCommandEncoder();

    const passSpring = commandEncoder.beginComputePass();
    passSpring.setPipeline(this.pipelines.spring!);
    passSpring.setBindGroup(0, this.bindGroups[0]);
    passSpring.setBindGroup(1, this.bindGroups[1]);
    passSpring.dispatchWorkgroups(Math.ceil(this.numSprings / 64));
    passSpring.end();

    const passFinal = commandEncoder.beginComputePass();
    passFinal.setPipeline(this.pipelines.final!);
    passFinal.setBindGroup(0, this.bindGroups[0]);
    passFinal.setBindGroup(1, this.bindGroups[1]);
    passFinal.dispatchWorkgroups(Math.ceil(this.numParticles / 64));
    passFinal.end();

    this.device!.queue.submit([commandEncoder.finish()]);
  }

  // 暴露 Buffer 和顶点数量，供 Renderer 使用
  getVertexBuffer(): GPUBuffer {
    return this.dataBuffers.particle!;
  }

  getVertexCount(): number {
    return this.numParticles;
  }
}
