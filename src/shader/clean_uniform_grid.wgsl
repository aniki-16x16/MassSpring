@import './shared/types.wgsl';

@group(0) @binding(0) var<storage, read_write> grid: array<i32>;
@group(0) @binding(1) var<storage, read_write> particle_next: array<i32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id : vec3u) {
  let index = global_id.x;

  if (index < arrayLength(&grid)) {
    grid[index] = -1;
  }
  if (index < arrayLength(&particle_next)) {
    particle_next[index] = -1;
  }
}
