
export async function pMap<T, R>(
  iterable: Iterable<T>,
  mapper: (item: T, index: number) => Promise<R>,
  { concurrency = 3 }: { concurrency?: number } = {}
): Promise<R[]> {
  const results: R[] = [];
  const iterator = iterable[Symbol.iterator]();
  let index = 0;

  const workers = Array.from({ length: concurrency }, async () => {
    while (iterator) {
      const { value, done } = iterator.next() as { value: T, done: boolean };
      if (done) break;
      const currentIndex = index++;
      results[currentIndex] = await mapper(value, currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}
