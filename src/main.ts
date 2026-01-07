import "./style.css";
import { WebGPUContext } from "./infrastructure/WebGPUContext";

const init = async () => {
  try {
    const gpuContext = new WebGPUContext("app");
    await gpuContext.initialize();
  } catch (error) {
    console.error("Initialization failed", error);
    document.body.innerHTML = `<h1>WebGPU Not Supported: ${error}</h1>`;
  }
};

init();
