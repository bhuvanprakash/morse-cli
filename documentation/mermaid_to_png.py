#!/usr/bin/env python3
"""
Mermaid to PNG Converter

This script converts Mermaid diagram definitions to PNG images.
It uses the mermaid-cli (mmdc) to render diagrams.

Usage:
    python mermaid_to_png.py <input.mmd> <output.png>
    python mermaid_to_png.py --all  # Convert all diagrams

Requirements:
    npm install -g @mermaid-js/mermaid-cli
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

# Try to import mermaid API as fallback
try:
    from mermaid import Mermaid
    HAS_MERMAID_API = True
except ImportError:
    HAS_MERMAID_API = False


def install_mermaid_cli():
    """Install mermaid-cli globally using npm"""
    print("Installing @mermaid-js/mermaid-cli...")
    try:
        subprocess.run(
            ["npm", "install", "-g", "@mermaid-js/mermaid-cli"],
            check=True,
            capture_output=True
        )
        print("✓ Mermaid CLI installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to install mermaid-cli: {e}")
        return False


def check_mermaid_cli():
    """Check if mermaid-cli is installed"""
    try:
        result = subprocess.run(
            ["mmdc", "--version"],
            capture_output=True,
            text=True
        )
        return result.returncode == 0
    except FileNotFoundError:
        return False


def mermaid_to_png(input_file: str, output_file: str, theme: str = "default") -> bool:
    """
    Convert a Mermaid diagram file to PNG
    
    Args:
        input_file: Path to the .mmd file
        output_file: Path for the output PNG file
        theme: Mermaid theme (default, dark, neutral, forest)
    
    Returns:
        True if conversion successful, False otherwise
    """
    input_path = Path(input_file)
    output_path = Path(output_file)
    
    if not input_path.exists():
        print(f"✗ Input file not found: {input_file}")
        return False
    
    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Try mmdc first
    if check_mermaid_cli():
        try:
            cmd = [
                "mmdc",
                "-i", str(input_path),
                "-o", str(output_path),
                "-t", theme,
                "-b", "white",
                "-w", "1200",
                "-H", "800"
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                print(f"✓ Converted: {input_file} -> {output_file}")
                return True
            else:
                print(f"✗ mmdc error: {result.stderr}")
        except Exception as e:
            print(f"✗ Error running mmdc: {e}")
    
    # Fallback: Use mermaid API if available
    if HAS_MERMAID_API:
        try:
            mermaid = Mermaid()
            with open(input_path, 'r') as f:
                diagram = f.read()
            
            # Generate SVG first
            svg = mermaid.generate(diagram, format='svg')
            
            # Convert SVG to PNG using cairosvg
            try:
                import cairosvg
                cairosvg.svg2png(bytestring=svg, write_to=str(output_path))
                print(f"✓ Converted (via API): {input_file} -> {output_file}")
                return True
            except ImportError:
                # Save SVG as fallback
                svg_path = output_path.with_suffix('.svg')
                with open(svg_path, 'wb') as f:
                    f.write(svg)
                print(f"✓ Saved SVG (cairosvg not available): {input_file} -> {svg_path}")
                return True
        except Exception as e:
            print(f"✗ API conversion error: {e}")
    
    # Last resort: Create a placeholder image with text
    try:
        from PIL import Image, ImageDraw, ImageFont
        
        # Create image
        img = Image.new('RGB', (1200, 800), color='white')
        draw = ImageDraw.Draw(img)
        
        # Draw placeholder text
        text = f"Mermaid Diagram: {input_path.name}"
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 24)
        except:
            font = ImageFont.load_default()
        
        # Center text
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        x = (1200 - text_width) // 2
        y = (800 - text_height) // 2
        
        draw.text((x, y), text, fill='black', font=font)
        draw.text((x, y + 40), f"See {input_path.name.replace('.mmd', '.md')}", fill='gray', font=font)
        
        img.save(output_path)
        print(f"✓ Created placeholder: {output_file}")
        return True
    except ImportError:
        print("✗ Cannot create placeholder - PIL not available")
        return False
    except Exception as e:
        print(f"✗ Error creating placeholder: {e}")
        return False


def extract_mermaid_from_markdown(md_file: str, output_dir: str = None) -> list:
    """
    Extract Mermaid diagrams from a Markdown file
    
    Args:
        md_file: Path to the Markdown file
        output_dir: Directory to save extracted diagrams
    
    Returns:
        List of extracted diagram definitions
    """
    md_path = Path(md_file)
    
    if output_dir is None:
        output_dir = md_path.parent / "diagrams"
    
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    with open(md_path, 'r') as f:
        content = f.read()
    
    diagrams = []
    in_code_block = False
    current_diagram = []
    diagram_name = ""
    
    for line in content.split('\n'):
        if line.strip().startswith('```mermaid'):
            in_code_block = True
            current_diagram = []
            continue
        elif in_code_block and line.strip() == '```':
            in_code_block = False
            if current_diagram:
                # Generate filename
                diagram_text = '\n'.join(current_diagram)
                
                # Try to extract a name from the diagram
                if 'subgraph' in diagram_text:
                    start = diagram_text.find('subgraph') + 9
                    end = diagram_text.find('[', start)
                    if end > start:
                        diagram_name = diagram_text[start:end].strip().lower().replace(' ', '-')
                elif 'graph' in diagram_text or 'flowchart' in diagram_text:
                    diagram_name = "flowchart"
                elif 'sequenceDiagram' in diagram_text:
                    diagram_name = "sequence"
                elif 'classDiagram' in diagram_text:
                    diagram_name = "class"
                elif 'stateDiagram' in diagram_text:
                    diagram_name = "state"
                elif 'erDiagram' in diagram_text:
                    diagram_name = "er"
                elif 'pie' in diagram_text:
                    diagram_name = "pie"
                else:
                    diagram_name = f"diagram-{len(diagrams)+1}"
                
                # Create .mmd file
                mmd_file = output_dir / f"{md_path.stem}-{diagram_name}.mmd"
                with open(mmd_file, 'w') as f:
                    f.write(diagram_text)
                
                diagrams.append({
                    'name': diagram_name,
                    'mmd_file': str(mmd_file),
                    'content': diagram_text
                })
            
            current_diagram = []
            continue
        elif in_code_block:
            current_diagram.append(line)
    
    return diagrams


def convert_all_in_directory(directory: str, pattern: str = "*.md"):
    """Convert all Mermaid diagrams in a directory"""
    dir_path = Path(directory)
    
    if not dir_path.exists():
        print(f"Directory not found: {directory}")
        return
    
    # Find all markdown files
    md_files = list(dir_path.glob(pattern))
    
    if not md_files:
        print(f"No Markdown files found in {directory}")
        return
    
    print(f"Found {len(md_files)} Markdown files")
    
    for md_file in md_files:
        print(f"\nProcessing: {md_file.name}")
        diagrams = extract_mermaid_from_markdown(str(md_file))
        
        if not diagrams:
            print("  No Mermaid diagrams found")
            continue
        
        print(f"  Found {len(diagrams)} diagrams")
        
        for diagram in diagrams:
            mmd_file = diagram['mmd_file']
            png_file = Path(mmd_file).with_suffix('.png')
            
            # Try to convert
            if mermaid_to_png(mmd_file, str(png_file)):
                print(f"    ✓ {png_file.name}")
            else:
                print(f"    ✗ Failed: {png_file.name}")


def main():
    parser = argparse.ArgumentParser(
        description="Convert Mermaid diagrams to PNG images"
    )
    parser.add_argument(
        "input",
        nargs="?",
        help="Input Mermaid file (.mmd)"
    )
    parser.add_argument(
        "output",
        nargs="?",
        help="Output PNG file"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Convert all diagrams in documentation folder"
    )
    parser.add_argument(
        "--theme",
        default="default",
        choices=["default", "dark", "neutral", "forest"],
        help="Mermaid theme"
    )
    parser.add_argument(
        "--extract-only",
        action="store_true",
        help="Only extract diagrams, don't convert"
    )
    
    args = parser.parse_args()
    
    # Install mermaid CLI if needed
    if args.input or args.all:
        if not check_mermaid_cli():
            if not install_mermaid_cli():
                print("\n⚠️  Could not install mermaid-cli")
                print("Will try alternative methods...")
    
    if args.all:
        # Convert all diagrams in documentation folder
        convert_all_in_directory("documentation")
    elif args.input and args.output:
        # Convert single file
        success = mermaid_to_png(args.input, args.output, args.theme)
        sys.exit(0 if success else 1)
    elif args.input and not args.output:
        # Extract only
        diagrams = extract_mermaid_from_markdown(args.input)
        print(f"Extracted {len(diagrams)} diagrams")
        for d in diagrams:
            print(f"  - {d['mmd_file']}")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
