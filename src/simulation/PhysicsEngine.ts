import { fetchShaderCode, MyRandom } from "../infrastructure/utils";

type BufferKey = "particle" | "force" | "spring";
type PipelineKey = "particle" | "spring";

export class PhysicsEngine {
  private device: GPUDevice | null = null;
  private pipelines: Record<PipelineKey, GPUComputePipeline | null> = {
    particle: null,
    spring: null,
  };
  private bindGroups: GPUBindGroup[] = [];
  private pipelineLayout: GPUPipelineLayout | null = null;
  private dataBuffers: Record<BufferKey, GPUBuffer | null> = {
    particle: null,
    force: null,
    spring: null,
  };

  private numParticles = 32;
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
      particleData[offset + 7] = 0; // padding
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
      particleData,
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
    this.dataBuffers.spring = this.device!.createBuffer({
      size: this.numSprings * 4 * 4,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    const springData = this.dataBuffers.spring!.getMappedRange();
    for (let i = 0; i < this.numSprings; i++) {
      const byteOffset = i * 4 * 4;
      const floatView = new Float32Array(springData, byteOffset, 4);
      const uintView = new Uint32Array(springData, byteOffset, 4);
      uintView[0] = MyRandom.randomInt(0, this.numParticles);
      uintView[1] = MyRandom.randomInt(0, this.numParticles);
      floatView[2] = 0.1;
      floatView[3] = 10;
    }
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
    const shaderCode = await fetchShaderCode("src/simulation/compute.wgsl");
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
    this.pipelines.particle = this.device!.createComputePipeline({
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

    const passParticle = commandEncoder.beginComputePass();
    passParticle.setPipeline(this.pipelines.particle!);
    passParticle.setBindGroup(0, this.bindGroups[0]);
    passParticle.setBindGroup(1, this.bindGroups[1]);
    passParticle.dispatchWorkgroups(Math.ceil(this.numParticles / 64));
    passParticle.end();
    this.device!.queue.submit([commandEncoder.finish()]);
  }

  getVertexBuffer(): GPUBuffer {
    return this.dataBuffers.particle!;
  }
  getVertexCount(): number {
    return this.numParticles;
  }
  getSpringBuffer(): GPUBuffer {
    return this.dataBuffers.spring!;
  }
  getSpringCount(): number {
    return this.numSprings;
  }
}
