package docker

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/indusbase/cli/internal/output"
)

// Client handles Docker Compose operations
type Client struct {
	ComposeFile string
}

// NewClient creates a new Docker client
func NewClient(composeFile string) *Client {
	if composeFile == "" {
		composeFile = "docker-compose.yml"
	}
	return &Client{ComposeFile: composeFile}
}

// CheckDockerRunning checks if Docker daemon is running
func (c *Client) CheckDockerRunning() error {
	cmd := exec.Command("docker", "info")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("Docker is not running. Please start Docker first")
	}
	return nil
}

// CheckComposeFileExists checks if the compose file exists
func (c *Client) CheckComposeFileExists() error {
	if _, err := os.Stat(c.ComposeFile); os.IsNotExist(err) {
		return fmt.Errorf("%s not found. Run 'indus init' first", c.ComposeFile)
	}
	return nil
}

// PullImages pulls Docker images with progress output
func (c *Client) PullImages() error {
	output.PrintInfo("Pulling Docker images...")
	cmd := exec.Command("docker-compose", "-f", c.ComposeFile, "pull")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// StartServices starts all services with docker-compose up -d
func (c *Client) StartServices() error {
	output.PrintInfo("Starting services...")
	cmd := exec.Command("docker-compose", "-f", c.ComposeFile, "up", "-d")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// StopServices stops all services
func (c *Client) StopServices(volumes bool) error {
	output.PrintInfo("Stopping services...")
	args := []string{"-f", c.ComposeFile, "down"}
	if volumes {
		args = append(args, "-v")
	}
	cmd := exec.Command("docker-compose", args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// GetLogs follows logs for all or specific services
func (c *Client) GetLogs(service string, tail int) error {
	args := []string{"-f", c.ComposeFile, "logs", "-f"}
	if tail > 0 {
		args = append(args, "--tail", fmt.Sprintf("%d", tail))
	}
	if service != "" {
		args = append(args, service)
	}
	cmd := exec.Command("docker-compose", args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// HealthCheck checks if services are healthy
func (c *Client) HealthCheck(ctx context.Context, services []string) error {
	output.PrintInfo("Waiting for services to be healthy...")

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	deadline, ok := ctx.Deadline()
	if !ok {
		deadline = time.Now().Add(2 * time.Minute)
	}

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			if time.Now().After(deadline) {
				return fmt.Errorf("health check timeout")
			}

			allHealthy := true
			for _, service := range services {
				healthy, err := c.isServiceHealthy(service)
				if err != nil || !healthy {
					allHealthy = false
					break
				}
			}

			if allHealthy {
				return nil
			}
		}
	}
}

// isServiceHealthy checks if a specific service is healthy
func (c *Client) isServiceHealthy(service string) (bool, error) {
	cmd := exec.Command("docker-compose", "-f", c.ComposeFile, "ps", "-q", service)
	output, err := cmd.Output()
	if err != nil {
		return false, err
	}

	containerID := strings.TrimSpace(string(output))
	if containerID == "" {
		return false, fmt.Errorf("container not found for service: %s", service)
	}

	// Check container health
	inspectCmd := exec.Command("docker", "inspect", "--format", "{{.State.Health.Status}}", containerID)
	healthOutput, err := inspectCmd.Output()
	if err != nil {
		// If no health check defined, check if running
		runningCmd := exec.Command("docker", "inspect", "--format", "{{.State.Status}}", containerID)
		runningOutput, err := runningCmd.Output()
		if err != nil {
			return false, err
		}
		return strings.TrimSpace(string(runningOutput)) == "running", nil
	}

	return strings.TrimSpace(string(healthOutput)) == "healthy", nil
}

// GetServiceURLs returns the URLs for running services
func (c *Client) GetServiceURLs() (map[string]string, error) {
	urls := make(map[string]string)

	cmd := exec.Command("docker-compose", "-f", c.ComposeFile, "ps", "--format", "{{.Name}}|{{.Ports}}")
	output, err := cmd.Output()
	if err != nil {
		return urls, err
	}

	scanner := bufio.NewScanner(strings.NewReader(string(output)))
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.Split(line, "|")
		if len(parts) >= 2 {
			serviceName := parts[0]
			ports := parts[1]
			// Extract port mappings
			if strings.Contains(ports, "->") {
				// Parse port mapping like "0.0.0.0:3000->3000/tcp"
				urls[serviceName] = extractURL(ports)
			}
		}
	}

	return urls, nil
}

// extractURL extracts a URL from port mappings
func extractURL(ports string) string {
	// Simple extraction - look for localhost port
	if idx := strings.Index(ports, "0.0.0.0:"); idx != -1 {
		endIdx := strings.Index(ports[idx:], "->")
		if endIdx != -1 {
			port := ports[idx+8 : idx+endIdx]
			return fmt.Sprintf("http://localhost:%s", port)
		}
	}
	return ""
}

// Exec runs a command in a container
func (c *Client) Exec(service string, command []string) error {
	args := append([]string{"-f", c.ComposeFile, "exec", service}, command...)
	cmd := exec.Command("docker-compose", args...)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// ListServices returns a list of service names from the compose file
func (c *Client) ListServices() ([]string, error) {
	cmd := exec.Command("docker-compose", "-f", c.ComposeFile, "config", "--services")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var services []string
	scanner := bufio.NewScanner(strings.NewReader(string(output)))
	for scanner.Scan() {
		services = append(services, strings.TrimSpace(scanner.Text()))
	}

	return services, nil
}
