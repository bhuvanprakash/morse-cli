const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // Main executable
    const exe = b.addExecutable(.{
        .name = "indus-gate",
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });

    b.installArtifact(exe);

    // Run command
    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());

    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run the API Gateway");
    run_step.dependOn(&run_cmd.step);

    // Unit tests
    const unit_tests = b.addTest(.{
        .root_source_file = b.path("src/root.zig"),
        .target = target,
        .optimize = optimize,
    });

    const run_unit_tests = b.addRunArtifact(unit_tests);
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_unit_tests.step);

    // Integration tests
    const proxy_tests = b.addTest(.{
        .root_source_file = b.path("tests/proxy_test.zig"),
        .target = target,
        .optimize = optimize,
    });

    const ratelimit_tests = b.addTest(.{
        .root_source_file = b.path("tests/ratelimit_test.zig"),
        .target = target,
        .optimize = optimize,
    });

    const auth_tests = b.addTest(.{
        .root_source_file = b.path("tests/auth_test.zig"),
        .target = target,
        .optimize = optimize,
    });

    const run_proxy_tests = b.addRunArtifact(proxy_tests);
    const run_ratelimit_tests = b.addRunArtifact(ratelimit_tests);
    const run_auth_tests = b.addRunArtifact(auth_tests);

    const integration_test_step = b.step("test-integration", "Run integration tests");
    integration_test_step.dependOn(&run_proxy_tests.step);
    integration_test_step.dependOn(&run_ratelimit_tests.step);
    integration_test_step.dependOn(&run_auth_tests.step);

    // Lint step (using zig fmt --check)
    const lint_step = b.step("lint", "Check code formatting");
    const fmt_check = b.addFmt(.{
        .paths = &.{ "src", "tests" },
        .check = true,
    });
    lint_step.dependOn(&fmt_check.step);

    // Format step
    const fmt_step = b.step("fmt", "Format code");
    const fmt = b.addFmt(.{
        .paths = &.{ "src", "tests" },
    });
    fmt_step.dependOn(&fmt.step);
}
