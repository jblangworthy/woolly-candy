#!/bin/bash
set -e
OUTPUT_DIR="${1:-.}"
swiftc -O -o "$OUTPUT_DIR/clipboard-monitor" "$(dirname "$0")/clipboard-monitor.swift"
