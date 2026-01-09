@group(0) @binding(0) var<storage, read_write> data: array<vec4f>;

const speed = 0.001;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id : vec3u) {
  let index = global_id.x;

  if (index >= arrayLength(&data)) {
    return;
  }

  data[index].x += speed;
}
