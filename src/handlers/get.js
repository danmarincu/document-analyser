const { DynamoDBClient, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { logger, addRequestContext } = require('../utils/logger');

const dynamoClient = new DynamoDBClient({});
const s3Client = new S3Client({});

exports.handler = async (event, context) => {
  addRequestContext(context);
  
  try {
    const documentId = event.pathParameters.id;
    logger.info('Retrieving document', { documentId });

    // Get document metadata from DynamoDB
    const dynamoParams = {
      TableName: process.env.TABLE_NAME,
      Key: {
        id: { S: documentId }
      }
    };

    const dynamoResponse = await dynamoClient.send(new GetItemCommand(dynamoParams));
    
    if (!dynamoResponse.Item) {
      logger.warn('Document not found', { documentId });
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          message: 'Document not found'
        })
      };
    }

    logger.debug('Retrieved document metadata', { documentId });

    // Get document content from S3
    const s3Params = {
      Bucket: process.env.BUCKET_NAME,
      Key: `${documentId}.json`
    };

    const s3Response = await s3Client.send(new GetObjectCommand(s3Params));
    const documentContent = await s3Response.Body.transformToString();
    logger.debug('Retrieved document content from S3', { documentId });

    // Combine metadata and content
    const response = {
      id: dynamoResponse.Item.id ? dynamoResponse.Item.id.S : null,
      name: dynamoResponse.Item.name ? dynamoResponse.Item.name.S : null,
      createdAt: dynamoResponse.Item.createdAt ? dynamoResponse.Item.createdAt.S : null,
      status: dynamoResponse.Item.status ? dynamoResponse.Item.status.S : null,
      type: dynamoResponse.Item.type ? dynamoResponse.Item.type.S : null,
      content: JSON.parse(documentContent),
      analysis: dynamoResponse.Item.analysis ? JSON.parse(dynamoResponse.Item.analysis.S) : null,
      processedAt: dynamoResponse.Item.processedAt ? dynamoResponse.Item.processedAt.S : null
    };

    logger.info('Document retrieved successfully', { documentId });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(response)
    };
  } catch (error) {
    logger.error('Error retrieving document', { error: error.message, stack: error.stack });
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Error retrieving document',
        error: error.message
      })
    };
  }
}; 