const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');

// Cliente compatível com Cloudflare R2, AWS S3, Backblaze B2, etc.
const s3 = new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.S3_BUCKET_NAME;

/**
 * Envia um buffer para o bucket e retorna a chave gerada.
 * @param {Buffer} buffer
 * @param {string} originalName
 * @param {string} mimeType
 * @param {string} pasta - prefixo lógico, ex: 'evidencias', 'certificados'
 */
async function uploadBuffer(buffer, originalName, mimeType, pasta) {
  const extensao = originalName.includes('.') ? originalName.split('.').pop() : '';
  const key = `${pasta}/${uuidv4()}${extensao ? '.' + extensao : ''}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );

  return key;
}

/**
 * Retorna uma URL assinada temporária para acesso a um arquivo privado,
 * ou a URL pública direta se S3_PUBLIC_URL estiver configurada.
 */
async function getFileUrl(key, expiresInSeconds = 3600) {
  if (!key) return null;
  if (process.env.S3_PUBLIC_URL) {
    return `${process.env.S3_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  }
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

async function deleteFile(key) {
  if (!key) return;
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

module.exports = { s3, uploadBuffer, getFileUrl, deleteFile };
