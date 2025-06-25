#!/bin/bash

# Check if stage is provided
STAGE=${1:-dev}

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)

# ECR repository URI
ECR_REPO="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/document-analyser-$STAGE-webapp"

# Create the ECR repository if it doesn't exist
echo "Creating ECR repository... if it doesn't exist"
aws ecr create-repository --repository-name document-analyser-$STAGE-webapp --region $AWS_REGION >> /dev/null 2>&1

# Authenticate Docker to ECR
echo "Authenticating Docker to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build the Docker image
echo "Building Docker image..."
docker build --platform linux/x86_64 -t document-analyser-webapp .

# Tag the image
echo "Tagging image for ECR..."
docker tag document-analyser-webapp:latest $ECR_REPO:latest

# Push to ECR
echo "Pushing to ECR..."
docker push $ECR_REPO:latest

echo "Done! Image pushed to: $ECR_REPO:latest" 