
import commonjs        from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { terser }      from 'rollup-plugin-terser';

const PLUGIN_IGNORE_WS = {
	load (id) {
		if (id.includes('/node_modules/ws/')) {
			return 'export default self.WebSocket;';
		}
	},
}

export default [
	{
		input: 'src/main.js',
		output: [{
			name: 'extws-client',
			file: 'dist/node/index.js',
			format: 'cjs',
		}],
		plugins: [
			commonjs(),
		],
	},
	{
		input: 'src/main.js',
		output: [{
			name: 'extws-client',
			file: 'dist/browser/extws-client.cjs.js',
			format: 'cjs',
		}],
		plugins: [
			PLUGIN_IGNORE_WS,
			nodeResolve(),
			commonjs(),
		],
		manualChunks (/* id */) {
			// console.log('manualChunks', id);
			return '';
		},
	},
	{
		input: 'src/main.js',
		output: [{
			name: 'extws-client',
			file: 'dist/browser/extws-client.cjs.min.js',
			format: 'cjs',
			plugins: [
				terser(),
			],
		}],
		plugins: [
			PLUGIN_IGNORE_WS,
			nodeResolve(),
			commonjs(),
		],
	},
];
