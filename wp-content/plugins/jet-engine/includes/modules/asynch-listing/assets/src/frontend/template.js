import { reservedSegments, tokenPattern } from './constants'
import { resolvePath, sanitizeUrl } from './paths'

const templateCache = new Map()

function getTemplateCacheKey( templateHash, itemTag ) {
	// The parsed fragment includes the item wrapper, so every markup-shaping input belongs here.
	return JSON.stringify( [ String( templateHash ), String( itemTag ) ] )
}

function isSafeAttribute( attributeName ) {
	attributeName = String( attributeName || '' ).toLowerCase()

	if ( [ 'style', 'class' ].indexOf( attributeName ) !== -1 ) {
		return false
	}

	if ( 0 === attributeName.indexOf( 'on' ) ) {
		return false
	}

	if ( [ 'href', 'src', 'action', 'poster', 'data-url' ].indexOf( attributeName ) !== -1 ) {
		return true
	}

	if ( [ 'alt', 'title', 'aria-label', 'aria-describedby', 'placeholder' ].indexOf( attributeName ) !== -1 ) {
		return true
	}

	return 0 === attributeName.indexOf( 'data-' )
}

function getAttributeKind( attributeName ) {
	attributeName = String( attributeName || '' ).toLowerCase()

	if ( [ 'href', 'src', 'action', 'poster', 'data-url' ].indexOf( attributeName ) !== -1 ) {
		return 'url'
	}

	return isSafeAttribute( attributeName ) ? 'attribute' : false
}

function createBindingKey( kind, path, attributeName, occurrenceIndex ) {
	return [
		String( kind || 'text' ),
		String( path || '' ),
		String( attributeName || '' ),
		parseInt( occurrenceIndex || 0, 10 ),
	].join( '::' )
}

function isValidPlaceholderPath( path ) {
	const segments = String( path || '' ).split( '.' )
	let i

	if ( ! segments.length || String( path || '' ).length > 200 || segments.length > 20 ) {
		return false
	}

	for ( i = 0; i < segments.length; i++ ) {
		if (
			! /^(?:[A-Za-z_][A-Za-z0-9_:]*|\d+)$/.test( segments[ i ] )
			|| reservedSegments[ String( segments[ i ] ).toLowerCase() ]
		) {
			return false
		}
	}

	return true
}

function normalizeTemplateValue( templateValue, kind ) {
	let decoded
	let match
	let path

	if ( 'text' === kind || ! templateValue ) {
		return templateValue
	}

	// Only decode a whole placeholder candidate; URLs and mixed attribute values are literals.
	if ( -1 === templateValue.indexOf( '{{' ) && ! /%7B%7B/i.test( templateValue ) ) {
		return templateValue
	}

	if ( /%(?![A-Fa-f0-9]{2})/.test( templateValue ) ) {
		return templateValue
	}

	try {
		decoded = decodeURIComponent( templateValue )
	} catch ( error ) {
		return templateValue
	}

	match = /^\{\{\s*([^{}]+?)\s*\}\}$/.exec( decoded )
	path = match ? match[ 1 ].trim().replace( /\s*\.\s*/g, '.' ) : ''

	if ( ! match || ! isValidPlaceholderPath( path ) ) {
		return templateValue
	}

	return '{{' + path + '}}'
}

function collectTargetTokens( templateValue, kind, attributeName, pathCounters ) {
	const tokens = []
	let match
	let path
	let key

	tokenPattern.lastIndex = 0;

	while ( ( match = tokenPattern.exec( templateValue ) ) ) {
		path = match[ 1 ]
		pathCounters[ path ] = pathCounters[ path ] || 0
		key = createBindingKey( kind, path, attributeName, pathCounters[ path ] )

		tokens.push( {
			fullMatch: match[ 0 ],
			path: path,
			start: match.index,
			end: match.index + match[ 0 ].length,
			occurrenceIndex: pathCounters[ path ],
			bindingKey: key,
		} )

		pathCounters[ path ]++
	}

	return tokens
}

function createTarget( kind, nodePath, templateValue, attributeName, pathCounters ) {
	templateValue = normalizeTemplateValue( templateValue, kind )

	const tokens = collectTargetTokens( templateValue, kind, attributeName, pathCounters );

	if ( ! tokens.length ) {
		return null
	}

	return {
		kind: kind,
		nodePath: nodePath.slice(),
		attributeName: attributeName || '',
		templateValue: templateValue,
		tokens: tokens,
		allowedKeys: null,
	}
}

function walkTemplateTargets( node, nodePath, targets, pathCounters ) {
	let i
	let child
	let attribute
	let target

	if ( ! node ) {
		return
	}

	if ( node.nodeType === Node.TEXT_NODE ) {
		target = createTarget( 'text', nodePath, node.nodeValue, '', pathCounters )

		if ( target ) {
			targets.push( target );
		}

		return
	}

	if ( node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE ) {
		return
	}

	if ( node.attributes ) {
		for ( i = 0; i < node.attributes.length; i++ ) {
			attribute = node.attributes[ i ]

			if ( ! isSafeAttribute( attribute.name ) ) {
				continue
			}

			target = createTarget( getAttributeKind( attribute.name ), nodePath, attribute.value, attribute.name, pathCounters )

			if ( target ) {
				targets.push( target );
			}
		}
	}

	for ( i = 0; i < node.childNodes.length; i++ ) {
		child = node.childNodes[ i ]
		walkTemplateTargets( child, nodePath.concat( i ), targets, pathCounters )
	}
}

function getNodeByPath( root, nodePath ) {
	let current = root
	let i

	for ( i = 0; i < nodePath.length; i++ ) {
		if ( ! current || ! current.childNodes || ! current.childNodes[ nodePath[ i ] ] ) {
			return null
		}

		current = current.childNodes[ nodePath[ i ] ]
	}

	return current
}

export function buildTemplateEntry( config ) {
	const templateConfig = config && config.template ? config.template : {}
	const templateHash = templateConfig.template_hash || templateConfig.template_html || 'default'
	const templateHtml = templateConfig.template_html || ''
	const itemTag = config && config.layout && config.layout.item_tag ? String( config.layout.item_tag ).toLowerCase() : 'div'
	const cacheKey = getTemplateCacheKey( templateHash, itemTag )
	const targets = []
	const pathCounters = {}
	const bindings = Array.isArray( templateConfig.bindings ) ? templateConfig.bindings : []
	const bindingKeys = {}
	const authoritative = bindings.length > 0
	let template
	let i
	let j
	let target

	if ( templateCache.has( cacheKey ) ) {
		return templateCache.get( cacheKey )
	}

	template = document.createElement( 'template' )
	template.innerHTML = '<' + itemTag + ' class="jet-listing-grid__item">' + templateHtml + '</' + itemTag + '>'

	walkTemplateTargets( template.content, [], targets, pathCounters );

	for ( i = 0; i < bindings.length; i++ ) {
		bindingKeys[ createBindingKey(
			bindings[ i ].kind,
			bindings[ i ].path,
			bindings[ i ].attribute_name,
			bindings[ i ].occurrence_index
		) ] = true
	}

	for ( i = targets.length - 1; i >= 0; i-- ) {
		target = targets[ i ]

		if ( authoritative ) {
			target.allowedKeys = {}

			for ( j = 0; j < target.tokens.length; j++ ) {
				if ( bindingKeys[ target.tokens[ j ].bindingKey ] ) {
					target.allowedKeys[ target.tokens[ j ].bindingKey ] = true
				}
			}

			if ( ! Object.keys( target.allowedKeys ).length ) {
				targets.splice( i, 1 )
			}
		}
	}

	templateCache.set( cacheKey, {
		template: template,
		targets: targets,
		authoritative: authoritative,
	} )

	return templateCache.get( cacheKey )
}

function renderTargetValue( target, item ) {
	let output = ''
	let cursor = 0
	let i
	let token
	let isAllowed;

	for ( i = 0; i < target.tokens.length; i++ ) {
		token = target.tokens[ i ]
		isAllowed = ! target.allowedKeys || !! target.allowedKeys[ token.bindingKey ]

		output += target.templateValue.slice( cursor, token.start )

		if ( isAllowed ) {
			output += resolvePath( item, token.path, false )
		} else {
			output += token.fullMatch
		}

		cursor = token.end
	}

	output += target.templateValue.slice( cursor )

	return output
}

export function applyTarget( target, root, item ) {
	const node = getNodeByPath( root, target.nodePath )
	let renderedValue

	if ( ! node ) {
		return
	}

	renderedValue = renderTargetValue( target, item )

	if ( 'text' === target.kind ) {
		node.nodeValue = renderedValue
		return
	}

	if ( node.nodeType !== Node.ELEMENT_NODE || ! target.attributeName ) {
		return
	}

	if ( 'url' === target.kind ) {
		// Individually safe fragments can compose an executable URL; validate the complete value.
		renderedValue = sanitizeUrl( renderedValue )

		if ( renderedValue ) {
			node.setAttribute( target.attributeName, renderedValue )
		} else {
			node.removeAttribute( target.attributeName )
		}

		return
	}

	node.setAttribute( target.attributeName, renderedValue )
}
