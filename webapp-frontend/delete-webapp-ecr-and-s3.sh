#!/bin/bash
# Check if stage is provided
STAGE=${1:-dev}

S3_BUCKET="document-analyser-${STAGE}-documents"
ECR_REPO="document-analyser-${STAGE}-webapp"

echo "Starting cleanup process for stage: ${STAGE}"

# Empty S3 bucket
echo "Emptying S3 bucket: ${S3_BUCKET}"
if aws s3 rm "s3://${S3_BUCKET}" --recursive >> /dev/null 2>&1; then
    echo "Successfully emptied S3 bucket: ${S3_BUCKET}"
else
    echo "Warning: Failed to empty S3 bucket ${S3_BUCKET}. It might not exist or you may not have permissions."
fi

# Delete ECR repository
echo "Deleting ECR repository: ${ECR_REPO}"
if aws ecr delete-repository --repository-name "${ECR_REPO}" --force >> /dev/null 2>&1; then
    echo "Successfully deleted ECR repository: ${ECR_REPO}"
else
    echo "Warning: Failed to delete ECR repository ${ECR_REPO}. It might not exist or you may not have permissions."
fi

echo "Cleanup process completed" 