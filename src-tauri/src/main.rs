#![cfg_attr(
  all(not(debug_assertions), not(feature = "custom-protocol")),
  windows_subsystem = "windows"
)]

fn main() {
  codebridge_lib::run()
}