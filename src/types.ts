// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Env {
  SESSIONS: KVNamespace;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
  ALLOWED_GITHUB_USERS?: string;
  SPOTIFY_ONLY_AUTH?: string; // "true" to skip GitHub auth
}

interface UserRegistration {
  spotifyId: string;
  spotifyName: string;
  spotifyAvatar?: string;
  githubUser?: string;
  registeredAt: string;
  lastSeenAt: string;
}
