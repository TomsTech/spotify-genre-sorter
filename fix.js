const fs = require('fs');
const content = fs.readFileSync('src/routes/api.ts', 'utf8');

// session.spotifyAccessToken is possibly undefined because of type definitions in getCurrentUser/session
// let's explicitly enforce it's a string, or throw early if not.
// At line 778, there is a check:
// const session = await getSession(c);
// if (!session?.spotifyAccessToken) {
//   return c.json({ error: 'Not authenticated' }, 401);
// }
// However, TypeScript might still complain if we use session.spotifyAccessToken deep inside an async callback without re-checking or storing it.
