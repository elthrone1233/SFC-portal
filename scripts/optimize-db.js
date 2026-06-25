import fs from 'fs';
import { Jimp } from 'jimp';

async function optimize() {
  const dbPath = 'saint-francis-db.json';
  if (!fs.existsSync(dbPath)) {
    console.log('No saint-francis-db.json found');
    return;
  }

  const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const households = data.households || [];

  console.log(`Starting database optimization. Households count: ${households.length}`);

  let totalBefore = 0;
  let totalAfter = 0;

  for (let i = 0; i < households.length; i++) {
    const hh = households[i];
    if (hh.attachments && Array.isArray(hh.attachments)) {
      for (let j = 0; j < hh.attachments.length; j++) {
        const att = hh.attachments[j];
        if (att.fileData && typeof att.fileData === 'string') {
          const match = att.fileData.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
          if (match) {
            const mime = match[1];
            const base64Data = match[2];
            const originalLength = base64Data.length;
            totalBefore += originalLength;

            if (originalLength > 50 * 1024) { // Only optimize files larger than 50 KB
              console.log(`Optimizing household index ${i} (${hh.householdHead || 'unnamed'}), attachment ${j} (orig size: ${(originalLength / 1024).toFixed(1)} KB)...`);
              try {
                const buffer = Buffer.from(base64Data, 'base64');
                const image = await Jimp.read(buffer);
                
                // Resize if too large (constrain to max 800x800, maintaining aspect ratio)
                if (image.width > 800 || image.height > 800) {
                  console.log(`  - Resizing from ${image.width}x${image.height} to fit max 800x800`);
                  image.scaleToFit({ w: 800, h: 800 });
                }
                
                // Compress and get buffer
                const outBuffer = await image.getBuffer('image/jpeg', { quality: 60 });
                const newBase64 = Buffer.from(outBuffer).toString('base64');
                totalAfter += newBase64.length;
                
                att.fileData = `data:image/jpeg;base64,${newBase64}`;
                console.log(`  -> Optimized to: ${(newBase64.length / 1024).toFixed(1)} KB (reduced by ${((1 - newBase64.length / originalLength) * 100).toFixed(1)}%)`);
              } catch (err) {
                console.warn(`  x Failed to optimize attachment ${j}:`, err.message);
                totalAfter += originalLength;
              }
            } else {
              totalAfter += originalLength;
            }
          } else {
            totalBefore += att.fileData.length;
            totalAfter += att.fileData.length;
          }
        }
      }
    }
  }

  // Save the optimized JSON database
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\nOptimization summary:`);
  console.log(`- Base64 attachments before: ${(totalBefore / 1024 / 1024).toFixed(2)} MB`);
  console.log(`- Base64 attachments after: ${(totalAfter / 1024 / 1024).toFixed(2)} MB`);
  console.log(`- Reduction percentage: ${((1 - totalAfter / totalBefore) * 100).toFixed(1)}%`);
  console.log('Database optimization completed and saved successfully!');
}

optimize().catch(err => {
  console.error('Error running database optimization:', err);
});
