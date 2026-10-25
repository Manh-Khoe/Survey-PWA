const fs = require('fs');
const zlib = require('zlib');

function createPng(width, height, r, g, b) {
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    function crc32(buf) {
        let crc = -1;
        for (let i = 0; i < buf.length; i++) {
            let byte = buf[i];
            crc ^= byte;
            for (let j = 0; j < 8; j++) {
                crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
            }
        }
        return (crc ^ -1) >>> 0;
    }
    function chunk(type, data) {
        const len = Buffer.alloc(4);
        len.writeUInt32BE(data.length, 0);
        const t = Buffer.from(type, 'binary');
        const crcBuf = Buffer.alloc(4);
        crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
        return Buffer.concat([len, t, data, crcBuf]);
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // color type (RGB)
    ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    const ihdrChunk = chunk('IHDR', ihdr);

    const rowBytes = 1 + width * 3;
    const raw = Buffer.alloc(height * rowBytes);
    for (let y = 0; y < height; y++) {
        const offset = y * rowBytes;
        raw[offset] = 0; // filter None
        for (let x = 0; x < width; x++) {
            const pxOffset = offset + 1 + x * 3;
            // Draw a nice rounded box with white clipboard icon in center
            const cx = width / 2;
            const cy = height / 2;
            const dx = Math.abs(x - cx);
            const dy = Math.abs(y - cy);
            
            // Icon: inner survey clipboard or badge
            const inIcon = (dx < width * 0.25 && dy < height * 0.3);
            if (inIcon) {
                raw[pxOffset] = 255;
                raw[pxOffset + 1] = 255;
                raw[pxOffset + 2] = 255;
            } else {
                raw[pxOffset] = r;
                raw[pxOffset + 1] = g;
                raw[pxOffset + 2] = b;
            }
        }
    }
    const idatData = zlib.deflateSync(raw);
    const idatChunk = chunk('IDAT', idatData);
    const iendChunk = chunk('IEND', Buffer.alloc(0));

    return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

if (!fs.existsSync('public')) fs.mkdirSync('public', { recursive: true });
// Theme color #0284c7 -> R=2, G=132, B=199
fs.writeFileSync('public/icon-192.png', createPng(192, 192, 2, 132, 199));
fs.writeFileSync('public/icon-512.png', createPng(512, 512, 2, 132, 199));
// Also copy to root for standalone access
fs.writeFileSync('icon-192.png', createPng(192, 192, 2, 132, 199));
fs.writeFileSync('icon-512.png', createPng(512, 512, 2, 132, 199));
console.log('Icons generated successfully.');

