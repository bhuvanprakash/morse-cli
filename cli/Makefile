.PHONY: build install clean test fmt lint

BINARY_NAME=indus
BUILD_DIR=build
GO=go
GOFLAGS=-ldflags="-s -w"

build:
	@echo "Building $(BINARY_NAME)..."
	@mkdir -p $(BUILD_DIR)
	$(GO) build $(GOFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME) .

install: build
	@echo "Installing $(BINARY_NAME) to /usr/local/bin..."
	@cp $(BUILD_DIR)/$(BINARY_NAME) /usr/local/bin/$(BINARY_NAME)
	@echo "Installation complete!"

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf $(BUILD_DIR)
	@go clean

test:
	@echo "Running tests..."
	$(GO) test -v ./...

fmt:
	@echo "Formatting code..."
	$(GO) fmt ./...

lint:
	@echo "Running linter..."
	@golangci-lint run ./...

dev:
	@echo "Building for development..."
	$(GO) build -o $(BUILD_DIR)/$(BINARY_NAME) .

.DEFAULT_GOAL := build