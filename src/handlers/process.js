const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const path = require('path');
const pdfParse = require('pdf-parse');
const { logger, addRequestContext } = require('../utils/logger');

const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const bedrockClient = new BedrockRuntimeClient({});

exports.handler = async (event, context) => {
  addRequestContext(context);
  
  try {
    logger.info('Processing document event', { event });
    const s3Event = event.detail;
    const bucket = s3Event.bucket.name;
    const key = s3Event.object.key;
    
    const ext = path.extname(key).toLowerCase();
    logger.debug('Extracted file information', { bucket, key, ext });

    // Get document from S3
    const s3Params = {
      Bucket: bucket,
      Key: key
    };
    
    const s3Response = await s3Client.send(new GetObjectCommand(s3Params));

    let document, documentId;

    switch (ext) {
      case '.txt':
        document = await s3Response.Body.transformToString();
        documentId = key.replace('.txt', '');
        break;
      case '.json':
        document = JSON.parse(await s3Response.Body.transformToString());
        documentId = key.replace('.json', '');
        break;
      case '.pdf':
        const pdfBuffer = await s3Response.Body.transformToByteArray();
        const pdfData = await pdfParse(pdfBuffer);
        document = pdfData.text;
        documentId = key.replace('.pdf', '');
        break;
      default:
        throw new Error(`Unsupported file type: ${key}`);
    }

    logger.info('Document extracted successfully', { documentId, type: ext });
    logger.debug('Extracted document content', { document });

    // Process document with Bedrock
    const bedrockParams = {
      modelId: process.env.BEDROCK_MODEL_ID,
      body: JSON.stringify({
        prompt: `\n\nHuman: Analyze the following document and extract key information:\n\n${typeof document === 'string' ? document : JSON.stringify(document, null, 2)}\n\nAssistant:`,
        max_tokens_to_sample: 1000,
        temperature: 0.7
      })
    };
    
    logger.debug('Calling Bedrock for analysis', { modelId: process.env.BEDROCK_MODEL_ID });
    const bedrockResponse = await bedrockClient.send(new InvokeModelCommand(bedrockParams));
    const analysis = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
    logger.info('Document analysis completed', { documentId });
    logger.debug('Analysis results', { analysis });

    logger.info('Updating document status', { documentId });

    // Update document status in DynamoDB
    const dynamoParams = {
      TableName: process.env.TABLE_NAME,
      Key: {
        id: { S: documentId }
      },
      UpdateExpression: 'SET #status = :status, analysis = :analysis, processedAt = :processedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': { S: 'PROCESSED' },
        ':analysis': { S: JSON.stringify(analysis) },
        ':processedAt': { S: new Date().toISOString() }
      }
    };

    await dynamoClient.send(new UpdateItemCommand(dynamoParams));
    logger.info('Document processing completed successfully', { documentId });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Document processed successfully',
        documentId,
        analysis
      })
    };
  } catch (error) {
    logger.error('Error processing document', { error: error.message, stack: error.stack });
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error processing document',
        error: error.message
      })
    };
  }
}; 