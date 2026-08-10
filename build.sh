#!/bin/bash

# Define the target folder and the output zip name
FOLDER="src"
OUTPUT="../build/nepali-calendar-helper.zip"

# Check if the folder exists
if [ -d "$FOLDER" ]; then
    echo "Zipping contents of $FOLDER..."
    # Navigate inside, zip contents, and return
    cd "$FOLDER" && zip -r "$OUTPUT" .
    echo "Done! Zip file created: $OUTPUT."
else
    echo "Error: Folder $FOLDER does not exist."
    exit 1
fi