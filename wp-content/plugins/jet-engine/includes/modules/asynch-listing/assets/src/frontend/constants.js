export const selector = '[data-jet-asynch-listing="true"]'

export const tokenPattern = /\{\{\s*([A-Za-z0-9_:\.]+)\s*\}\}/g

export const reservedSegments = {
	__proto__: true,
	prototype: true,
	constructor: true,
}
