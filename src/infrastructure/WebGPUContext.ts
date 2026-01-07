export class WebGPUContext {
  public canvas: HTMLCanvasElement;
  public adapter: GPUAdapter | null = null;
  public device: GPUDevice | null = null;
  public context: GPUCanvasContext | null = null;

  constructor(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      throw new Error(`Could not find canvas with id: ${canvasId}`);
    }
    this.canvas = canvas;
  }

  async initialize(): Promise<void> {
    // 1. 检查浏览器是否支持 WebGPU
    if (!navigator.gpu) {
      throw new Error("WebGPU is not supported in this browser.");
    }

    // 2. 请求 Adapter (物理设备)
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("Failed to get GPU adapter.");
    }
    this.adapter = adapter;

    // 3. 请求 Device (逻辑设备)
    const device = await adapter.requestDevice();
    if (!device) {
      throw new Error("Failed to get GPU device.");
    }
    this.device = device;

    // 4. 获取 Canvas 上下文
    this.context = this.canvas.getContext("webgpu");

    // 5. 配置 Canvas 上下文 (Configure)
    this.context!.configure({
      device: this.device,
      format: navigator.gpu.getPreferredCanvasFormat(),
      alphaMode: "opaque",
    });

    console.log("WebGPU Initialized!", this.device);
  }
}
