import { Shape } from "../infrastructure/Shapes/Base";
import { Circle } from "../infrastructure/Shapes/Circle";
import { Rect } from "../infrastructure/Shapes/Rect";
import { SpringComputePipeline } from "./SpringPipeline";
import { ParticleComputePipeline } from "./ParticlePipeline";
import { ResourceRegistry } from "./ResourceRegistry";
import type { BaseComputePipeline } from "./BaseComputePipeline";

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
  private registry: ResourceRegistry;
  private pipelines: BaseComputePipeline[] = [];

  // 全局资源
  private mouseBuffer: GPUBuffer | null = null;
  private obstacleBuffer: GPUBuffer | null = null;

  constructor(device: GPUDevice) {
    this.device = device;
    this.registry = new ResourceRegistry();
  }

  async initialize(): Promise<void> {
    // 1. 创建全局资源并注册
    this.createGlobalResources();

    // 2. 创建 pipeline 实例
    const particlePipeline = new ParticleComputePipeline(
      this.device,
      this.registry,
    );
    const springPipeline = new SpringComputePipeline(
      this.device,
      this.registry,
    );

    this.pipelines = [
      springPipeline,
      particlePipeline,
      // 未来添加新功能只需在这里加一行：
      // new SpatialHashPipeline(this.device, this.registry),
      // new CollisionPipeline(this.device, this.registry),
    ];

    // 3. 初始化 pipelines（解决循环依赖）
    // 循环依赖：Particle 需要 forceBuffer，Spring 需要 particleBuffer
    // 解决方案：分阶段初始化

    // 阶段1：Particle 创建 particleBuffer（不创建 bind group）
    await particlePipeline.initialize();

    // 阶段2：Spring 创建 springBuffer 和 forceBuffer（不创建 bind group）
    await springPipeline.initialize();

    // 阶段3：现在所有 buffer 都有了，完成 bind group 创建
    springPipeline.completeInitialization();
    particlePipeline.completeInitialization();
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
    this.registry.registerBuffer("mouseBuffer", this.mouseBuffer);

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

    this.registry.registerBuffer("obstacleBuffer", this.obstacleBuffer);

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
    this.registry.registerBindGroupLayout(
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
    this.registry.registerBindGroup("globalBindGroup", globalBindGroup);
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
    const computePass = commandEncoder.beginComputePass();

    // 按顺序执行所有 pipelines
    this.pipelines.forEach((pipeline) => pipeline.run(computePass));

    computePass.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  // ========== Getters（供渲染器使用）==========

  getParticleBuffer(): GPUBuffer {
    return this.registry.getBuffer("particleBuffer");
  }

  getParticleCount(): number {
    // 从 particle pipeline 获取
    const particlePipeline = this.pipelines.find(
      (p) => p instanceof ParticleComputePipeline,
    ) as ParticleComputePipeline;
    return particlePipeline?.instanceCount || 0;
  }

  getSpringBuffer(): GPUBuffer {
    return this.registry.getBuffer("springBuffer");
  }

  getSpringCount(): number {
    // 从 spring pipeline 获取
    const springPipeline = this.pipelines.find(
      (p) => p instanceof SpringComputePipeline,
    ) as SpringComputePipeline;
    return springPipeline.instanceCount;
  }

  getObstacleBuffer(): GPUBuffer {
    return this.obstacleBuffer!;
  }

  getObstacleCount(): number {
    return 3;
  }
}
