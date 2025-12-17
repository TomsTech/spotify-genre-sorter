export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
}

export function getGitHubAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user',
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeGitHubCode(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  const data: { access_token?: string; error?: string } = await response.json();
  if (data.error || !data.access_token) {
    throw new Error(data.error || 'Failed to exchange code');
  }
  return data.access_token;
}

export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Spotify-Genre-Organizer',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get GitHub user');
  }

  const data: GitHubUser = await response.json();
  return data;
}

export function isUserAllowed(username: string, allowedUsers: string): boolean {
  if (!allowedUsers || allowedUsers.trim() === '') {
    // Security: If no allowlist configured, default to DENY (not allow all)
    // This prevents accidental exposure if ALLOWED_GITHUB_USERS env var is missing
    return false;
  }
  const allowed = allowedUsers.split(',').map(u => u.trim().toLowerCase());
  return allowed.includes(username.toLowerCase());
}
