struct Particle {
  pos: vec4f,
  velocity: vec2f,
  mass: f32,
  padding: f32,
}

struct VertexInput {
  @location(0) spring: vec2u,
  @builtin(vertex_index) vertex_index: u32,
};

struct VertexOutput {
  @builtin(position) clip_position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var<uniform> aspect_ratio: f32;
@group(1) @binding(0) var<storage, read> particles: array<Particle>;

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;

  let pos_a = particles[in.spring.x].pos.xy;
  let pos_b = particles[in.spring.y].pos.xy;

  let spring_dir = normalize(pos_b - pos_a);
  let spring_perp = vec2f(spring_dir.y, -spring_dir.x);

  let radius = 0.005;
  let pos = array<vec2f, 6>(
    vec2f(0.0, 1.0),
    vec2f(0.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(0.0, 1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, 1.0),
  );
  let quad_pos = pos[in.vertex_index];
  let final_pos = (mix(pos_a, pos_b, quad_pos.x) + quad_pos.y * spring_perp * radius) * vec2f(aspect_ratio, 1.0);

  out.clip_position = vec4f(final_pos, 0.0, 1.0);
  out.uv = quad_pos;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  return vec4f(0.2, 0.2, 0.6, 1.0);
}
