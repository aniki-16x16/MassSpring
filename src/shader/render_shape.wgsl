@import './shared/types.wgsl';
@import './shared/math.wgsl';

struct VertexInput {
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32,
};

struct VertexOutput {
  @builtin(position) clip_position: vec4f,
  @location(0) uv: vec2f,
  @location(1) @interpolate(flat) shape_type: u32,
};

@group(0) @binding(0) var<uniform> aspect_ratio: f32;
@group(1) @binding(0) var<storage, read> shapes: array<Shape>;

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

  let shape = shapes[in.instance_index];
  let size = get_shape_size(shape);

  let quad_pos = GRID[in.vertex_index];
  let rotated_pos = rotate(quad_pos * size, shape.rotation);
  let final_pos = (shape.pos + rotated_pos) * vec2f(1.0 / aspect_ratio, 1.0);

  out.clip_position = vec4f(final_pos, 0.0, 1.0);
  out.uv = quad_pos;
  out.shape_type = shape.shape_type;
  return out;
}

fn get_shape_size(shape: Shape) -> vec2f {
  switch (shape.shape_type) {
    case 0u: { // Circle
      return vec2f(shape.params.x, shape.params.x);
    }
    case 1u: { // Rectangle
      return vec2f(shape.params.x, shape.params.y);
    }
    default: {
      return vec2f(0.0, 0.0);
    }
  }
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  return vec4f(vec3f(1.0), get_shape_mask(in));
}

fn get_shape_mask(in: VertexOutput) -> f32 {
  switch (in.shape_type) {
    case 0u: { // Circle
      let dist = length(in.uv);
      return smoothstep(1.0, 0.99, dist);
    }
    case 1u: { // Rectangle
      return 1.0;
    }
    default: {
      return 0.0;
    }
  }
}
