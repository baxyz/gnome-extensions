// Mozilla's LZ4 variant: 8-byte magic "mozLz40\0" + 4-byte uint32LE uncompressed size + LZ4 block data.
// Spec: https://github.com/nicowillis/mozlz4
// LZ4 block format: https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md

const MAGIC = [109, 111, 122, 76, 122, 52, 48, 0]; // "mozLz40\0"

function lz4BlockDecode(src: Uint8Array, dst: Uint8Array): number {
  let s = 0;
  let d = 0;

  while (s < src.length) {
    const token = src[s++];

    let litLen = token >>> 4;
    if (litLen === 15) {
      let b: number;
      do {
        b = src[s++];
        litLen += b;
      } while (b === 255);
    }

    dst.set(src.subarray(s, s + litLen), d);
    s += litLen;
    d += litLen;

    if (s >= src.length) break;

    const offset = src[s++] | (src[s++] << 8);

    let matchLen = (token & 0x0f) + 4;
    if ((token & 0x0f) === 15) {
      let b: number;
      do {
        b = src[s++];
        matchLen += b;
      } while (b === 255);
    }

    let pos = d - offset;
    for (let i = 0; i < matchLen; i++) dst[d++] = dst[pos++];
  }

  return d;
}

export function decodeMozLz4(data: Uint8Array): Uint8Array {
  for (let i = 0; i < 8; i++) {
    if (data[i] !== MAGIC[i]) throw new Error("Not a mozlz4 file");
  }
  const size = new DataView(data.buffer, data.byteOffset + 8, 4).getUint32(0, true);
  const out = new Uint8Array(size);
  const written = lz4BlockDecode(data.subarray(12), out);
  return written < size ? out.subarray(0, written) : out;
}
