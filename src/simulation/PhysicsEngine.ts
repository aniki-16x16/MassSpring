import { Shape } from "../infrastructure/Shapes/Base";
import { Circle } from "../infrastructure/Shapes/Circle";
import { Rect } from "../infrastructure/Shapes/Rect";
import { SpringComputePipeline } from "./SpringPipeline";
import { ParticleComputePipeline } from "./ParticlePipeline";

type BufferKey = "mouse" | "obstacle";

export class PhysicsEngine {
  private device: GPUDevice | null = null;
  private springPipeline: SpringComputePipeline | null = null;
  private particlePipeline: ParticleComputePipeline | null = null;
  private dataBuffers: Record<BufferKey, GPUBuffer | null> = {
    mouse: null,
    obstacle: null,
  };
  private globalBindGroupLayout: GPUBindGroupLayout | null = null;
  private globalBindGroup: GPUBindGroup | null = null;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  private initializeMouseBuffer() {
    this.dataBuffers.mouse = this.device!.createBuffer({
      label: "mouse buffer",
      size: 4 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
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

  private initializeGlobalBindGroup() {
    this.globalBindGroupLayout = this.device!.createBindGroupLayout({
      label: "[Compute] global bind group layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: "uniform",
          },
        },
      ],
    });
    this.globalBindGroup = this.device!.createBindGroup({
      label: "[Compute] global bind group",
      layout: this.globalBindGroupLayout!,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.dataBuffers.mouse!,
          },
        },
      ],
    });
  }

  async initialize(): Promise<void> {
    this.initializeMouseBuffer();
    this.initializeObstacleBuffer();
    this.initializeGlobalBindGroup();

    this.particlePipeline = new ParticleComputePipeline(this.device!);
    this.springPipeline = new SpringComputePipeline(this.device!);

    this.particlePipeline.initBuffer();
    this.springPipeline.initBuffer();
    const particleBuffer = this.particlePipeline.getBufferResource();
    const { forceBuffer } = this.springPipeline.getBufferResources();
    this.particlePipeline.setExtraBuffers({
      forceBuffer: forceBuffer,
      obstacleBuffer: this.dataBuffers.obstacle!,
    });
    this.springPipeline.setExtraBuffers({
      particleBuffer: particleBuffer,
    });

    await Promise.all([
      this.particlePipeline.initialize(
        this.globalBindGroupLayout!,
        this.globalBindGroup!,
      ),
      this.springPipeline.initialize(),
    ]);
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
    this.springPipeline?.run(passSpring);
    passSpring.end();

    const passParticle = commandEncoder.beginComputePass();
    this.particlePipeline?.run(passParticle);
    passParticle.end();

    this.device!.queue.submit([commandEncoder.finish()]);
  }

  getVertexBuffer(): GPUBuffer {
    return this.particlePipeline!.getBufferResource();
  }
  getVertexCount(): number {
    return this.particlePipeline!.instanceCount;
  }
  getSpringBuffer(): GPUBuffer {
    return this.springPipeline!.getBufferResources().springBuffer;
  }
  getSpringCount(): number {
    return this.springPipeline!.instanceCount;
  }
  getObstacleBuffer(): GPUBuffer {
    return this.dataBuffers.obstacle!;
  }
  getObstacleCount(): number {
    return 3;
  }
}
