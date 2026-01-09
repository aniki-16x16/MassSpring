// 目标: 将质点位置数据可视化为点云
struct VertexInput {
  @location(0) position: vec4f,
};

struct VertexOutput {
  @builtin(position) clip_position: vec4f,
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.clip_position = in.position;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  return vec4f(1.0, 1.0, 1.0, 1.0);
}
