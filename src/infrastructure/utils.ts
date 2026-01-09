export async function fetchShaderCode(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load shader code from ${path}`);
  }
  return await response.text();
}

export class MyRandom {
  static randomInRangeGenerator(min: number, max: number): () => number {
    return () => Math.random() * (max - min) + min;
  }
  static randomInRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }
}
