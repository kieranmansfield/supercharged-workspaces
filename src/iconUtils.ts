import { App, FuzzySuggestModal, getIconIds, setIcon } from 'obsidian'

// A workspace/folder "icon" field holds either a raw emoji (typed by the
// user) or a built-in Lucide icon id, distinguished by this prefix.
export const LUCIDE_PREFIX = 'lucide:'

export function isLucideIcon(icon: string | undefined): boolean {
	return !!icon && icon.startsWith(LUCIDE_PREFIX)
}

export function renderIcon(el: HTMLElement, icon: string | undefined, fallback: string): void {
	el.empty()
	if (isLucideIcon(icon)) {
		setIcon(el, (icon as string).slice(LUCIDE_PREFIX.length))
		return
	}
	el.setText(icon || fallback)
}

export class IconPickerModal extends FuzzySuggestModal<string> {
	constructor(
		app: App,
		private onPick: (icon: string) => void
	) {
		super(app)
		this.setPlaceholder('Search built-in icons...')
	}

	// Required overrides of FuzzySuggestModal's abstract API, invoked by the
	// framework rather than called directly from this codebase.
	// fallow-ignore-next-line unused-class-member
	getItems(): string[] {
		return getIconIds()
	}

	// fallow-ignore-next-line unused-class-member
	getItemText(iconId: string): string {
		return iconId
	}

	// fallow-ignore-next-line unused-class-member
	renderSuggestion(item: { item: string }, el: HTMLElement): void {
		el.addClass('icon-picker-item')
		const iconEl = el.createSpan({ cls: 'icon-picker-icon' })
		setIcon(iconEl, item.item)
		el.createSpan({ text: item.item, cls: 'icon-picker-label' })
	}

	// fallow-ignore-next-line unused-class-member
	onChooseItem(iconId: string): void {
		this.onPick(`${LUCIDE_PREFIX}${iconId}`)
	}
}
