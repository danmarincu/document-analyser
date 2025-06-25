const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { logger, addRequestContext } = require('../utils/logger');

const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});

const SUPPORTED_TYPES = {
  'application/json': 'json',
  'text/plain': 'txt',
  'application/pdf': 'pdf'
};

// Function to validate base64 string
const isValidBase64 = (str) => {
  try {
    return btoa(atob(str)) === str;
  } catch (err) {
    return false;
  }
};

exports.handler = async (event, context) => {
  addRequestContext(context);
  
  try {
    const documentId = uuidv4();
    let documentContent;
    let documentType;
    let fileExtension;

    // Parse the request body
    const body = JSON.parse(event.body);
    logger.info('Processing upload request', { documentId, type: body.type });
    
    // Handle different document types
    if (body.type && SUPPORTED_TYPES[body.type]) {
      documentType = body.type;
      fileExtension = SUPPORTED_TYPES[body.type];
      
      if (body.type === 'application/json') {
        documentContent = JSON.stringify(body.content);
      } else if (body.type === 'text/plain') {
        documentContent = body.content;
      } else if (['application/pdf', 'image/jpg', 'image/jpeg', 'image/png'].includes(body.type)) {
        // For PDF and images, content should be base64 encoded
        if (!body.content || typeof body.content !== 'string') {
          logger.error('Invalid content format', { documentId, type: body.type });
          throw new Error(`For ${body.type}, content must be a base64 encoded string. Please convert your file to base64 before uploading.`);
        }
        
        if (!isValidBase64(body.content)) {
          logger.error('Invalid base64 content', { documentId, type: body.type });
          throw new Error(`Invalid base64 content for ${body.type}. Please ensure your file is properly base64 encoded.`);
        }

        // Convert base64 to buffer for S3
        documentContent = Buffer.from(body.content, 'base64');
      }
    } else {
      logger.error('Unsupported document type', { documentId, type: body.type });
      throw new Error(`Unsupported document type. Supported types are: ${Object.keys(SUPPORTED_TYPES).join(', ')}`);
    }

    logger.debug('Uploading document to S3', { documentId, type: documentType });

    // Upload document to S3
    const s3Params = {
      Bucket: process.env.BUCKET_NAME,
      Key: `${documentId}.${fileExtension}`,
      Body: documentContent,
      ContentType: documentType
    };
    
    await s3Client.send(new PutObjectCommand(s3Params));
    logger.info('Document uploaded to S3', { documentId, type: documentType });
    
    // Store metadata in DynamoDB
    const dynamoParams = {
      TableName: process.env.TABLE_NAME,
      Item: {
        id: { S: documentId },
        name: { S: body.name },
        createdAt: { S: new Date().toISOString() },
        status: { S: 'PENDING' },
        type: { S: documentType },
        fileExtension: { S: fileExtension }
      }
    };
    
    await dynamoClient.send(new PutItemCommand(dynamoParams));
    logger.info('Document metadata stored in DynamoDB', { documentId });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Document uploaded successfully',
        documentId,
        type: documentType,
        instructions: body.type === 'application/pdf' ? 'PDF will be processed for text extraction and analysis' : null
      })
    };
  } catch (error) {
    logger.error('Error uploading document', { error: error.message, stack: error.stack });
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Error uploading document',
        error: error.message,
        help: 'For PDF files, please ensure you convert the file to base64 before uploading. Example: const base64PDF = Buffer.from(pdfFile).toString("base64");'
      })
    };
  }
}; 