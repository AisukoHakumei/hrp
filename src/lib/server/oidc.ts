import { config } from './config.js';
import { createLogger } from './logger.js';

const log = createLogger('oidc');

interface OidcEndpoints {
	authorization_endpoint: string;
	token_endpoint: string;
	userinfo_endpoint: string;
}

interface TokenResponse {
	access_token: string;
	id_token?: string;
}

let cachedEndpoints: OidcEndpoints | null = null;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
	try {
		const parts = token.split('.');
		if (parts.length !== 3) return null;
		return JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as Record<string, unknown>;
	} catch {
		return null;
	}
}

export async function discoverOidcEndpoints(issuerUrl: string): Promise<OidcEndpoints> {
	if (cachedEndpoints) return cachedEndpoints;

	const discoveryUrl = `${issuerUrl.replace(/\/$/, '')}/.well-known/openid-configuration`;
	log.info({ discoveryUrl }, 'Discovering OIDC endpoints');

	const res = await fetch(discoveryUrl);
	if (!res.ok) {
		throw new Error(`OIDC Discovery failed: ${res.status} ${res.statusText}`);
	}

	const data = (await res.json()) as Record<string, unknown>;
	const authorization_endpoint = String(data.authorization_endpoint ?? '');
	const token_endpoint = String(data.token_endpoint ?? '');
	const userinfo_endpoint = String(data.userinfo_endpoint ?? '');

	if (!authorization_endpoint || !token_endpoint) {
		throw new Error('OIDC Discovery response missing authorization or token endpoint');
	}

	cachedEndpoints = {
		authorization_endpoint,
		token_endpoint,
		userinfo_endpoint
	};

	return cachedEndpoints;
}

export async function getOidcEndpoints(): Promise<OidcEndpoints> {
	if (config.oidc.authorizationUrl && config.oidc.tokenUrl) {
		return {
			authorization_endpoint: config.oidc.authorizationUrl,
			token_endpoint: config.oidc.tokenUrl,
			userinfo_endpoint: config.oidc.userinfoUrl
		};
	}

	return discoverOidcEndpoints(config.oidc.issuer);
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
	const endpoints = await getOidcEndpoints();

	const params = new URLSearchParams({
		grant_type: 'authorization_code',
		code,
		redirect_uri: redirectUri,
		client_id: config.oidc.clientId,
		client_secret: config.oidc.clientSecret
	});

	const res = await fetch(endpoints.token_endpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Accept: 'application/json'
		},
		body: params.toString()
	});

	if (!res.ok) {
		const body = await res.text();
		log.error({ status: res.status, body }, 'Token exchange failed');
		throw new Error(`Token exchange failed: ${res.status}`);
	}

	const contentType = res.headers.get('content-type') ?? '';
	if (contentType.includes('application/json')) {
		const json = (await res.json()) as Record<string, unknown>;
		return {
			access_token: String(json.access_token ?? ''),
			id_token: typeof json.id_token === 'string' ? json.id_token : undefined
		};
	}

	const text = await res.text();
	const parsed = new URLSearchParams(text);
	return {
		access_token: parsed.get('access_token') ?? '',
		id_token: parsed.get('id_token') ?? undefined
	};
}

export function extractEmailFromIdToken(idToken: string): string | null {
	const payload = decodeJwtPayload(idToken);
	if (!payload) return null;

	return typeof payload.email === 'string' ? payload.email : null;
}

export async function fetchUserinfoEmail(accessToken: string, userinfoUrl: string): Promise<string | null> {
	if (!userinfoUrl) return null;

	const res = await fetch(userinfoUrl, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});

	if (!res.ok) return null;

	const data = (await res.json()) as Record<string, unknown>;
	if (typeof data.email === 'string' && data.email.length > 0) {
		return data.email;
	}

	if (userinfoUrl.includes('api.github.com')) {
		try {
			const emailsRes = await fetch('https://api.github.com/user/emails', {
				headers: {
					Authorization: `Bearer ${accessToken}`,
					Accept: 'application/json'
				}
			});
			if (emailsRes.ok) {
				const emails = (await emailsRes.json()) as Array<{
					email?: string;
					primary?: boolean;
					verified?: boolean;
				}>;
				const primary = emails.find((entry) => entry.primary && entry.verified && entry.email);
				return primary?.email ?? emails.find((entry) => entry.email)?.email ?? null;
			}
		} catch {
			return null;
		}
	}

	return null;
}

export async function getOidcUserEmail(
	code: string,
	redirectUri: string
): Promise<{ email: string; sub: string }> {
	const tokens = await exchangeCodeForTokens(code, redirectUri);

	let email: string | null = null;
	let sub: string | null = null;

	if (tokens.id_token) {
		email = extractEmailFromIdToken(tokens.id_token);
		const payload = decodeJwtPayload(tokens.id_token);
		if (payload && typeof payload.sub === 'string') {
			sub = payload.sub;
		}
	}

	if (!email) {
		const endpoints = await getOidcEndpoints();
		if (endpoints.userinfo_endpoint) {
			email = await fetchUserinfoEmail(tokens.access_token, endpoints.userinfo_endpoint);

			if (!sub) {
				try {
					const res = await fetch(endpoints.userinfo_endpoint, {
						headers: { Authorization: `Bearer ${tokens.access_token}` }
					});
					if (res.ok) {
						const data = (await res.json()) as Record<string, unknown>;
						if (typeof data.sub === 'string') {
							sub = data.sub;
						} else if (typeof data.id === 'string' || typeof data.id === 'number') {
							sub = String(data.id);
						}
					}
				} catch {
					sub = null;
				}
			}
		}
	}

	if (!tokens.access_token) {
		throw new Error('OIDC token response missing access token');
	}

	if (!email) {
		throw new Error('Could not extract email from OIDC response');
	}

	return { email, sub: sub ?? email };
}
