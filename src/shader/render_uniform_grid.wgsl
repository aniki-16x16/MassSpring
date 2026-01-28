@import './shared/compute_constants.wgsl';

struct VertexInput {
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32,
};

struct VertexOutput {
  @builtin(position) clip_position: vec4f,
};

@group(0) @binding(0) var<uniform> aspect_ratio: f32;
@group(1) @binding(0) var<storage, read> uniform_grid: array<i32>;

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

  if (uniform_grid[in.instance_index] == -1) {
    out.clip_position = vec4f(0.0);
    return out;
  }

  let quad_pos = GRID[in.vertex_index];
  let cell = vec2i(
    i32(in.instance_index) % COLUMN_NUM,
    i32(in.instance_index) / COLUMN_NUM
  );
  let cell_center = vec2f(
    (f32(cell.x) + 0.5) * CELL_SIZE - BOX_BOUNDARY.x,
    (f32(cell.y) + 0.5) * CELL_SIZE - BOX_BOUNDARY.y
  );
  let final_pos = (cell_center + quad_pos * (CELL_SIZE * 0.5)) * vec2f(1.0 / aspect_ratio, 1.0);
  out.clip_position = vec4f(final_pos, 0.0, 1.0);
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  return vec4f(0.0, 1.0, 0.0, 0.2);
}
