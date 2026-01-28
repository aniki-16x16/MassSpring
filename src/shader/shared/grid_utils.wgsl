fn get_my_cell(p: vec2f) -> vec2i {
  let new_p = p + vec2f(BOX_BOUNDARY.x, BOX_BOUNDARY.y);
  let grid_x = i32(new_p.x / CELL_SIZE);
  let grid_y = i32(new_p.y / CELL_SIZE);
  return vec2i(grid_x, grid_y);
}
