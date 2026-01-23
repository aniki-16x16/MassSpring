@import './shared/types.wgsl';

struct VertexInput {
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32,
};

struct VertexOutput {
  @builtin(position) clip_position: vec4f,
  @location(0) @interpolate(flat) factor: f32,
};

@group(0) @binding(0) var<uniform> aspect_ratio: f32;
@group(1) @binding(0) var<storage, read> springs: array<Spring>;
@group(1) @binding(1) var<storage, read> particles: array<Particle>;

const COLOR_THRESHOLD = 3.0;
const GRID = array<vec2f, 6>(
  vec2f(0.0, 1.0),
  vec2f(0.0, -1.0),
  vec2f(1.0, -1.0),
  vec2f(0.0, 1.0),
  vec2f(1.0, -1.0),
  vec2f(1.0, 1.0),
);
const RADIUS = 0.005;

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;

  let spring = springs[in.instance_index];
  let pos_a = particles[spring.a].pos.xy;
  let pos_b = particles[spring.b].pos.xy;

  let spring_len = length(pos_b - pos_a);
  let spring_dir = normalize(pos_b - pos_a);
  let spring_perp = vec2f(spring_dir.y, -spring_dir.x);

  let quad_pos = GRID[in.vertex_index];
  let final_pos = (select(pos_a, pos_b, quad_pos.x > 0.0) + quad_pos.y * spring_perp * RADIUS) * vec2f(1.0 / aspect_ratio, 1.0);

  out.clip_position = vec4f(final_pos, 0.0, 1.0);
  out.factor = max(spring_len / spring.rest_length, spring.rest_length / spring_len);
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  return mix(
    vec4f(0.1, 0.1, 0.8, 1.0),
    vec4f(0.8, 0.1, 0.1, 1.0),
    (min(in.factor, COLOR_THRESHOLD) - 1.0) / (COLOR_THRESHOLD - 1.0),
  );
}
