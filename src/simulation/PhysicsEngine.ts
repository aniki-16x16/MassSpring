import { Shape } from "../infrastructure/Shapes/Base";
import { Circle } from "../infrastructure/Shapes/Circle";
import { Rect } from "../infrastructure/Shapes/Rect";
import { fetchShaderCode } from "../infrastructure/utils";

type BufferKey = "particle" | "force" | "spring" | "mouse" | "obstacle";
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
    mouse: null,
    obstacle: null,
  };

  private numParticles = 32;
  private numSprings = 31;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  private initializeForceBuffer() {
    this.dataBuffers.force = this.device!.createBuffer({
      label: "force buffer",
      size: this.numParticles * 2 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }

  private initializeMouseBuffer() {
    this.dataBuffers.mouse = this.device!.createBuffer({
      label: "mouse buffer",
      size: 4 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  private initializeParticleBuffer() {
    this.dataBuffers.particle = this.device!.createBuffer({
      label: "particle buffer",
      size: this.numParticles * 8 * 4,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    const particleData = this.dataBuffers.particle!.getMappedRange();

    for (let i = 0; i < this.numParticles; i++) {
      const byteOffset = i * 8 * 4;
      const floatView = new Float32Array(particleData, byteOffset, 7);
      const uintView = new Uint32Array(particleData, byteOffset + 7 * 4, 1);
      // pos (vec4f) -> offset + 0, 1, 2, 3
      floatView[0] = -1 + (2 / (this.numParticles - 1)) * i;
      floatView[1] = 0.8;
      floatView[2] = 0;
      floatView[3] = 1;
      // velocity (vec2f) -> offset + 4, 5
      floatView[4] = 0;
      floatView[5] = 0;
      // mass (f32) -> offset + 6
      floatView[6] = 1 + (1 / (this.numParticles - 1)) * i;
      // is_static (u32) -> offset + 7
      uintView[0] = [this.numParticles - 1].includes(i) ? 1 : 0;
    }

    this.dataBuffers.particle!.unmap();
  }

  private initializeSpringBuffer() {
    this.dataBuffers.spring = this.device!.createBuffer({
      label: "spring buffer",
      size: this.numSprings * 8 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    const springData = this.dataBuffers.spring!.getMappedRange();

    for (let i = 0; i < this.numSprings; i++) {
      const byteOffset = i * 8 * 4;
      const uintView = new Uint32Array(springData, byteOffset, 2);
      const floatView = new Float32Array(springData, byteOffset + 2 * 4, 6);
      uintView[0] = i;
      uintView[1] = i + 1;
      // rest_length
      floatView[0] = 0.05;
      // stiffness
      floatView[1] = 500 + (1000 / (this.numSprings - 1)) * i;
      // is_broken
      floatView[2] = 0.0;
      // breaking_threshold
      floatView[3] = 0.2;
    }

    this.dataBuffers.spring!.unmap();
  }

  private initializeObstacleBuffer() {
    this.dataBuffers.obstacle = this.device!.createBuffer({
      label: "obstacle buffer",
      size: 3 * Shape.BYTE_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    const obstacleData = this.dataBuffers.obstacle!.getMappedRange();

    new Circle([-0.5, -0.3], 0.2).writeToComputeBuffer(obstacleData, 0);
    new Circle([0.0, -0.2], 0.1).writeToComputeBuffer(
      obstacleData,
      1 * Shape.BYTE_SIZE,
    );
    new Rect([0.5, 0.2], [0.3, 0.1], Math.PI / 6).writeToComputeBuffer(
      obstacleData,
      2 * Shape.BYTE_SIZE,
    );

    this.dataBuffers.obstacle!.unmap();
  }

  private initializeBuffers() {
    this.initializeParticleBuffer();
    this.initializeForceBuffer();
    this.initializeMouseBuffer();
    this.initializeSpringBuffer();
    this.initializeObstacleBuffer();
  }

  private initializeBindGroup() {
    const layout0 = this.device!.createBindGroupLayout({
      label: "compute bind group layout 0",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        },
      ],
    });
    const layout1 = this.device!.createBindGroupLayout({
      label: "compute bind group layout 1",
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
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
      ],
    });
    this.pipelineLayout = this.device!.createPipelineLayout({
      label: "compute pipeline layout",
      bindGroupLayouts: [layout0, layout1],
    });
    const bindGroup0 = this.device!.createBindGroup({
      label: "compute bind group 0",
      layout: layout0,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.dataBuffers.spring! },
        },
        {
          binding: 1,
          resource: { buffer: this.dataBuffers.obstacle! },
        },
      ],
    });
    const bindGroup1 = this.device!.createBindGroup({
      label: "compute bind group 1",
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
        {
          binding: 2,
          resource: { buffer: this.dataBuffers.mouse! },
        },
      ],
    });
    this.bindGroups.push(bindGroup0, bindGroup1);
  }

  private async initializePipeline() {
    const shaderCode = await fetchShaderCode("src/shader/compute.wgsl");
    const shaderModule = this.device!.createShaderModule({
      code: shaderCode,
    });
    this.pipelines.spring = this.device!.createComputePipeline({
      label: "spring compute pipeline",
      layout: this.pipelineLayout!,
      compute: {
        module: shaderModule,
        entryPoint: "spring_main",
      },
    });
    this.pipelines.particle = this.device!.createComputePipeline({
      label: "particle compute pipeline",
      layout: this.pipelineLayout!,
      compute: {
        module: shaderModule,
        entryPoint: "main",
      },
    });
  }

  async initialize(): Promise<void> {
    this.initializeBuffers();
    this.initializeBindGroup();
    await this.initializePipeline();
  }

  updateMousePosition(x: number, y: number) {
    const mouseData = new Float32Array([x, y]);
    this.device!.queue.writeBuffer(
      this.dataBuffers.mouse!,
      0,
      mouseData.buffer,
    );
  }
  updateMousePressed(pressed: boolean) {
    const pressedData = new Uint32Array([pressed ? 1 : 0]);
    this.device!.queue.writeBuffer(
      this.dataBuffers.mouse!,
      2 * 4,
      pressedData.buffer,
    );
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
  getObstacleBuffer(): GPUBuffer {
    return this.dataBuffers.obstacle!;
  }
  getObstacleCount(): number {
    return 3;
  }
}
