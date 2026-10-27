import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { filename } = req.body;
    if (!filename || !filename.endsWith('.ipa')) {
      return res.status(400).json({ error: 'Invalid file type. Only .ipa allowed.' });
    }

    const uniqueKey = `${Date.now()}-${filename}`;

    // Create a direct upload ticket (presigned URL) valid for 5 minutes
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: uniqueKey,
      ContentType: 'application/octet-stream',
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    const publicFileUrl = `${process.env.R2_PUBLIC_DOMAIN}/${uniqueKey}`;

    return res.status(200).json({ uploadUrl, publicFileUrl });
  } catch (err) {
    console.error('Presign error:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate upload ticket.' });
  }
}
