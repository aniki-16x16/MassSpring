export async function fetchShaderCode(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load shader code from ${path}`);
  }
  return await response.text();
}

export class MyRandom {
  static randomGenerator(min: number, max: number): () => number {
    return () => Math.random() * (max - min) + min;
  }
  static random(min: number, max: number): number {
    return MyRandom.randomGenerator(min, max)();
  }
  static randomIntGenerator(min: number, max: number): () => number {
    return () => Math.floor(Math.random() * (max - min)) + min;
  }
  static randomInt(min: number, max: number): number {
    return MyRandom.randomIntGenerator(min, max)();
  }
}
