package output

import (
	"fmt"

	"github.com/fatih/color"
)

// PrintSuccess prints a success message with green color
func PrintSuccess(format string, args ...interface{}) {
	c := color.New(color.FgGreen, color.Bold)
	c.Printf("✓ ")
	fmt.Printf(format+"\n", args...)
}

// PrintError prints an error message with red color
func PrintError(format string, args ...interface{}) {
	c := color.New(color.FgRed, color.Bold)
	c.Printf("✗ ")
	fmt.Printf(format+"\n", args...)
}

// PrintInfo prints an info message with blue color
func PrintInfo(format string, args ...interface{}) {
	c := color.New(color.FgBlue)
	c.Printf("ℹ ")
	fmt.Printf(format+"\n", args...)
}

// PrintWarning prints a warning message with yellow color
func PrintWarning(format string, args ...interface{}) {
	c := color.New(color.FgYellow, color.Bold)
	c.Printf("⚠ ")
	fmt.Printf(format+"\n", args...)
}

// PrintHeader prints a header with cyan color
func PrintHeader(format string, args ...interface{}) {
	c := color.New(color.FgCyan, color.Bold)
	c.Printf("\n=== ")
	fmt.Printf(format, args...)
	c.Printf(" ===\n\n")
}

// PrintTable prints a simple table with headers and rows
func PrintTable(headers []string, rows [][]string) {
	// Print headers
	headerColor := color.New(color.FgWhite, color.Bold, color.Underline)
	for i, h := range headers {
		if i > 0 {
			fmt.Print("\t")
		}
		headerColor.Print(h)
	}
	fmt.Println()

	// Print rows
	for _, row := range rows {
		for i, cell := range row {
			if i > 0 {
				fmt.Print("\t")
			}
			fmt.Print(cell)
		}
		fmt.Println()
	}
}

// PrintServiceStatus prints a service status line
func PrintServiceStatus(name string, status string, url string) {
	nameColor := color.New(color.FgWhite, color.Bold)
	statusColor := color.New(color.FgGreen)
	urlColor := color.New(color.FgCyan)

	if status != "running" {
		statusColor = color.New(color.FgRed)
	}

	nameColor.Printf("  %-15s", name)
	statusColor.Printf("[%-7s]", status)
	if url != "" {
		fmt.Print("  ")
		urlColor.Print(url)
	}
	fmt.Println()
}
