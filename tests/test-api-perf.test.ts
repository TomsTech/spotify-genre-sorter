import { expect, test } from 'vitest';
// We'll mock a simple version of the chunked vs unchunked promise.all

test('baseline vs chunked performance', async () => {
  // Mock KV get
  const kvGet = async (key: string) => {
    await new Promise(resolve => setTimeout(resolve, 5)); // simulate network delay
    return JSON.stringify({
      spotifyId: key,
      spotifyName: 'Name',
      playlistsCreated: 10,
    });
  };

  const keys = Array.from({ length: 500 }, (_, i) => ({ name: `key_${i}` }));

  // Baseline - unchunked
  const startUnchunked = performance.now();
  const promises = keys.map(async key => {
    const statsJson = await kvGet(key.name);
    return JSON.parse(statsJson);
  });
  await Promise.all(promises);
  const endUnchunked = performance.now();
  const unchunkedTime = endUnchunked - startUnchunked;

  // Chunked
  const startChunked = performance.now();
  const CHUNK_SIZE = 50;
  for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
    const chunk = keys.slice(i, i + CHUNK_SIZE);
    const chunkPromises = chunk.map(async key => {
      const statsJson = await kvGet(key.name);
      return JSON.parse(statsJson);
    });
    await Promise.all(chunkPromises);
  }
  const endChunked = performance.now();
  const chunkedTime = endChunked - startChunked;

  console.log(`Unchunked: ${unchunkedTime.toFixed(2)}ms`);
  console.log(`Chunked: ${chunkedTime.toFixed(2)}ms`);
});
