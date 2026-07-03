import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Check R2 environment variables - only throw in runtime, not during build
const isBuilding =
  process.env.NODE_ENV === 'production' && !process.env.VERCEL_URL && !process.env.CF_PAGES;
if (
  !isBuilding &&
  (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY)
) {
  console.warn('R2 environment variables are not configured. File uploads will not work.');
}

const r2Client = process.env.R2_ACCOUNT_ID
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null;

export class R2StorageClient {
  private bucketName = process.env.R2_BUCKET_NAME || 'default';

  private checkClient() {
    if (!r2Client) {
      throw new Error('R2 client not initialized. Please configure R2 environment variables.');
    }
    return r2Client;
  }

  async uploadVideo(key: string, videoBuffer: Buffer, contentType = 'video/mp4') {
    const client = this.checkClient();
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: videoBuffer,
      ContentType: contentType,
    });

    await client.send(command);
    return `https://${this.bucketName}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
  }

  async uploadFile(key: string, fileBuffer: Buffer, contentType: string) {
    const client = this.checkClient();
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    });

    await client.send(command);
    return `https://${this.bucketName}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
  }

  async getSignedUrl(key: string, expiresIn = 3600) {
    const client = this.checkClient();
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return await getSignedUrl(client, command, { expiresIn });
  }

  async getPresignedUploadUrl(key: string, contentType: string, expiresIn = 3600) {
    const client = this.checkClient();
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    return await getSignedUrl(client, command, { expiresIn });
  }

  async deleteFile(key: string) {
    const client = this.checkClient();
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await client.send(command);
  }

  async deleteVideo(key: string) {
    return this.deleteFile(key);
  }
}

export const r2Storage = new R2StorageClient();
