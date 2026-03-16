import { env } from '$env/dynamic/private';

export const config = {
	// Database
	databasePath: env.DATABASE_PATH ?? './data/hrp.db',

	// File storage
	uploadDir: env.UPLOAD_DIR ?? './uploads',
	backupDir: env.BACKUP_DIR ?? './data/backups',
	maxUploadMb: Number(env.MAX_UPLOAD_MB ?? '50'),

	// Auth
	authSecret: env.AUTH_SECRET ?? 'dev-secret-change-me',
	sessionMaxAge: 30 * 24 * 60 * 60, // 30 days in seconds

	// OIDC / OAuth2 (optional - set OIDC_ISSUER to enable)
	oidc: {
		providerName: env.OIDC_PROVIDER_NAME ?? 'SSO',
		issuer: env.OIDC_ISSUER ?? '',
		clientId: env.OIDC_CLIENT_ID ?? '',
		clientSecret: env.OIDC_CLIENT_SECRET ?? '',
		scopes: env.OIDC_SCOPES ?? 'openid email profile',
		authorizationUrl: env.OIDC_AUTHORIZATION_URL ?? '',
		tokenUrl: env.OIDC_TOKEN_URL ?? '',
		userinfoUrl: env.OIDC_USERINFO_URL ?? ''
	},

	// Logging
	logLevel: (env.LOG_LEVEL ?? 'info') as 'debug' | 'info' | 'warn' | 'error',

	// Locale
	defaultLocale: (env.DEFAULT_LOCALE ?? 'en') as 'en' | 'fr',

	// Derived
	get isProduction() {
		return env.NODE_ENV === 'production';
	},
	get hasOidc() {
		return !!this.oidc.issuer && !!this.oidc.clientId && !!this.oidc.clientSecret;
	}
} as const;
