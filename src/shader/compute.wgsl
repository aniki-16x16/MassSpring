@import './shared/types.wgsl';
@import './shared/math.wgsl';

@group(0) @binding(0) var<storage, read_write> springs: array<Spring>;
@group(0) @binding(1) var<storage, read> obstacles: array<Shape>;

@group(1) @binding(0) var<storage, read_write> data: array<Particle>;
@group(1) @binding(1) var<storage, read_write> forces: array<atomic<i32>>;
@group(1) @binding(2) var<uniform> mouse: Mouse;

const DELTA_TIME = 0.008;
const FORCE_SCALE = 1000.0;

const MOUSE_THRESHOLD = 0.05;
const MOUSE_FORCE = 100.0;
const DAMPING_GLOBAL = 0.995;
const RADIUS = 0.01;

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
  if (data[index].is_static == 1u) {
    return;
  }
  let acceleration = force / mass;

  vel += acceleration * DELTA_TIME;
  vel *= DAMPING_GLOBAL;

  pos.x += vel.x * DELTA_TIME;
  pos.y += vel.y * DELTA_TIME;
  if (pos.y < -1.0) {
    pos.y = -1.0;
    vel.y = -vel.y * 0.9;
  }
  if (abs(pos.x) > 2.0) {
    pos.x = clamp(pos.x, -2.0, 2.0);
    vel.x = -vel.x * 0.9;
  }
  let corrected = solve_obstacle_collision(pos.xy, vel);
  pos.x = corrected.x;
  pos.y = corrected.y;
  vel = corrected.zw;
  data[index].pos = pos;
  data[index].velocity = vel;
}

fn compute_force(index: u32) -> vec2f {
  var f_x = atomicLoad(&forces[index * 2]);
  var f_y = atomicLoad(&forces[index * 2 + 1]);
  atomicStore(&forces[index * 2], 0);
  atomicStore(&forces[index * 2 + 1], 0);
  return vec2f(f32(f_x) / FORCE_SCALE, f32(f_y) / FORCE_SCALE) + vec2f(0.0, -9.8);
}

fn compute_mouse_force(pos: vec2f) -> vec2f {
  let dir = normalize(pos - mouse.pos.xy);
  let dist = distance(pos, mouse.pos.xy);
  let force = select(vec2f(0.0, 0.0), dir * MOUSE_FORCE, dist < MOUSE_THRESHOLD);
  let flip = select(1.0, -1.0, mouse.is_pressed == 1u);
  return force * flip;
}

@compute @workgroup_size(64)
fn spring_main(@builtin(global_invocation_id) global_id : vec3u) {
  let index = global_id.x;

  if (index >= arrayLength(&springs)) {
    return;
  }

  let spring = springs[index];
  let pos_a = data[spring.a].pos.xy;
  let pos_b = data[spring.b].pos.xy;

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

fn solve_obstacle_collision(pos: vec2f, vel: vec2f) -> vec4f {
  var new_pos = pos;
  var new_vel = vel;
  for (var i = 0u; i < arrayLength(&obstacles); i = i + 1u) {
    let shape = obstacles[i];
    let dist = sd_scene(pos, shape) - RADIUS;
    if (dist < 0.0) {
      let normal = get_normal(pos, shape);
      let correction = normal * (-dist) * 1.05;
      new_pos += correction;

      let speed_normal = dot(vel, normal);
      if (speed_normal < 0.0) {
        let vel_normal = speed_normal * normal;
        let vel_tangent = vel - vel_normal;
        new_vel = vel_tangent - vel_normal * 0.9;
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
