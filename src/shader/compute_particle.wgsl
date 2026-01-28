@import './shared/types.wgsl';
@import './shared/compute_constants.wgsl';
@import './shared/math.wgsl';
@import './shared/grid_utils.wgsl';

@group(0) @binding(0) var<uniform> mouse: Mouse;

@group(1) @binding(0) var<storage, read_write> data: array<Particle>;
@group(1) @binding(1) var<storage, read_write> forces: array<i32>;
@group(1) @binding(2) var<storage, read> obstacles: array<Shape>;
@group(1) @binding(3) var<storage, read> uniform_grid: array<i32>;
@group(1) @binding(4) var<storage, read> particle_next: array<i32>;

const DELTA_TIME = 0.003;

const MOUSE_THRESHOLD = 0.05;
const MOUSE_FORCE = 100.0;
const DAMPING_GLOBAL = 0.995;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id : vec3u) {
  let index = global_id.x;

  if (index >= arrayLength(&data)) {
    return;
  }

  var pos = data[index].pos;
  var vel = data[index].velocity;
  let mass = data[index].mass;
  var force = compute_force(index);
  force += compute_mouse_force(pos.xy);
  force += compute_particle_collision(index);
  if (data[index].is_static == 1u) {
    return;
  }
  let acceleration = force / mass;

  vel += acceleration * DELTA_TIME;
  vel *= DAMPING_GLOBAL;

  pos.x += vel.x * DELTA_TIME;
  pos.y += vel.y * DELTA_TIME;
  if (pos.y < -BOX_BOUNDARY.y) {
    pos.y = -BOX_BOUNDARY.y;
    vel.y = -vel.y * 0.95;
  }
  if (abs(pos.x) > BOX_BOUNDARY.x) {
    pos.x = clamp(pos.x, -BOX_BOUNDARY.x, BOX_BOUNDARY.x);
    vel.x = -vel.x * 0.95;
  }
  let corrected = solve_obstacle_collision(pos.xy, vel);
  pos.x = corrected.x;
  pos.y = corrected.y;
  vel = corrected.zw;
  data[index].pos = pos;
  data[index].velocity = vel;
}

fn compute_force(index: u32) -> vec2f {
  var f_x = forces[index * 2];
  var f_y = forces[index * 2 + 1];
  forces[index * 2] = 0;
  forces[index * 2 + 1] = 0;
  return vec2f(f32(f_x) / FORCE_SCALE, f32(f_y) / FORCE_SCALE) + vec2f(0.0, -9.8);
}

fn compute_mouse_force(pos: vec2f) -> vec2f {
  let dir = normalize(pos - mouse.pos.xy);
  let dist = distance(pos, mouse.pos.xy);
  let force = select(vec2f(0.0, 0.0), dir * MOUSE_FORCE, dist < MOUSE_THRESHOLD);
  let flip = select(1.0, -1.0, mouse.is_pressed == 1u);
  return force * flip;
}

fn compute_particle_collision(index: u32) -> vec2f {
  var total_push = vec2f(0.0);
  let my_pos = data[index].pos.xy;

  for (var dy = -1; dy <= 1; dy = dy + 1) {
    for (var dx = -1; dx <= 1; dx = dx + 1) {
      let neighbor_index = get_neighbor_index(get_my_cell(my_pos), vec2i(dx, dy));
      if (neighbor_index == -1) {
        continue;
      }
      var other_idx = uniform_grid[neighbor_index];
      var loopCount = 0;
      while (other_idx != -1) {
        let other_idx_u = u32(other_idx);
        if (other_idx_u != index) {
          let other_pos = data[other_idx_u].pos.xy;
          let delta = my_pos - other_pos;
          let dist = length(delta);
          if (dist < PARTICLE_RADIUS * 2.0) {
            let push_dir = normalize(delta);
            let push_mag = (PARTICLE_RADIUS * 2.0 - dist) * 5000.0;
            total_push += push_dir * push_mag;
          }
        }
        other_idx = particle_next[other_idx_u];
        loopCount = loopCount + 1;
        if (loopCount > 1000) {
          break;
        }
      }
    }
  }

  return total_push;
}

fn get_neighbor_index(my_cell: vec2i, offset: vec2i) -> i32 {
  let neighbor_x = my_cell.x + offset.x;
  let neighbor_y = my_cell.y + offset.y;
  if (neighbor_x < 0 || neighbor_x >= COLUMN_NUM || neighbor_y < 0 || neighbor_y >= ROW_NUM) {
    return -1;
  }
  return neighbor_y * COLUMN_NUM + neighbor_x;
}

fn solve_obstacle_collision(pos: vec2f, vel: vec2f) -> vec4f {
  var new_pos = pos;
  var new_vel = vel;
  for (var i = 0u; i < arrayLength(&obstacles); i = i + 1u) {
    let shape = obstacles[i];
    let dist = sd_scene(pos, shape) - PARTICLE_RADIUS;
    if (dist < 0.0) {
      let normal = get_normal(pos, shape);
      let correction = normal * (-dist) * 1.05;
      new_pos += correction;

      let speed_normal = dot(vel, normal);
      if (speed_normal < 0.0) {
        let vel_normal = speed_normal * normal;
        let vel_tangent = vel - vel_normal;
        new_vel = vel_tangent - vel_normal * 0.95;
      }
    }
  }
  return vec4f(new_pos, new_vel);
}

// SDF 默认质心在原点
fn get_normal(p: vec2f, shape: Shape) -> vec2f {
  let eps = 0.001;
  let dx = sd_scene(p + vec2f(eps, 0.0), shape) - sd_scene(p - vec2f(eps, 0.0), shape);
  let dy = sd_scene(p + vec2f(0.0, eps), shape) - sd_scene(p - vec2f(0.0, eps), shape);
  return normalize(vec2f(dx, dy));
}
fn sd_scene(p: vec2f, shape: Shape) -> f32 {
  let local_p = rotate(p - shape.pos, -shape.rotation);
  switch (shape.shape_type) {
    case 0u: {
      return sd_circle(local_p, shape.params.x);
    }
    case 1u: {
      return sd_box(local_p, shape.params.xy);
    }
    default: {
      return 10000.0;
    }
  }
}
fn sd_circle(p: vec2f, r: f32) -> f32 {
  return length(p) - r;
}
fn sd_box(p: vec2f, b: vec2f) -> f32 {
  let d = abs(p) - b;
  return length(max(d, vec2f(0.0, 0.0))) + min(max(d.x, d.y), 0.0);
}
