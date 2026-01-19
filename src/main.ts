import "./style.css";
import { WebGPUContext } from "./infrastructure/WebGPUContext";
import { PhysicsEngine } from "./simulation/PhysicsEngine";
import { Renderer } from "./renderer/Renderer";

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

const main = async () => {
  try {
    const gpuContext = (await init())!;
    const engine = new PhysicsEngine(gpuContext.device!);
    await engine.initialize();

    const renderer = new Renderer(
      gpuContext.device!,
      gpuContext.context!,
      navigator.gpu.getPreferredCanvasFormat(),
    );
    await renderer.initialize(
      engine.getVertexBuffer(),
      engine.getVertexCount(),
      engine.getSpringBuffer(),
      engine.getSpringCount(),
    );

    renderer.updateAspectRatio(window.innerWidth / window.innerHeight);

    const renderLoop = () => {
      engine.run();
      renderer.render();
      requestAnimationFrame(renderLoop);
    };
    renderLoop();
  } catch (error) {
    console.error("Main execution failed", error);
  }
};
main();
