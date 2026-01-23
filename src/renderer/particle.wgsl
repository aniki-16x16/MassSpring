struct Particle {
  pos: vec4f,
  velocity: vec2f,
  mass: f32,
  is_static: u32,
}

struct VertexInput {
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32,
};

struct VertexOutput {
  @builtin(position) clip_position: vec4f,
  @location(0) uv: vec2f,
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
const RADIUS = 0.01;

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;

  let particle = particles[in.instance_index];
  let quad_pos = GRID[in.vertex_index];
  let final_pos = (particle.pos.xy + quad_pos * RADIUS) * vec2f(1.0 / aspect_ratio, 1.0);

  out.clip_position = vec4f(final_pos, 0.0, 1.0);
  out.uv = quad_pos;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  let dist = length(in.uv);
  return vec4f(vec3f(1.0), smoothstep(1.0, 0.99, dist));
}
