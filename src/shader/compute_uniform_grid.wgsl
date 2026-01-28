@import './shared/types.wgsl';
@import './shared/compute_constants.wgsl';
@import './shared/grid_utils.wgsl';

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<storage, read_write> grid: array<atomic<i32>>;
@group(0) @binding(2) var<storage, read_write> particle_next: array<i32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id : vec3u) {
  let index = global_id.x;

  if (index >= arrayLength(&particles)) {
    return;
  }

  let cell = get_my_cell(particles[index].pos.xy);
  let grid_index = cell.y * COLUMN_NUM + cell.x;

  particle_next[index] = atomicExchange(&grid[grid_index], i32(index));
}
