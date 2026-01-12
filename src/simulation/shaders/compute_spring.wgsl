struct Particle {
  pos: vec4f,
  velocity: vec2f,
  mass: f32,
}

struct Spring {
  a: u32,
  b: u32,
  rest_length: f32,
  stiffness: f32,
}

@group(0) @binding(0) var<storage, read_write> data: array<Particle>;
@group(0) @binding(1) var<storage, read_write> forces: array<vec2f>;
@group(0) @binding(2) var<storage, read> springs: array<Spring>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id : vec3u) {
  let index = global_id.x;

  if (index >= arrayLength(&springs)) {
    return;
  }

  let spring = springs[index];
  let posA = data[spring.a].pos.xy;
  let posB = data[spring.b].pos.xy;

  let delta = posB - posA;
  let current_length = length(delta);
  let direction = normalize(delta);

  let displacement = current_length - spring.rest_length;
  let force_magnitude = spring.stiffness * displacement;

  let force = force_magnitude * direction;

  forces[spring.a] += force;
  forces[spring.b] -= force;
}
