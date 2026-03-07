const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // Get httpz dependency
    const httpz = b.dependency("httpz", .{
        .target = target,
        .optimize = optimize,
    });

    // Main executable
    const exe = b.addExecutable(.{
        .name = "indus-edge",
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });

    exe.root_module.addImport("httpz", httpz.module("httpz"));
    b.installArtifact(exe);

    // Run command
    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());

    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run the app");
    run_step.dependOn(&run_cmd.step);

    // Worker tests
    const worker_unit_tests = b.addTest(.{
        .root_source_file = b.path("tests/worker_test.zig"),
        .target = target,
        .optimize = optimize,
    });

    const run_worker_unit_tests = b.addRunArtifact(worker_unit_tests);

    // Pool tests
    const pool_unit_tests = b.addTest(.{
        .root_source_file = b.path("tests/pool_test.zig"),
        .target = target,
        .optimize = optimize,
    });

    const run_pool_unit_tests = b.addRunArtifact(pool_unit_tests);

    // Test step
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_worker_unit_tests.step);
    test_step.dependOn(&run_pool_unit_tests.step);

    // Format step
    const fmt_step = b.step("fmt", "Format all source files");
    const fmt = b.addFmt(.{
        .paths = &.{ "src/", "tests/" },
    });
    fmt_step.dependOn(&fmt.step);
}