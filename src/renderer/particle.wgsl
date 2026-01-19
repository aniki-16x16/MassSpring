struct VertexInput {
  @location(0) particle_pos: vec4f,
  @builtin(vertex_index) vertex_index: u32,
};

struct VertexOutput {
  @builtin(position) clip_position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var<uniform> aspect_ratio: f32;

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;

  var pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f( 1.0, -1.0),
    vec2f( 1.0,  1.0),
    vec2f(-1.0, -1.0),
    vec2f( 1.0,  1.0),
    vec2f(-1.0,  1.0)
  );

  let quad_pos = pos[in.vertex_index];
  let particle_radius = 0.01;

  let final_pos = (in.particle_pos.xy + quad_pos * particle_radius) * vec2f(aspect_ratio, 1.0);

  out.clip_position = vec4f(final_pos, 0.0, 1.0);
  out.uv = quad_pos;

  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  let dist = length(in.uv);
  return vec4f(vec3f(1.0), smoothstep(1.0, 0.98, dist));
}
