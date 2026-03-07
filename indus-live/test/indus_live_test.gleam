import gleeunit
import gleeunit/should

pub fn main() {
  gleeunit.main()
}

// Basic sanity check
pub fn hello_test() {
  1 + 1
  |> should.equal(2)
}
