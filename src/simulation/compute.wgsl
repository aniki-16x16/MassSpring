struct Particle {
  pos: vec4f,
  velocity: vec2f,
  mass: f32,
  is_static: u32,
}

struct Spring {
  a: u32,
  b: u32,
  rest_length: f32,
  stiffness: f32,
}

struct Mouse {
  pos: vec2f,
  is_pressed: u32,
  padding: f32,
};

@group(0) @binding(0) var<storage, read> springs: array<Spring>;

@group(1) @binding(0) var<storage, read_write> data: array<Particle>;
@group(1) @binding(1) var<storage, read_write> forces: array<vec2f>;
@group(1) @binding(2) var<uniform> mouse: Mouse;

const DELTA_TIME = 0.008;

const MOUSE_THRESHOLD = 0.1;
const MOUSE_FORCE = 100.0;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id : vec3u) {
  let index = global_id.x;

  if (index >= arrayLength(&data)) {
    return;
  }

  var pos = data[index].pos;
  var vel = data[index].velocity;
  let mass = data[index].mass;
  var force = computeForce(index);
  force += computeMouseForce(pos.xy);
  if (data[index].is_static == 1u) {
    return;
  }
  let acceleration = force / mass;

  vel += acceleration * DELTA_TIME;
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
  data[index].pos = pos;
  data[index].velocity = vel;
}

fn computeForce(index: u32) -> vec2f {
  let force = forces[index];
  forces[index] = vec2f(0.0, 0.0);
  return force + vec2f(0.0, -9.8);
}

fn computeMouseForce(pos: vec2f) -> vec2f {
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
  let direction = normalize(delta);

  let displacement = length(delta) - spring.rest_length;

  let force = spring.stiffness * displacement * direction;

  forces[spring.a] += force;
  forces[spring.b] -= force;
}
