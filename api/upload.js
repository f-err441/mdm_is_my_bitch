import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const uploadDir = path.join('/tmp', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const form = formidable({ uploadDir, keepExtensions: true });

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    // Formidable can return files as an array or single object depending on version
    const rawFile = files.file;
    const uploadedFile = Array.isArray(rawFile) ? rawFile[0] : rawFile;

    if (!uploadedFile || !uploadedFile.originalFilename || !uploadedFile.originalFilename.endsWith('.ipa')) {
      return res.status(400).json({ error: 'Invalid payload. Only .ipa files accepted.' });
    }

    const fileName = path.basename(uploadedFile.filepath);
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    
    // Construct dynamic install URL pointing to the manifest endpoint
    const manifestUrl = `${protocol}://${host}/api/manifest?file=${fileName}&name=${encodeURIComponent(uploadedFile.originalFilename)}`;
    const installUrl = `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}`;

    return res.status(200).json({ success: true, installUrl });
  } catch (err) {
    console.error('Upload processing error:', err);
    // Return explicit string message instead of letting it object-serialize
    const errorMessage = err instanceof Error ? err.message : String(err || 'Unknown server error');
    return res.status(500).json({ error: `File upload processing failed: ${errorMessage}` });
  }
}
