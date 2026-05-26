#!/bin/bash

# Define the target folder and the output zip name
FOLDER="src"
BUILD_FOLDER="./build"
OUTPUT="$BUILD_FOLDER/app.zip"

# Check if the build folder exists
if [ -d "./build" ]; then
    echo "$BUILD_FOLDER exists."
else
    echo "Creating build directory..."
    mkdir "./build"
fi

# Check if the folder exists
if [ -d "$FOLDER" ]; then
    echo "Zipping contents of $FOLDER..."
    if zip -r "$OUTPUT" ./src/; then
        echo "Done! Zip file created: $OUTPUT."
    else
        echo "Command failed"
        exit 1
    fi 
else
    echo "Error: Folder $FOLDER does not exist."
    exit 1
fi