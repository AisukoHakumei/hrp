import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	// eslint-disable-next-line -- dual vite version (v7 direct + v5 via vitest) causes plugin type mismatch
	plugins: [tailwindcss(), sveltekit()] as never[],
	test: {
		include: ['tests/unit/**/*.{test,spec}.{js,ts}'],
		environment: 'node'
	}
});
