const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { logger, addRequestContext } = require('../utils/logger');

const dynamoClient = new DynamoDBClient({});

exports.handler = async (event, context) => {
  addRequestContext(context);
  
  try {
    logger.info('Retrieving all documents');
    
    // Get all documents from DynamoDB
    const dynamoParams = {
      TableName: process.env.TABLE_NAME,
      // Optional: Add pagination if needed
      Limit: 100
    };

    const dynamoResponse = await dynamoClient.send(new ScanCommand(dynamoParams));
    logger.debug('Retrieved documents from DynamoDB', { count: dynamoResponse.Items.length });
    
    // Transform DynamoDB items to a more readable format
    const documents = dynamoResponse.Items.map(item => ({
      id: item.id ? item.id.S : null,
      name: item.name ? item.name.S : null,
      createdAt: item.createdAt ? item.createdAt.S : null,
      status: item.status ? item.status.S : null,
      type: item.type ? item.type.S : null,
      analysis: item.analysis ? JSON.parse(item.analysis.S) : null,
      processedAt: item.processedAt ? item.processedAt.S : null
    }));

    logger.info('Documents retrieved successfully', { count: documents.length });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        documents,
        count: documents.length,
        // Include pagination info if implemented
        lastEvaluatedKey: dynamoResponse.LastEvaluatedKey
      })
    };
  } catch (error) {
    logger.error('Error retrieving documents', { error: error.message, stack: error.stack });
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Error retrieving documents',
        error: error.message
      })
    };
  }
}; 