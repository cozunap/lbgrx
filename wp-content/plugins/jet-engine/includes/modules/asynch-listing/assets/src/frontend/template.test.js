import { buildTemplateEntry } from './template'
import { mountItems } from './ui'

function createConfig( templateHash, itemTag, templateHtml = '<span>{{ title }}</span>' ) {
	return {
		template: {
			template_hash: templateHash,
			template_html: templateHtml,
			bindings: [],
		},
		layout: {
			item_tag: itemTag,
		},
	}
}

function getItemTag( entry ) {
	return entry.template.content.querySelector( '.jet-listing-grid__item' ).tagName.toLowerCase()
}

function createRoot() {
	const root = document.createElement( 'div' )

	root.innerHTML = '<div data-jet-asynch-items></div>'

	return root
}

function createUrlConfig( hash, value, paths, attribute = 'href' ) {
	const config = createConfig( hash, 'div', '<a ' + attribute + '="' + value + '">Link</a>' )

	config.template.bindings = paths.map( ( path ) => ( {
		kind: 'url', path, attribute_name: attribute, occurrence_index: 0,
	} ) )

	return config
}

describe( 'URL binding application', () => {
	it.each( [ 'href', 'src', 'action', 'poster', 'data-url' ] )( 'rejects an assembled executable %s', ( attribute ) => {
		const root = createRoot()
		const config = createUrlConfig( 'composed-' + attribute, '{{scheme}}:{{payload}}', [ 'scheme', 'payload' ], attribute )

		mountItems( root, config, [ { scheme: 'javascript', payload: 'alert(1)' } ] )

		expect( root.querySelector( 'a' ).hasAttribute( attribute ) ).toBe( false )
	} )

	it.each( [
		[ '{{url}}', { url: 'javascript:alert(1)' }, [ 'url' ] ],
		[ '{{first}}{{second}}', { first: 'java', second: 'script:alert(1)' }, [ 'first', 'second' ] ],
		[ '{{scheme}}:{{payload}}', { scheme: 'JaVa\nScRiPt', payload: 'alert(1)' }, [ 'scheme', 'payload' ] ],
		[ '{{scheme}}:{{payload}}', { scheme: 'data', payload: 'text/html,<script>alert(1)</script>' }, [ 'scheme', 'payload' ] ],
		[ '/{{path}}', { path: '/example.test/path' }, [ 'path' ] ],
	] )( 'rejects unsafe final URL %s with %j', ( value, item, paths ) => {
		const root = createRoot()
		const config = createUrlConfig( 'unsafe-' + value + JSON.stringify( item ), value, paths )

		mountItems( root, config, [ item ] )

		expect( root.querySelector( 'a' ).hasAttribute( 'href' ) ).toBe( false )
	} )

	it.each( [
		[ '{{url}}', { url: 'http://example.test/path' }, [ 'url' ], 'http://example.test/path' ],
		[ '{{url}}', { url: 'https://example.test/path' }, [ 'url' ], 'https://example.test/path' ],
		[ '{{url}}', { url: 'mailto:user@example.test' }, [ 'url' ], 'mailto:user@example.test' ],
		[ '{{url}}', { url: 'tel:+123456789' }, [ 'url' ], 'tel:+123456789' ],
		[ '{{url}}', { url: '../path?q=1#section' }, [ 'url' ], '../path?q=1#section' ],
		[ '{{url}}', { url: '#section' }, [ 'url' ], '#section' ],
		[ '{{scheme}}://{{host}}/{{path}}', { scheme: 'https', host: 'example.test', path: 'page' }, [ 'scheme', 'host', 'path' ], 'https://example.test/page' ],
		[ '{{prefix}}{{path}}', { prefix: 'https://example.test/items/', path: 'one' }, [ 'prefix', 'path' ], 'https://example.test/items/one' ],
		[ '/{{path}}?q={{query}}', { path: 'search', query: 'label:value' }, [ 'path', 'query' ], '/search?q=label:value' ],
		[ '?q={{first}}{{second}}', { first: 'two ', second: 'words' }, [ 'first', 'second' ], '?q=two words' ],
	] )( 'preserves safe final URL %s with %j', ( value, item, paths, expected ) => {
		const root = createRoot()
		const config = createUrlConfig( 'safe-' + value + JSON.stringify( item ), value, paths )

		mountItems( root, config, [ item ] )

		expect( root.querySelector( 'a' ).getAttribute( 'href' ) ).toBe( expected )
	} )

	it.each( [ true, false ] )( 'isolates cached items and remounts with authoritative metadata: %s', ( authoritative ) => {
		const root = createRoot()
		const config = createUrlConfig( 'url-remount-' + authoritative, '{{scheme}}:{{payload}}', [ 'scheme', 'payload' ] )
		const safe = { scheme: 'https', payload: '//example.test/path' }
		const unsafe = { scheme: 'javascript', payload: 'alert(1)' }

		if ( ! authoritative ) {
			config.template.bindings = []
		}

		mountItems( root, config, [ safe, unsafe ] )
		expect( Array.from( root.querySelectorAll( 'a' ), ( link ) => link.getAttribute( 'href' ) ) ).toEqual( [ 'https://example.test/path', null ] )

		mountItems( root, config, [ unsafe, safe ] )
		expect( Array.from( root.querySelectorAll( 'a' ), ( link ) => link.getAttribute( 'href' ) ) ).toEqual( [ null, 'https://example.test/path' ] )
	} )
} )

describe( 'buildTemplateEntry', () => {
	it( 'partitions cached template fragments by normalized item tag in either initialization order', () => {
		[ [ 'div', 'li' ], [ 'li', 'div' ] ].forEach( ( tags, index ) => {
			const templateHash = 'item-tag-cache-' + index
			const first = buildTemplateEntry( createConfig( templateHash, tags[ 0 ] ) )
			const second = buildTemplateEntry( createConfig( templateHash, tags[ 1 ] ) )

			expect( first ).not.toBe( second )
			expect( getItemTag( first ) ).toBe( tags[ 0 ] )
			expect( getItemTag( second ) ).toBe( tags[ 1 ] )
			expect( buildTemplateEntry( createConfig( templateHash, tags[ 0 ].toUpperCase() ) ) ).toBe( first )
		} )
	} )

	it( 'mounts Twig artifacts independently when multiple listings share a page', () => {
		const firstRoot = createRoot()
		const secondRoot = createRoot()
		const twigTemplate = '<a href="{{ url }}" title="{{ title }}"><img src="{{ image }}" alt="{{ title }}"><span>{{ title }}</span></a>'
		const firstConfig = createConfig( 'twig-shared-template', 'div', twigTemplate )
		const secondConfig = createConfig( 'twig-shared-template', 'li', twigTemplate )
		const thirdConfig = createConfig( 'twig-different-template', 'div' )

		firstConfig.template.view = 'twig'
		secondConfig.template.view = 'twig'
		thirdConfig.template.view = 'twig'
		thirdConfig.template.template_html = '<strong>{{ title }}</strong>'

		mountItems( firstRoot, firstConfig, [ { title: 'First Twig item', url: 'https://example.test/first', image: 'https://example.test/first.jpg' } ] )
		mountItems( secondRoot, secondConfig, [ { title: 'Second Twig item', url: 'https://example.test/second', image: 'https://example.test/second.jpg' } ] )

		expect( firstRoot.querySelector( '.jet-listing-grid__item' ).tagName.toLowerCase() ).toBe( 'div' )
		expect( firstRoot.textContent ).toContain( 'First Twig item' )
		expect( firstRoot.querySelector( 'a' ).getAttribute( 'href' ) ).toBe( 'https://example.test/first' )
		expect( firstRoot.querySelector( 'img' ).getAttribute( 'src' ) ).toBe( 'https://example.test/first.jpg' )
		expect( firstRoot.querySelector( 'img' ).getAttribute( 'alt' ) ).toBe( 'First Twig item' )
		expect( secondRoot.querySelector( '.jet-listing-grid__item' ).tagName.toLowerCase() ).toBe( 'li' )
		expect( secondRoot.textContent ).toContain( 'Second Twig item' )
		expect( secondRoot.querySelector( 'a' ).getAttribute( 'href' ) ).toBe( 'https://example.test/second' )
		expect( secondRoot.querySelector( 'img' ).getAttribute( 'src' ) ).toBe( 'https://example.test/second.jpg' )
		expect( secondRoot.querySelector( 'img' ).getAttribute( 'alt' ) ).toBe( 'Second Twig item' )

		mountItems( secondRoot, thirdConfig, [ { title: 'Different Twig item' } ] )

		expect( secondRoot.textContent ).toContain( 'Different Twig item' )
		expect( secondRoot.querySelector( 'strong' ) ).not.toBeNull()
	} )

	it( 'normalizes encoded safe-attribute placeholders before authoritative binding matching', () => {
		const root = createRoot()
		const config = createConfig(
			'encoded-safe-attributes',
			'div',
			'<a href="{{%20url%20}}" title="%7B%7B%20title%20%7D%7D" data-label="{{ title }}" onclick="{{%20title%20}}">{{ title }}</a>'
		)

		config.template.bindings = [
			{ kind: 'url', path: 'url', attribute_name: 'href', occurrence_index: 0 },
			{ kind: 'attribute', path: 'title', attribute_name: 'title', occurrence_index: 0 },
			{ kind: 'attribute', path: 'title', attribute_name: 'data-label', occurrence_index: 1 },
			{ kind: 'text', path: 'title', occurrence_index: 2 },
		]

		mountItems( root, config, [ { url: 'https://example.test/image.jpg', title: '<em>Safe text</em>' } ] )

		const link = root.querySelector( 'a' )

		expect( link.getAttribute( 'href' ) ).toBe( 'https://example.test/image.jpg' )
		expect( link.getAttribute( 'title' ) ).toBe( '<em>Safe text</em>' )
		expect( link.getAttribute( 'data-label' ) ).toBe( '<em>Safe text</em>' )
		expect( link.textContent ).toBe( '<em>Safe text</em>' )
		expect( link.getAttribute( 'onclick' ) ).toBe( '{{%20title%20}}' )
		expect( link.querySelector( 'em' ) ).toBeNull()
	} )

	it( 'keeps URL sanitization after compatibility normalization', () => {
		const root = createRoot()
		const config = createConfig( 'encoded-url-sanitization', 'div', '<a href="{{%20url%20}}">Link</a>' )

		config.template.bindings = [ { kind: 'url', path: 'url', attribute_name: 'href', occurrence_index: 0 } ]

		mountItems( root, config, [ { url: 'javascript:alert(1)' } ] )

		expect( root.querySelector( 'a' ).hasAttribute( 'href' ) ).toBe( false )
	} )
} )
