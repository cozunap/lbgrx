import ctEvents from 'ct-events'
import { getRootSelectorFor, assembleSelector } from 'blocksy-customizer-sync'

ctEvents.on(
	'ct:header:sync:collect-variable-descriptors',
	(variableDescriptors) => {
		variableDescriptors['content-block'] = ({ itemId }) => ({
			margin: {
				selector: assembleSelector(
					getRootSelectorFor({ itemId, panelType: 'header' })
				),
				type: 'spacing',
				variable: 'margin',
				responsive: true,
				important: true,
			},
		})
	}
)

ctEvents.on(
	'ct:header:sync:item:content-block',
	({ itemId, optionId, optionValue }) => {
		if (optionId === 'content_width') {
			document
				.querySelectorAll(`[data-id="${itemId}"]`)
				.forEach((contentBlock) => {
					contentBlock.dataset.contentWidth = optionValue
				})
		}
	}
)
