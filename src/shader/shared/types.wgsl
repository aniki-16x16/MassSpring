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
  is_broken: f32,
  breaking_threshold: f32,
  padding: vec2f,
}

struct Mouse {
  pos: vec2f,
  is_pressed: u32,
  padding: f32,
};

struct Shape {
  params: vec4f,
  pos: vec2f,
  rotation: f32,
  shape_type: u32,
}
