import {
	createElement,
	createInterpolateElement,
	Fragment,
	useCallback,
	useEffect,
	useRef,
	useState
} from '@wordpress/element'
import { __ } from 'ct-i18n'
import { OptionsPanel, Overlay } from 'blocksy-options'

const FiltersCrawlNotice = ({ data, onVisibilityChange }) => {
	const [result, setResult] = useState(null)
	const [isOpen, setIsOpen] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [copyStatus, setCopyStatus] = useState(null)
	const copyTimeout = useRef(null)
	const request = useRef(null)
	const rulesField = useRef(null)
	const statusHeading = useRef(null)
	const setStatusHeading = useCallback((node) => {
		statusHeading.current = node
		node?.focus()
	}, [])
	const isVisible =
		!!result &&
		result.status !== 'disabled' &&
		(result.status !== 'protected' || isOpen)

	const checkStatus = async () => {
		request.current?.abort()
		const controller = new AbortController()
		request.current = controller
		setIsLoading(true)
		clearTimeout(copyTimeout.current)
		setCopyStatus(null)

		const body = new FormData()
		body.append('action', 'blocksy_filters_crawl_status')
		body.append('nonce', ctDashboardLocalizations.dashboard_actions_nonce)

		try {
			const response = await fetch(ctDashboardLocalizations.ajax_url, {
				method: 'POST',
				body,
				signal: controller.signal
			})
			const payload = await response.json()

			if (!response.ok || !payload.success) {
				throw new Error()
			}

			setResult(payload.data)
		} catch (error) {
			if (!controller.signal.aborted) {
				setResult({ status: 'unavailable' })
			}
		} finally {
			if (!controller.signal.aborted) {
				setIsLoading(false)
			}
		}
	}

	const copyRules = async ({ currentTarget }) => {
		clearTimeout(copyTimeout.current)

		try {
			if (navigator.clipboard && window.isSecureContext) {
				await navigator.clipboard.writeText(result.rules)
			} else {
				rulesField.current.focus()
				rulesField.current.select()

				if (!document.execCommand('copy')) {
					throw new Error()
				}
			}

			if (!currentTarget.isConnected) {
				return
			}

			currentTarget.focus()
			setCopyStatus('copied')
			copyTimeout.current = setTimeout(() => setCopyStatus(null), 3000)
		} catch (error) {
			if (!currentTarget.isConnected) {
				return
			}

			rulesField.current?.focus()
			rulesField.current?.select()
			setCopyStatus('error')
		}
	}

	useEffect(() => {
		setCopyStatus(null)
		return () => clearTimeout(copyTimeout.current)
	}, [isOpen])

	useEffect(() => {
		checkStatus()
		return () => request.current?.abort()
	}, [data])

	useEffect(() => {
		if (isOpen && result?.status === 'protected') {
			statusHeading.current?.focus()
		}
	}, [result, isOpen])

	useEffect(() => {
		onVisibilityChange(isVisible)
		return () => onVisibilityChange(false)
	}, [isVisible, onVisibilityChange])

	if (!isVisible) {
		return null
	}

	const label =
		result.status === 'missing'
			? __('Product filter crawling needs attention!', 'blocksy-companion')
			: __('Unable to check filter crawling', 'blocksy-companion')

	return (
		<Fragment>
			{result.status !== 'protected' && (
				<a
					href="#"
					className="ct-filters-crawl-notice"
					aria-label={label}
					title={label}
					aria-haspopup="dialog"
					onClick={(event) => {
						event.preventDefault()
						setIsOpen(true)
					}}
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="currentColor"
						aria-hidden="true"
					>
						<path d="M0 0h24v24H0z" fill="none" />
						<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
					</svg>
					<span>{label}</span>
				</a>
			)}
			<Overlay
				items={isOpen}
				className="ct-filters-crawl-modal"
				onDismiss={() => setIsOpen(false)}
				render={() => (
					<div className="ct-modal-content">
						<h2 ref={setStatusHeading} tabIndex={-1}>
							{__('Product Filter Crawling', 'blocksy-companion')}
						</h2>
						<div className="ct-modal-scroll" aria-live="polite">
							{result.status === 'protected' ? (
								<p>
									{__(
										'The filter crawling rules are present in your robots.txt file. No further action is needed.',
										'blocksy-companion'
									)}
								</p>
							) : result.status === 'unavailable' ? (
								<p>
									{__(
										'We could not read your public robots.txt file. This can happen if your server blocks the check or the request times out. Try again, or ask your hosting provider to check that the file is accessible.',
										'blocksy-companion'
									)}
								</p>
							) : (
								<Fragment>
									<p>
										{__(
											'Blocksy automatically asks search engines not to crawl product filter combinations, which can create many URLs and increase server load.',
											'blocksy-companion'
										)}
									</p>
									<p>
										{createInterpolateElement(
											__(
												'Some of these rules are missing from your <a>robots.txt file ↗</a>.',
												'blocksy-companion'
											),
											{
												a: (
													<a
														href={result.url}
														target="_blank"
														rel="noopener noreferrer"
													/>
												)
											}
										)}
										<br/>
										{__(
											'To fix this, please follow the steps below:',
											'blocksy-companion'
										)}
									</p>
									<p>
									<ol>
										<li>
											{__(
												'Copy the rules below and add them to the end of your robots.txt file.',
												'blocksy-companion'
											)}
										</li>
										<li>
											{__(
												'Save the file, then click “Check again”.',
												'blocksy-companion'
											)}
										</li>
									</ol>
									</p>
									<div className="ct-filters-crawl-rules">
										<OptionsPanel
											options={{
												rules: {
													type: 'textarea',
													design: 'none',
													attr: {
														'data-resize':
															'resize-y'
													},
													field_attr: {
														ref: rulesField,
														'aria-label': __(
															'Missing robots.txt rules',
															'blocksy-companion'
														),
														readOnly: true,
														rows: 8,
														onFocus: ({ target }) =>
															target.select()
													}
												}
											}}
											value={{ rules: result.rules }}
											onChange={() => {}}
										/>
										<button
											type="button"
											className="ct-filters-crawl-copy"
											aria-label={__(
												'Copy rules',
												'blocksy-companion'
											)}
											title={__(
												'Copy rules',
												'blocksy-companion'
											)}
											onClick={copyRules}
										>
											<span role="status">
												{copyStatus === 'copied' &&
													__(
														'Rules copied!',
														'blocksy-companion'
													)}
											</span>
											{copyStatus !== 'copied' && (
												<svg
													width="12"
													height="12"
													viewBox="0 0 24 24"
													fill="currentColor"
													aria-hidden="true"
												>
													<path d="M20.7 7.6h-9.8c-1.8 0-3.3 1.5-3.3 3.3v9.8c0 1.8 1.5 3.3 3.3 3.3h9.8c1.8 0 3.3-1.5 3.3-3.3v-9.8c0-1.8-1.5-3.3-3.3-3.3zm1.1 13.1c0 .6-.5 1.1-1.1 1.1h-9.8c-.6 0-1.1-.5-1.1-1.1v-9.8c0-.6.5-1.1 1.1-1.1h9.8c.6 0 1.1.5 1.1 1.1v9.8zM5.5 15.3c0 .6-.5 1.1-1.1 1.1H3.3c-1.8 0-3.3-1.5-3.3-3.3V3.3C0 1.5 1.5 0 3.3 0h9.8c1.8 0 3.3 1.5 3.3 3.3v1.1c0 .6-.5 1.1-1.1 1.1-.6 0-1.1-.5-1.1-1.1V3.3c0-.6-.5-1.1-1.1-1.1H3.3c-.6 0-1.1.5-1.1 1.1v9.8c0 .6.5 1.1 1.1 1.1h1.1c.6 0 1.1.5 1.1 1.1z" />
												</svg>
											)}
										</button>
									</div>
								</Fragment>
							)}
							{copyStatus === 'error' && (
								<p role="status">
									{__(
										'Select the rules and copy them with your keyboard.',
										'blocksy-companion'
									)}
								</p>
							)}
						</div>
						<div className="ct-modal-actions has-divider">
							<button
								type="button"
								className="button"
								disabled={isLoading}
								onClick={
									result.status === 'protected'
										? () => setIsOpen(false)
										: checkStatus
								}
							>
								{isLoading
									? __('Checking…', 'blocksy-companion')
									: result.status === 'protected'
										? __('Got it, back to dashboard', 'blocksy-companion')
										: __('Check again', 'blocksy-companion')}
							</button>
						</div>
					</div>
				)}
			/>
		</Fragment>
	)
}

export default FiltersCrawlNotice
