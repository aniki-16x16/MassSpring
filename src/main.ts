import "./style.css";
import { WebGPUContext } from "./infrastructure/WebGPUContext";
import { PhysicsEngine } from "./simulation/PhysicsEngine";

const init = async () => {
  try {
    const gpuContext = new WebGPUContext("app");
    await gpuContext.initialize();
    return gpuContext;
  } catch (error) {
    console.error("Initialization failed", error);
    document.body.innerHTML = `<h1>WebGPU Not Supported: ${error}</h1>`;
  }
};

const gpuContext = (await init())!;
const engine = new PhysicsEngine(gpuContext.device!);
await engine.initialize();
engine.run();
console.log(await engine.debugGetData());
