package spinner

import (
	"fmt"
	"time"

	"github.com/briandowns/spinner"
)

// Spinner wraps the spinner library for CLI operations
type Spinner struct {
	s *spinner.Spinner
}

// New creates a new spinner with the given message
func New(message string) *Spinner {
	s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
	s.Suffix = " " + message
	s.Color("cyan")
	return &Spinner{s: s}
}

// Start starts the spinner
func (s *Spinner) Start() {
	s.s.Start()
}

// Stop stops the spinner
func (s *Spinner) Stop() {
	s.s.Stop()
}

// Success stops the spinner with a success message
func (s *Spinner) Success(message string) {
	s.s.Stop()
	fmt.Printf("✓ %s\n", message)
}

// Error stops the spinner with an error message
func (s *Spinner) Error(message string) {
	s.s.Stop()
	fmt.Printf("✗ %s\n", message)
}

// UpdateMessage updates the spinner message
func (s *Spinner) UpdateMessage(message string) {
	s.s.Suffix = " " + message
}
