import { Shape } from "../infrastructure/Shapes/Base";
import { Circle } from "../infrastructure/Shapes/Circle";
import { Rect } from "../infrastructure/Shapes/Rect";
import { SpringComputePipeline } from "./SpringPipeline";
import { ParticleComputePipeline } from "./ParticlePipeline";
import { resourceRegistry } from "../infrastructure/ResourceRegistry";
import { GridComputePipeline } from "./GridPipeline";
import { CleanGridPipeline } from "./CleanGridPipeline";

/**
 * PhysicsEngine - 物理引擎
 *
 * 职责：
 * - 创建全局资源（mouse, obstacle）
 * - 注册和协调所有 Pipeline
 * - 提供统一的运行接口
 *
 * 设计理念：保持清爽，一眼看出整体流程
 */
export class PhysicsEngine {
  private device: GPUDevice;
  private pipelines: {
    particle: ParticleComputePipeline | null;
    spring: SpringComputePipeline | null;
    grid: GridComputePipeline | null;
    cleanGrid: CleanGridPipeline | null;
  } = {
    particle: null,
    spring: null,
    grid: null,
    cleanGrid: null,
  };

  // 全局资源
  private mouseBuffer: GPUBuffer | null = null;
  private obstacleBuffer: GPUBuffer | null = null;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  async initialize(): Promise<void> {
    // 1. 创建全局资源并注册
    this.createGlobalResources();

    // 2. 创建 pipeline 实例
    const particlePipeline = new ParticleComputePipeline(this.device);
    const springPipeline = new SpringComputePipeline(this.device);
    const gridPipeline = new GridComputePipeline(this.device);
    gridPipeline.instanceCount = particlePipeline.instanceCount;
    const cleanGridPipeline = new CleanGridPipeline(this.device);

    this.pipelines.particle = particlePipeline;
    this.pipelines.spring = springPipeline;
    this.pipelines.grid = gridPipeline;
    this.pipelines.cleanGrid = cleanGridPipeline;

    // 3. 初始化 pipelines（解决循环依赖）
    // 循环依赖：Particle 需要 forceBuffer，Spring 需要 particleBuffer
    // 解决方案：分阶段初始化

    await particlePipeline.initialize();
    await springPipeline.initialize();
    await gridPipeline.initialize();
    await cleanGridPipeline.initialize();
    cleanGridPipeline.instanceCount = Math.max(
      particlePipeline.instanceCount,
      gridPipeline.gridCellCount,
    );

    // 阶段3：现在所有 buffer 都有了，完成 bind group 创建
    springPipeline.completeInitialization();
    particlePipeline.completeInitialization();
    gridPipeline.completeInitialization();
    cleanGridPipeline.completeInitialization();
  }

  /**
   * 创建全局资源
   */
  private createGlobalResources(): void {
    // Mouse buffer
    this.mouseBuffer = this.device.createBuffer({
      label: "mouse buffer",
      size: 4 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    resourceRegistry.registerBuffer("mouseBuffer", this.mouseBuffer);

    // Obstacle buffer
    this.obstacleBuffer = this.device.createBuffer({
      label: "obstacle buffer",
      size: 3 * Shape.BYTE_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    const obstacleData = this.obstacleBuffer.getMappedRange();
    new Circle([-0.5, -0.3], 0.2).writeToComputeBuffer(obstacleData, 0);
    new Circle([0.0, -0.2], 0.1).writeToComputeBuffer(
      obstacleData,
      1 * Shape.BYTE_SIZE,
    );
    new Rect([0.5, 0.2], [0.3, 0.1], Math.PI / 6).writeToComputeBuffer(
      obstacleData,
      2 * Shape.BYTE_SIZE,
    );
    this.obstacleBuffer.unmap();

    resourceRegistry.registerBuffer("obstacleBuffer", this.obstacleBuffer);

    // Global bind group layout
    const globalBindGroupLayout = this.device.createBindGroupLayout({
      label: "[Compute] global bind group layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
      ],
    });
    resourceRegistry.registerBindGroupLayout(
      "globalBindGroupLayout",
      globalBindGroupLayout,
    );

    // Global bind group
    const globalBindGroup = this.device.createBindGroup({
      label: "[Compute] global bind group",
      layout: globalBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.mouseBuffer },
        },
      ],
    });
    resourceRegistry.registerBindGroup("globalBindGroup", globalBindGroup);
  }

  /**
   * 更新鼠标位置
   */
  updateMousePosition(x: number, y: number): void {
    const mouseData = new Float32Array([x, y]);
    this.device.queue.writeBuffer(this.mouseBuffer!, 0, mouseData.buffer);
  }

  /**
   * 更新鼠标按下状态
   */
  updateMousePressed(pressed: boolean): void {
    const pressedData = new Uint32Array([pressed ? 1 : 0]);
    this.device.queue.writeBuffer(this.mouseBuffer!, 2 * 4, pressedData.buffer);
  }

  /**
   * 运行物理模拟
   */
  run(): void {
    const commandEncoder = this.device.createCommandEncoder();

    const clearPass = commandEncoder.beginComputePass();
    this.pipelines.cleanGrid!.run(clearPass);
    clearPass.end();

    const prePass = commandEncoder.beginComputePass();
    this.pipelines.spring!.run(prePass);
    this.pipelines.grid!.run(prePass);
    prePass.end();

    const particlePass = commandEncoder.beginComputePass();
    this.pipelines.particle!.run(particlePass);
    particlePass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  getParticleCount(): number {
    return this.pipelines.particle!.instanceCount;
  }
  getSpringCount(): number {
    return this.pipelines.spring!.instanceCount;
  }
  getObstacleCount(): number {
    return 3;
  }
  getGridCount(): number {
    return this.pipelines.grid!.gridCellCount;
  }
}
