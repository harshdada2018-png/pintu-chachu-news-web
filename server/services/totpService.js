import crypto from 'crypto';

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// ---------------------------------------------------------------------------
// Base32 RFC 4648 Encoding / Decoding (Zero External Dependencies)
// ---------------------------------------------------------------------------

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }

  return output;
}

export function base32Decode(input) {
  const cleaned = String(input || '')
    .toUpperCase()
    .replace(/=+$/, '')
    .replace(/[\s-]+/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_CHARS.indexOf(cleaned[i]);
    if (idx === -1) {
      throw new Error(`Invalid Base32 character: ${cleaned[i]}`);
    }

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generate a cryptographically secure 20-byte (160-bit) Base32 secret (32 characters)
 */
export function generateBase32Secret(byteLength = 20) {
  const bytes = crypto.randomBytes(byteLength);
  return base32Encode(bytes);
}

// ---------------------------------------------------------------------------
// RFC 6238 Time-Based One-Time Password (TOTP) Core Engine
// ---------------------------------------------------------------------------

/**
 * Generate 6-digit TOTP code for a given secret and time offset
 */
export function generateTOTP(secretBase32, timeOffsetSteps = 0, stepSeconds = 30, digits = 6, timestamp = Date.now()) {
  const key = base32Decode(secretBase32);
  const epochSeconds = Math.floor(timestamp / 1000);
  const counter = Math.floor(epochSeconds / stepSeconds) + timeOffsetSteps;

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();

  // Dynamic truncation (RFC 4226 Section 5.4)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % (10 ** digits);
  return String(otp).padStart(digits, '0');
}

/**
 * Verify candidate TOTP with ±30s clock drift tolerance (window = 1 checks t-1, t, t+1)
 */
export function verifyTOTP(secretBase32, candidateCode, window = 1, timestamp = Date.now()) {
  if (!candidateCode || typeof candidateCode !== 'string') return false;
  const cleanCode = candidateCode.replace(/\s+/g, '');
  if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) return false;

  try {
    for (let offset = -window; offset <= window; offset++) {
      const expected = generateTOTP(secretBase32, offset, 30, 6, timestamp);
      const expectedBuffer = Buffer.from(expected);
      const candidateBuffer = Buffer.from(cleanCode);
      if (expectedBuffer.length === candidateBuffer.length && crypto.timingSafeEqual(candidateBuffer, expectedBuffer)) {
        return true;
      }
    }
    return false;
  } catch (_e) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 10 One-Time Emergency Recovery Codes Generator & Hasher
// ---------------------------------------------------------------------------

/**
 * Hash a recovery code with SHA-256 for persistent database storage
 */
export function hashRecoveryCode(code) {
  const normalized = String(code || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Generate 10 cryptographically random emergency recovery codes (Format: XXXX-XXXX)
 */
export function generateRecoveryCodes(count = 10) {
  const plainCodes = [];
  const hashedCodes = [];
  const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude ambiguous 0/O, 1/I

  for (let i = 0; i < count; i++) {
    const bytes = crypto.randomBytes(8);
    let part1 = '';
    let part2 = '';
    for (let j = 0; j < 4; j++) {
      part1 += charset[bytes[j] % charset.length];
      part2 += charset[bytes[j + 4] % charset.length];
    }
    const code = `${part1}-${part2}`;
    plainCodes.push(code);
    hashedCodes.push(hashRecoveryCode(code));
  }

  return { plainCodes, hashedCodes };
}

/**
 * Verify and burn an emergency recovery code (Single-Use Destruction)
 */
export function verifyAndBurnRecoveryCode(storedHashes = [], candidateCode) {
  if (!candidateCode || !Array.isArray(storedHashes) || storedHashes.length === 0) {
    return { valid: false, remainingHashes: storedHashes || [] };
  }

  const candidateHash = hashRecoveryCode(candidateCode);
  const matchIndex = storedHashes.findIndex(h => h === candidateHash);

  if (matchIndex === -1) {
    return { valid: false, remainingHashes: storedHashes };
  }

  // Remove used code immediately (Single-use burn)
  const remainingHashes = storedHashes.filter((_, idx) => idx !== matchIndex);
  return { valid: true, remainingHashes };
}

// ---------------------------------------------------------------------------
// Authenticator Pairing URI (Standard otpauth://)
// ---------------------------------------------------------------------------

export function generateTotpUri({ secret, issuer = 'PublicSpark', accountName = 'admin@publicspark.in' }) {
  const cleanIssuer = encodeURIComponent(issuer);
  const cleanAccount = encodeURIComponent(accountName);
  return `otpauth://totp/${cleanIssuer}:${cleanAccount}?secret=${secret}&issuer=${cleanIssuer}&algorithm=SHA1&digits=6&period=30`;
}

// ---------------------------------------------------------------------------
// Pure-JavaScript ISO/IEC 18004 QR Code Matrix & Crisp SVG Generator
// ---------------------------------------------------------------------------

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 256) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(x, y) {
  if (x === 0 || y === 0) return 0;
  return GF_EXP[GF_LOG[x] + GF_LOG[y]];
}

function polyMul(p1, p2) {
  const res = new Uint8Array(p1.length + p2.length - 1);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      res[i + j] ^= gfMul(p1[i], p2[j]);
    }
  }
  return res;
}

function rsGenPoly(degree) {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    poly = polyMul(poly, new Uint8Array([1, GF_EXP[i]]));
  }
  return poly;
}

function rsComputeEcc(data, eccCount) {
  const gen = rsGenPoly(eccCount);
  const msg = new Uint8Array(data.length + eccCount);
  msg.set(data, 0);

  for (let i = 0; i < data.length; i++) {
    const factor = msg[i];
    if (factor !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], factor);
      }
    }
  }
  return msg.subarray(data.length);
}

const QR_TABLE_M = [
  null,
  { v: 1, total: 26, ec: 10, blocks: [[1, 16]], align: [] },
  { v: 2, total: 44, ec: 16, blocks: [[1, 28]], align: [6, 18] },
  { v: 3, total: 70, ec: 26, blocks: [[1, 44]], align: [6, 22] },
  { v: 4, total: 100, ec: 18, blocks: [[2, 32]], align: [6, 26] },
  { v: 5, total: 134, ec: 24, blocks: [[2, 43]], align: [6, 30] },
  { v: 6, total: 172, ec: 16, blocks: [[4, 27]], align: [6, 34] },
  { v: 7, total: 196, ec: 18, blocks: [[4, 31]], align: [6, 22, 38] },
  { v: 8, total: 242, ec: 22, blocks: [[2, 38], [2, 39]], align: [6, 24, 42] },
  { v: 9, total: 292, ec: 22, blocks: [[3, 36], [2, 37]], align: [6, 26, 46] },
  { v: 10, total: 346, ec: 26, blocks: [[4, 43], [1, 44]], align: [6, 28, 50] }
];

export function createQrMatrix(text) {
  const bytes = Buffer.from(text, 'utf-8');
  const dataLen = bytes.length;

  let verInfo = null;
  for (let v = 1; v <= 10; v++) {
    const info = QR_TABLE_M[v];
    const totalDataCap = info.blocks.reduce((acc, [b, c]) => acc + b * c, 0);
    const headerBits = 4 + (v < 10 ? 8 : 16);
    const capacityBytes = Math.floor((totalDataCap * 8 - headerBits) / 8);
    if (dataLen <= capacityBytes) {
      verInfo = info;
      break;
    }
  }

  if (!verInfo) {
    throw new Error('Text too long for built-in QR generator (max 216 bytes in Level M)');
  }

  const version = verInfo.v;
  const matrixSize = 17 + 4 * version;

  const bitBuf = [];
  function pushBits(val, len) {
    for (let i = len - 1; i >= 0; i--) {
      bitBuf.push((val >>> i) & 1);
    }
  }

  pushBits(4, 4); // Byte mode 0100
  pushBits(dataLen, version < 10 ? 8 : 16);
  for (let i = 0; i < dataLen; i++) {
    pushBits(bytes[i], 8);
  }

  const totalDataBytes = verInfo.blocks.reduce((acc, [b, c]) => acc + b * c, 0);
  const totalDataBits = totalDataBytes * 8;

  const termLen = Math.min(4, totalDataBits - bitBuf.length);
  pushBits(0, termLen);

  while (bitBuf.length % 8 !== 0) {
    bitBuf.push(0);
  }

  let padByte = 0xec;
  while (bitBuf.length < totalDataBits) {
    pushBits(padByte, 8);
    padByte = padByte === 0xec ? 0x11 : 0xec;
  }

  const dataCodewords = [];
  for (let i = 0; i < bitBuf.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bitBuf[i + j];
    dataCodewords.push(b);
  }

  const dataBlocks = [];
  const eccBlocks = [];
  let offset = 0;

  for (const [numBlocks, blockSize] of verInfo.blocks) {
    for (let b = 0; b < numBlocks; b++) {
      const blockData = dataCodewords.slice(offset, offset + blockSize);
      offset += blockSize;
      const blockEcc = rsComputeEcc(blockData, verInfo.ec);
      dataBlocks.push(blockData);
      eccBlocks.push(Array.from(blockEcc));
    }
  }

  const finalCodewords = [];
  const maxBlockLen = Math.max(...dataBlocks.map(b => b.length));
  for (let i = 0; i < maxBlockLen; i++) {
    for (const b of dataBlocks) {
      if (i < b.length) finalCodewords.push(b[i]);
    }
  }

  for (let i = 0; i < verInfo.ec; i++) {
    for (const b of eccBlocks) {
      finalCodewords.push(b[i]);
    }
  }

  const matrix = Array.from({ length: matrixSize }, () => new Array(matrixSize).fill(null));
  const isFunction = Array.from({ length: matrixSize }, () => new Array(matrixSize).fill(false));

  function setModule(r, c, val, func = false) {
    if (r >= 0 && r < matrixSize && c >= 0 && c < matrixSize) {
      matrix[r][c] = val ? 1 : 0;
      if (func) isFunction[r][c] = true;
    }
  }

  function addFinder(topRow, leftCol) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = topRow + r;
        const col = leftCol + c;
        if (row < 0 || row >= matrixSize || col < 0 || col >= matrixSize) continue;
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          const isBlack = (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
          setModule(row, col, isBlack, true);
        } else {
          setModule(row, col, 0, true);
        }
      }
    }
  }

  addFinder(0, 0);
  addFinder(0, matrixSize - 7);
  addFinder(matrixSize - 7, 0);

  const alignCoords = verInfo.align;
  for (const r of alignCoords) {
    for (const c of alignCoords) {
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= matrixSize - 9) || (r >= matrixSize - 9 && c <= 8)) {
        continue;
      }
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const isBlack = (Math.abs(dy) === 2 || Math.abs(dx) === 2 || (dy === 0 && dx === 0));
          setModule(r + dy, c + dx, isBlack, true);
        }
      }
    }
  }

  for (let c = 8; c < matrixSize - 8; c++) {
    if (matrix[6][c] === null) setModule(6, c, c % 2 === 0, true);
  }
  for (let r = 8; r < matrixSize - 8; r++) {
    if (matrix[r][6] === null) setModule(r, 6, r % 2 === 0, true);
  }

  setModule(4 * version + 9, 8, 1, true);

  for (let i = 0; i <= 8; i++) {
    if (matrix[8][i] === null) isFunction[8][i] = true;
    if (matrix[i][8] === null) isFunction[i][8] = true;
  }
  for (let i = 0; i <= 7; i++) {
    if (matrix[8][matrixSize - 1 - i] === null) isFunction[8][matrixSize - 1 - i] = true;
    if (matrix[matrixSize - 1 - i][8] === null) isFunction[matrixSize - 1 - i][8] = true;
  }

  if (version >= 7) {
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 3; c++) {
        isFunction[r][matrixSize - 11 + c] = true;
        isFunction[matrixSize - 11 + c][r] = true;
      }
    }
  }

  let bitIndex = 0;
  const totalCodewordBits = finalCodewords.length * 8;
  let dirUp = true;

  for (let rightCol = matrixSize - 1; rightCol > 0; rightCol -= 2) {
    if (rightCol === 6) rightCol--;

    const rows = [];
    if (dirUp) {
      for (let r = matrixSize - 1; r >= 0; r--) rows.push(r);
    } else {
      for (let r = 0; r < matrixSize; r++) rows.push(r);
    }
    dirUp = !dirUp;

    for (const r of rows) {
      for (const c of [rightCol, rightCol - 1]) {
        if (!isFunction[r][c] && matrix[r][c] === null) {
          let bit = 0;
          if (bitIndex < totalCodewordBits) {
            const bytePos = Math.floor(bitIndex / 8);
            const bitPos = 7 - (bitIndex % 8);
            bit = (finalCodewords[bytePos] >>> bitPos) & 1;
            bitIndex++;
          }
          matrix[r][c] = bit;
        }
      }
    }
  }

  const maskPattern = (r, c) => (r + c) % 2 === 0;
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (!isFunction[r][c]) {
        if (maskPattern(r, c)) {
          matrix[r][c] ^= 1;
        }
      }
    }
  }

  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  const tlCoords = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
  ];
  for (let i = 0; i < 15; i++) {
    const [r, c] = tlCoords[i];
    matrix[r][c] = formatBits[i];
  }

  for (let i = 0; i < 7; i++) {
    matrix[matrixSize - 1 - i][8] = formatBits[i];
  }
  for (let i = 7; i < 15; i++) {
    matrix[8][matrixSize - 15 + i] = formatBits[i];
  }

  if (version >= 7) {
    const vBits = [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0];
    let vIdx = 0;
    for (let c = 0; c < 6; c++) {
      for (let r = 0; r < 3; r++) {
        matrix[matrixSize - 11 + r][c] = vBits[vIdx];
        matrix[c][matrixSize - 11 + r] = vBits[vIdx];
        vIdx++;
      }
    }
  }

  return { matrix, size: matrixSize };
}

export function generateQrSvg(text, pixelSize = 240) {
  const { matrix, size } = createQrMatrix(text);
  const border = 4;
  const totalUnits = size + border * 2;
  const unitSize = pixelSize / totalUnits;

  let pathD = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c] === 1) {
        const x = (c + border) * unitSize;
        const y = (r + border) * unitSize;
        pathD += `M${x.toFixed(2)},${y.toFixed(2)}h${unitSize.toFixed(2)}v${unitSize.toFixed(2)}h-${unitSize.toFixed(2)}z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pixelSize} ${pixelSize}" width="${pixelSize}" height="${pixelSize}" shape-rendering="crispEdges">
  <rect width="100%" height="100%" fill="#ffffff" rx="8" />
  <path d="${pathD.trim()}" fill="#0f172a" />
</svg>`;
}

