async function submit() {
  try {
    const res = await fetch('http://localhost:3000/v0/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        branch_name: 'test/get-all-liked-tracks',
        commit_message: 'test: add tests for getAllLikedTracks',
        title: '🧪 [testing improvement] Add tests for getAllLikedTracks',
        description: '🎯 **What:** Addressed the testing gap for getAllLikedTracks in src/lib/spotify.ts.\n📊 **Coverage:** Now tests fetching a single page, multiple pages with parallel batching and order preservation, respecting maxTracks limits, and handling empty library responses.\n✨ **Result:** Test coverage improved for the spotify library module.'
      })
    });
    console.log(await res.text());
  } catch (e) {
    console.log(e);
  }
}
submit();
