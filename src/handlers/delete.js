const { DynamoDBClient, GetItemCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { logger, addRequestContext } = require('../utils/logger');

const dynamoClient = new DynamoDBClient({});
const s3Client = new S3Client({});

exports.handler = async (event, context) => {
    addRequestContext(context);
    
    try {
        // Extract document ID from path parameters
        const documentId = event.pathParameters.id;
        if (!documentId) {
            logger.warn('Missing document ID in request');
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Document ID is required' })
            };
        }

        logger.info('Attempting to delete document', { documentId });

        // First, get the document details from DynamoDB to check if it exists
        const dynamoParams = {
            TableName: process.env.TABLE_NAME,
            Key: {
                id: { S: documentId }
            }
        };
        const dynamoResponse = await dynamoClient.send(new GetItemCommand(dynamoParams));
        
        if (!dynamoResponse.Item) {
            logger.warn('Document not found for deletion', { documentId });
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Document not found' })
            };
        }
        // document.Item.fileExtension is the file extension of the document
        // we need to delete the document from S3 with the correct extension
        const fileExtension = dynamoResponse.Item.fileExtension.S;
        const key = `${documentId}.${fileExtension}`;

        logger.debug('Deleting document from S3', { documentId, key });

        // Delete from S3
        const s3Params = {
            Bucket: process.env.BUCKET_NAME,
            Key: key
        };
        await s3Client.send(new DeleteObjectCommand(s3Params));
        logger.info('Document deleted from S3', { documentId });

        logger.debug('Deleting document from DynamoDB', { documentId });

        // Delete from DynamoDB
        const deleteParams = {
            TableName: process.env.TABLE_NAME,
            Key: {
                id: { S: documentId }
            }
        };

        await dynamoClient.send(new DeleteItemCommand(deleteParams));
        logger.info('Document deleted successfully', { documentId });

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify({
                message: 'Document deleted successfully',
                documentId: documentId
            })
        };

    } catch (error) {
        logger.error('Error deleting document', { error: error.message, stack: error.stack });
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify({
                error: 'Could not delete document',
                details: error.message
            })
        };
    }
}; 