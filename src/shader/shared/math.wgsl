fn rotate(p: vec2f, angle: f32) -> vec2f {
  let c = cos(angle);
  let s = sin(angle);
  return vec2f(
    p.x * c - p.y * s,
    p.x * s + p.y * c
  );
}
