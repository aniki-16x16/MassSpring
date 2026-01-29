@import './shared/types.wgsl';
@import './shared/compute_constants.wgsl';

struct VertexInput {
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32,
};

struct VertexOutput {
  @builtin(position) clip_position: vec4f,
  @location(0) uv: vec2f,
  @location(1) @interpolate(flat) velocity: vec2f,
};

@group(0) @binding(0) var<uniform> aspect_ratio: f32;
@group(1) @binding(0) var<storage, read> particles: array<Particle>;

const GRID = array<vec2f, 6>(
  vec2f(-1.0, -1.0),
  vec2f( 1.0, -1.0),
  vec2f( 1.0,  1.0),
  vec2f(-1.0, -1.0),
  vec2f( 1.0,  1.0),
  vec2f(-1.0,  1.0)
);

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;

  let particle = particles[in.instance_index];
  let quad_pos = GRID[in.vertex_index];
  let final_pos = (particle.pos.xy + quad_pos * PARTICLE_RADIUS) * vec2f(1.0 / aspect_ratio, 1.0);

  out.clip_position = vec4f(final_pos, 0.0, 1.0);
  out.uv = quad_pos;
  out.velocity = particle.velocity;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  // 1. 裁剪圆形: 如果距中心 > 1.0，则丢弃
  let r_sq = dot(in.uv, in.uv);
  if (r_sq > 1.0) {
    discard;
  }

  // 2. 计算法线 (Impostor Sphere Trick):
  // 既然我们是在画一个球，Z 轴应该从中心凸起。
  // x^2 + y^2 + z^2 = 1 => z = sqrt(1 - x^2 - y^2)
  let z = sqrt(1.0 - r_sq);
  let N = vec3f(in.uv, z); // 法线方向

  // 3. 简单的光照模型
  let light_dir = normalize(vec3f(0.5, 0.5, 1.0)); // 只有方向的平行光
  let diff = max(dot(N, light_dir), 0.0);
  
  // 高光 (Specular) - Blinn-Phong
  let view_dir = vec3f(0.0, 0.0, 1.0);
  let half_dir = normalize(light_dir + view_dir);
  let spec = pow(max(dot(N, half_dir), 0.0), 32.0);

  // 4. 基于速度的颜色映射
  // 速度越快颜色越热 (Blue -> Red)
  let speed = length(in.velocity);
  let max_speed = 5.0; // 假设的最大速度，根据模拟调整
  let t = clamp(speed / max_speed, 0.0, 1.0);
  
  // 简单的冷暖色调插值
  let color_slow = vec3f(0.2, 0.6, 1.0); // 蓝色
  let color_fast = vec3f(1.0, 0.3, 0.2); // 红色
  let base_color = mix(color_slow, color_fast, t);

  // 5. 组合光照
  let ambient = 0.2;
  let final_color = base_color * (ambient + diff) + vec3f(spec);

  return vec4f(final_color, 1.0);
}
