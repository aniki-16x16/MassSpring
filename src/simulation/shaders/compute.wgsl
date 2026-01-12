struct Particle {
  pos: vec4f,
  velocity: vec2f,
  mass: f32,
}

@group(0) @binding(0) var<storage, read_write> data: array<Particle>;
@group(0) @binding(1) var<storage, read_write> forces: array<vec2f>;

const deltaTime = 0.01;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id : vec3u) {
  let index = global_id.x;

  if (index >= arrayLength(&data)) {
    return;
  }

  var pos = data[index].pos;
  var vel = data[index].velocity;
  let mass = data[index].mass;
  let force = computeForce(index);
  let acceleration = force / mass;

  vel += acceleration * deltaTime;
  pos.x += vel.x * deltaTime;
  pos.y += vel.y * deltaTime;
  if (pos.y < -1.0) {
    pos.y = -1.0;
    vel.y = -vel.y * 0.8;
  }
  if (abs(pos.x) > 1.0) {
    pos.x = clamp(pos.x, -1.0, 1.0);
    vel.x = -vel.x * 0.8;
  }
  data[index].pos = pos;
  data[index].velocity = vel;
}

fn computeForce(index: u32) -> vec2f {
  let force = forces[index];
  forces[index] = vec2f(0.0, 0.0);
  return force + vec2f(0.0, -9.8);
}
