import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import process from 'node:process';

function envValue(name: string) {
  return process.env[name]?.trim().replace(/^['"]+|['"]+$/g, '');
}

const rawEndpoint = envValue('AWS_ENDPOINT_URL_S3');
const endpoint = rawEndpoint
  ? `${/^https?:\/\//i.test(rawEndpoint) ? '' : 'https://'}${rawEndpoint}`.replace(/\/+$/, '')
  : undefined;
const bucket = envValue('MCQ_MEDIA_BUCKET') || 'mcq-media';
const accessKeyId = envValue('AWS_ACCESS_KEY_ID');
const secretAccessKey = envValue('AWS_SECRET_ACCESS_KEY');
const region = envValue('AWS_REGION') || 'us-east-2';

const configured = Boolean(endpoint && accessKeyId && secretAccessKey);
const s3 = configured
  ? new S3Client({
      endpoint,
      region,
      forcePathStyle: true,
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED'
    })
  : null;

function objectKey(key: string) {
  if (!/^[a-f0-9]{64}$/i.test(key)) throw new Error('MCQ media object key is invalid.');
  return `mcq/${key}`;
}

export function mcqObjectStorageConfigured() {
  return configured;
}

export async function putMcqMediaObject(key: string, data: Buffer, contentType: string) {
  if (!configured || !s3) return null;
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey(key),
    Body: data,
    ContentType: contentType
  }));
  return key;
}

export async function getMcqMediaObject(key: string) {
  if (!configured || !s3) throw new Error('MCQ media object storage is not configured.');
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey(key) }));
  if (!response.Body) throw new Error('MCQ media storage returned an empty object.');
  return Buffer.from(await response.Body.transformToByteArray());
}
