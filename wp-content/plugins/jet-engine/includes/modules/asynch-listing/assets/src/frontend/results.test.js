import { normalizeDirectResult, normalizeProxyResult } from './results'

describe( 'Async Listing result normalization', () => {
	it( 'accepts object items and rejects scalar proxy items', () => {
		const validResult = normalizeProxyResult(
			{ ok: true },
			{ success: true, data: [ { id: 1 }, { title: 'Example' } ] }
		)
		const invalidResult = normalizeProxyResult(
			{ ok: true },
			{ success: true, data: [ { id: 1 }, 'invalid' ] }
		)

		expect( validResult.success ).toBe( true )
		expect( invalidResult ).toMatchObject( {
			success: false,
			data: [],
			error: { code: 'items_not_objects' },
		} )
	} )

	it( 'rejects scalar direct-response items after resolving the configured path', () => {
		const result = normalizeDirectResult(
			{ ok: true, headers: { get: () => null } },
			{ data: [ { id: 1 }, 2 ] },
			{ items_path: 'data' }
		)

		expect( result ).toMatchObject( {
			success: false,
			data: [],
			error: { code: 'items_not_objects' },
		} )
	} )

	it( 'accepts usable Gato items despite unrelated GraphQL errors', () => {
		const config = {
			items_path: 'data.posts',
			error_path: 'errors',
			error_code: 'graphql_errors',
			allow_partial_response: true,
		}
		const response = { ok: true, headers: { get: () => null } }
		const validResult = normalizeDirectResult(
			response,
			{
				data: { posts: [ { id: 1 } ] },
				errors: [ { message: 'An unrelated field failed.' } ],
			},
			config
		)
		const emptyResult = normalizeDirectResult(
			response,
			{
				data: { posts: [] },
				errors: [ { message: 'An unrelated field failed.' } ],
			},
			config
		)
		const missingResult = normalizeDirectResult(
			response,
			{ data: {}, errors: [ { message: 'Posts failed.' } ] },
			config
		)
		const invalidResult = normalizeDirectResult(
			response,
			{ data: { posts: [ 1 ] }, errors: [ { message: 'Posts failed.' } ] },
			config
		)
		const genericResult = normalizeDirectResult(
			response,
			{ data: { posts: [ { id: 1 } ] }, errors: [ { message: 'Source failed.' } ] },
			Object.assign( {}, config, { allow_partial_response: false } )
		)

		expect( validResult ).toMatchObject( { success: true, data: [ { id: 1 } ] } )
		expect( emptyResult ).toMatchObject( { success: true, data: [] } )
		expect( missingResult.error ).toMatchObject( { code: 'graphql_errors' } )
		expect( invalidResult.error ).toMatchObject( { code: 'items_not_objects' } )
		expect( genericResult.error ).toMatchObject( { code: 'graphql_errors' } )
	} )
} )
