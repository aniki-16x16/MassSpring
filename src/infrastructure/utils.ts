// 缓存已加载的 shader 文件
const shaderCache = new Map<string, string>();

export async function fetchShaderCode(path: string): Promise<string> {
  // 检查缓存
  if (shaderCache.has(path)) {
    return shaderCache.get(path)!;
  }

  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load shader code from ${path}`);
  }
  let code = await response.text();

  // 处理 @import 指令
  const importRegex = /@import\s+["']([^"']+)["']/g;
  let match;

  while ((match = importRegex.exec(code)) !== null) {
    const importPath = match[1];
    // 解析相对路径
    const resolvedPath = new URL(
      importPath,
      new URL(path, window.location.href),
    ).href;

    // 递归获取导入的文件内容
    const importedCode = await fetchShaderCode(resolvedPath);

    // 替换 @import 指令
    code = code.replace(match[0], importedCode);
  }

  // 更新缓存
  shaderCache.set(path, code);

  return code;
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
