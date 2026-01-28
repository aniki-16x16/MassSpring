/**
 * ResourceRegistry - 集中管理所有共享的 GPU 资源
 *
 * 职责：
 * - 注册和获取 GPU Buffers
 * - 注册和获取 Bind Groups
 * - 注册和获取 Bind Group Layouts
 * - 提供资源存在性检查
 */
export class ResourceRegistry {
  private buffers = new Map<string, GPUBuffer>();
  private bindGroups = new Map<string, GPUBindGroup>();
  private bindGroupLayouts = new Map<string, GPUBindGroupLayout>();

  // ========== Buffer 管理 ==========
  registerBuffer(name: string, buffer: GPUBuffer): void {
    if (this.buffers.has(name)) {
      console.warn(`Buffer "${name}" already registered, overwriting...`);
    }
    this.buffers.set(name, buffer);
  }

  getBuffer(name: string): GPUBuffer {
    const buffer = this.buffers.get(name);
    if (!buffer) {
      throw new Error(`Buffer not found: ${name}`);
    }
    return buffer;
  }

  hasBuffer(name: string): boolean {
    return this.buffers.has(name);
  }

  // ========== Bind Group 管理 ==========
  registerBindGroup(name: string, bindGroup: GPUBindGroup): void {
    if (this.bindGroups.has(name)) {
      console.warn(`BindGroup "${name}" already registered, overwriting...`);
    }
    this.bindGroups.set(name, bindGroup);
  }

  getBindGroup(name: string): GPUBindGroup {
    const group = this.bindGroups.get(name);
    if (!group) {
      throw new Error(`BindGroup not found: ${name}`);
    }
    return group;
  }

  hasBindGroup(name: string): boolean {
    return this.bindGroups.has(name);
  }

  // ========== Bind Group Layout 管理 ==========
  registerBindGroupLayout(name: string, layout: GPUBindGroupLayout): void {
    if (this.bindGroupLayouts.has(name)) {
      console.warn(
        `BindGroupLayout "${name}" already registered, overwriting...`,
      );
    }
    this.bindGroupLayouts.set(name, layout);
  }

  getBindGroupLayout(name: string): GPUBindGroupLayout {
    const layout = this.bindGroupLayouts.get(name);
    if (!layout) {
      throw new Error(`BindGroupLayout not found: ${name}`);
    }
    return layout;
  }

  hasBindGroupLayout(name: string): boolean {
    return this.bindGroupLayouts.has(name);
  }

  // ========== 调试工具 ==========
  listResources(): void {
    console.log("=== ResourceRegistry Contents ===");
    console.log("Buffers:", Array.from(this.buffers.keys()));
    console.log("BindGroups:", Array.from(this.bindGroups.keys()));
    console.log("BindGroupLayouts:", Array.from(this.bindGroupLayouts.keys()));
  }
}

export const resourceRegistry = new ResourceRegistry();
