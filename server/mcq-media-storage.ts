import { AwsClient } from 'aws4fetch';
import process from 'node:process';

const rawEndpoint = process.env.AWS_ENDPOINT_URL_S3?.trim();
const endpoint = rawEndpoint
  ? `${/^https?:\/\//i.test(rawEndpoint) ? '' : 'https://'}${rawEndpoint}`.replace(/\/+$/, '')
  : undefined;
const bucket = process.env.MCQ_MEDIA_BUCKET || 'mcq-media';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_REGION || 'us-east-2';

const configured = Boolean(endpoint && accessKeyId && secretAccessKey);
const s3 = configured ? new AwsClient({ accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey!, service: 's3', region }) : null;

function objectUrl(key: string) {
  if (!endpoint || !/^[a-f0-9]{64}$/i.test(key)) throw new Error('MCQ media object configuration or key is invalid.');
  return `${endpoint}/${encodeURIComponent(bucket)}/mcq/${key}`;
}

export function mcqObjectStorageConfigured() {
  return configured;
}

export async function putMcqMediaObject(key: string, data: Buffer, contentType: string) {
  if (!configured || !s3) return null;
  const body = new Uint8Array(data.length);
  body.set(data);
  const response = await s3.fetch(objectUrl(key), { method: 'PUT', body, headers: { 'content-type': contentType } });
  if (!response.ok) throw new Error(`MCQ media storage upload failed (${response.status}).`);
  return key;
}

export async function getMcqMediaObject(key: string) {
  if (!configured || !s3) throw new Error('MCQ media object storage is not configured.');
  const response = await s3.fetch(objectUrl(key));
  if (!response.ok) throw new Error(`MCQ media storage read failed (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}
