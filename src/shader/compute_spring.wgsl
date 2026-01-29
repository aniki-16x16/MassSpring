@import './shared/types.wgsl';
@import './shared/compute_constants.wgsl';

@group(0) @binding(0) var<storage, read_write> springs: array<Spring>;
@group(0) @binding(1) var<storage, read> particles: array<Particle>;
@group(0) @binding(2) var<storage, read_write> forces: array<atomic<i32>>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id : vec3u) {
  let index = global_id.x;

  if (index >= arrayLength(&springs)) {
    return;
  }

  let spring = springs[index];
  
  // [Optimization] 1. 快速剔除: 如果弹簧已断裂，直接跳过昂贵的数学计算
  if (spring.is_broken > 0.0) {
      return;
  }

  let pos_a = particles[spring.a].pos.xy;
  let pos_b = particles[spring.b].pos.xy;

  let delta = pos_b - pos_a;
  if (length(delta) > spring.breaking_threshold) {
    springs[index].is_broken = 1.0;
    return;
  }
  let direction = normalize(delta);
  let displacement = length(delta) - spring.rest_length;
  let force = spring.stiffness * displacement * direction;

  atomicAdd(&forces[spring.a * 2], i32(force.x * FORCE_SCALE));
  atomicAdd(&forces[spring.a * 2 + 1], i32(force.y * FORCE_SCALE));
  atomicAdd(&forces[spring.b * 2], i32(-force.x * FORCE_SCALE));
  atomicAdd(&forces[spring.b * 2 + 1], i32(-force.y * FORCE_SCALE));
}
