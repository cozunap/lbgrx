const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const path = require( 'path' );
const rtlcss = require( 'rtlcss' );
const webpack = require( 'webpack' );

const cssOnly = ( filename ) => path.extname( filename ) === '.css';

class OutputAwareRtlCssPlugin {
	apply( compiler ) {
		compiler.hooks.compilation.tap( 'OutputAwareRtlCssPlugin', ( compilation ) => {
			compilation.hooks.processAssets.tap(
				{
					name: 'OutputAwareRtlCssPlugin',
					stage: compilation.PROCESS_ASSETS_STAGE_OPTIMIZE,
				},
				() => {
					Array.from( compilation.chunks ).forEach( ( chunk ) => {
						Array.from( chunk.files )
							.filter( cssOnly )
							.filter( ( filename ) => ! filename.endsWith( '-rtl.css' ) )
							.forEach( ( filename ) => {
								const source = compilation.assets[ filename ]?.source();

								if ( ! source ) {
									return;
								}

								const rtlFileName = filename.replace( /\.css$/, '-rtl.css' );

								compilation.assets[ rtlFileName ] = new webpack.sources.RawSource( rtlcss.process( source ) );
								chunk.files.add( rtlFileName );
							} );
					} );
				}
			);
		} );
	}
}

const plugins = ( defaultConfig.plugins || [] ).map( ( plugin ) => {
	if ( plugin?.constructor?.name === 'MiniCssExtractPlugin' && plugin.options ) {
		plugin.options.filename = '../css/[name].css';
		plugin.options.chunkFilename = '../css/[name].css';
	}

	if ( plugin?.constructor?.name === 'RtlCssPlugin' ) {
		return new OutputAwareRtlCssPlugin();
	}

	return plugin;
} );

module.exports = {
	...defaultConfig,
	entry: {
		'blocks-editor': path.resolve( __dirname, 'src/blocks-registration.jsx' ),
		frontend: path.resolve( __dirname, 'src/frontend.js' ),
		preview: path.resolve( __dirname, 'src/preview.js' ),
	},
	output: {
		path: path.resolve( __dirname, 'js' ),
		filename: '[name].js',
		clean: false,
	},
	plugins,
	resolve: {
		...defaultConfig.resolve,
		extensions: [ '.jsx', '.js', '.json' ],
	},
};
