import { App, FuzzySuggestModal, Modal, Notice, Setting } from 'obsidian'
import { WorkspaceConfig, WorkspaceFolder } from './types'
import { WorkspaceManager, CURRENT_LAYOUT } from './WorkspaceManager'
import type SuperchargedWorkspacesPlugin from './main'
import { filterBySmartGroup } from './workspaceFilters'

function addFolderDropdown(
	contentEl: HTMLElement,
	plugin: SuperchargedWorkspacesPlugin,
	label: string,
	currentFolderId: string | undefined,
	onChange: (folderId: string | undefined) => void
) {
	if (!plugin.settings.features.enableBetaFolders) return

	const folders = Object.values(plugin.settings.folders)
	if (folders.length === 0) return

	new Setting(contentEl)
		.setName(label)
		.setDesc('Assign this workspace to a folder')
		.addDropdown((dropdown) => {
			dropdown.addOption('', 'No folder')
			folders.forEach((folder: WorkspaceFolder) => {
				dropdown.addOption(folder.id, folder.name)
			})
			dropdown.setValue(currentFolderId || '')
			dropdown.onChange((value) => {
				onChange(value || undefined)
			})
		})
}

function addIconField(contentEl: HTMLElement, value: string, onChange: (value: string) => void) {
	new Setting(contentEl)
		.setName('Emoji icon (optional)')
		.setDesc('Enter a single emoji to identify this workspace')
		.addText((text) => text.setPlaceholder('').setValue(value).onChange(onChange))
}

function addNameField(contentEl: HTMLElement, value: string, onChange: (value: string) => void) {
	new Setting(contentEl)
		.setName('Workspace name')
		.setDesc('Enter a name for this workspace')
		.addText((text) => text.setPlaceholder('My workspace').setValue(value).onChange(onChange))
}

function addDescriptionField(
	contentEl: HTMLElement,
	value: string,
	onChange: (value: string) => void
) {
	new Setting(contentEl)
		.setName('Description (optional)')
		.setDesc('Add a description to help remember what this workspace is for')
		.addTextArea((text) =>
			text.setPlaceholder('Used for writing blog posts...').setValue(value).onChange(onChange)
		)
}

function addWorkspaceFields(
	contentEl: HTMLElement,
	target: { icon: string; name: string; description: string }
) {
	addIconField(contentEl, target.icon, (value) => (target.icon = value))
	addNameField(contentEl, target.name, (value) => (target.name = value))
	addDescriptionField(contentEl, target.description, (value) => (target.description = value))
}

function addSaveCancelButtons(
	contentEl: HTMLElement,
	getName: () => string,
	onCancel: () => void,
	onSave: () => void | Promise<void>
) {
	new Setting(contentEl)
		.addButton((btn) => btn.setButtonText('Cancel').onClick(onCancel))
		.addButton((btn) =>
			btn
				.setButtonText('Save')
				.setCta()
				.onClick(() => {
					if (!getName().trim()) {
						new Notice('Please enter a workspace name')
						return
					}
					void onSave()
				})
		)
}

abstract class BaseWorkspaceFuzzyModal extends FuzzySuggestModal<WorkspaceConfig> {
	constructor(
		app: App,
		protected workspaceManager: WorkspaceManager,
		protected plugin: SuperchargedWorkspacesPlugin
	) {
		super(app)
	}

	abstract getItems(): WorkspaceConfig[]
	abstract onChooseItem(workspace: WorkspaceConfig): void

	getItemText(workspace: WorkspaceConfig): string {
		// Include description in searchable text if it exists
		if (workspace.description) {
			return `${workspace.name} ${workspace.description}`
		}
		return workspace.name
	}

	renderSuggestion(item: { item: WorkspaceConfig }, el: HTMLElement) {
		this.renderWorkspaceSuggestion(item.item, el, true)
	}

	protected renderWorkspaceSuggestion(
		workspace: WorkspaceConfig,
		el: HTMLElement,
		showLastUpdated: boolean
	) {
		el.createDiv({ cls: 'workspace-fuzzy-item' }, (div) => {
			const nameContainer = div.createDiv({
				cls: 'workspace-fuzzy-name',
			})
			if (workspace.icon) {
				nameContainer.createSpan({
					text: workspace.icon + ' ',
					cls: 'workspace-icon',
				})
			}
			nameContainer.createSpan({ text: workspace.name })
			if (workspace.description) {
				div.createDiv({
					text: workspace.description,
					cls: 'workspace-fuzzy-description',
				})
			}
			if (showLastUpdated) {
				const date = new Date(workspace.updatedAt).toLocaleDateString()
				div.createDiv({
					text: `Last updated: ${date}`,
					cls: 'workspace-fuzzy-meta',
				})
			}
		})
	}
}

export class WorkspaceFuzzySuggestModal extends BaseWorkspaceFuzzyModal {
	constructor(app: App, workspaceManager: WorkspaceManager, plugin: SuperchargedWorkspacesPlugin) {
		super(app, workspaceManager, plugin)
		this.setPlaceholder('Type to search workspaces...')
	}

	getItems(): WorkspaceConfig[] {
		return this.workspaceManager.getAllWorkspaces()
	}

	onChooseItem(workspace: WorkspaceConfig): void {
		void this.plugin.loadWorkspaceAndRefresh(workspace.id)
	}
}

export class SaveWorkspaceModal extends Modal {
	name = ''
	description = ''
	icon = ''
	private folderId: string | undefined = undefined

	constructor(
		app: App,
		private workspaceManager: WorkspaceManager,
		private plugin: SuperchargedWorkspacesPlugin,
		private onSave?: (workspace: WorkspaceConfig) => void
	) {
		super(app)
	}

	onOpen() {
		const { contentEl } = this
		contentEl.empty()

		contentEl.createEl('h2', { text: 'Save workspace' })

		addWorkspaceFields(contentEl, this)

		addFolderDropdown(contentEl, this.plugin, 'Folder (optional)', this.folderId, (folderId) => {
			this.folderId = folderId
		})

		addSaveCancelButtons(
			contentEl,
			() => this.name,
			() => this.close(),
			async () => {
				const workspace = await this.workspaceManager.saveWorkspace(
					this.name.trim(),
					this.description.trim() || undefined,
					this.icon.trim() || undefined
				)
				// Assign folder if selected
				if (this.folderId) {
					workspace.folderId = this.folderId
					await this.plugin.saveSettings()
				}
				if (this.onSave) {
					this.onSave(workspace)
				}
				this.close()
			}
		)
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}

export class NewWorkspaceModal extends Modal {
	name = ''
	description = ''
	icon = ''
	private templateId = ''

	constructor(
		app: App,
		private workspaceManager: WorkspaceManager,
		private plugin: SuperchargedWorkspacesPlugin,
		private onCreate?: (workspace: WorkspaceConfig) => void
	) {
		super(app)
	}

	onOpen() {
		const { contentEl } = this
		contentEl.empty()

		contentEl.createEl('h2', { text: 'New workspace' })

		addWorkspaceFields(contentEl, this)

		const templates = this.workspaceManager.getAllWorkspaces().filter((w) => w.isTemplate)
		new Setting(contentEl)
			.setName('Start from')
			.setDesc('Blank starts with an empty pane; a template clones its layout')
			.addDropdown((dropdown) => {
				dropdown.addOption('', 'Blank')
				dropdown.addOption(CURRENT_LAYOUT, 'Current layout')
				templates.forEach((t) => dropdown.addOption(t.id, t.name))
				dropdown.setValue(this.templateId)
				dropdown.onChange((value) => {
					this.templateId = value
				})
			})

		addSaveCancelButtons(
			contentEl,
			() => this.name,
			() => this.close(),
			async () => {
				const workspace = await this.workspaceManager.createWorkspace(
					this.name.trim(),
					this.description.trim() || undefined,
					this.icon.trim() || undefined,
					this.templateId || undefined
				)
				if (this.onCreate) {
					this.onCreate(workspace)
				}
				this.close()
			}
		)
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}

export class RenameWorkspaceModal extends Modal {
	name: string
	description: string
	icon: string
	private pinned: boolean
	private starred: boolean
	private isTemplate: boolean
	private folderId: string | undefined

	constructor(
		app: App,
		private workspaceManager: WorkspaceManager,
		private plugin: SuperchargedWorkspacesPlugin,
		private workspace: WorkspaceConfig,
		private onSave?: () => void
	) {
		super(app)
		this.name = workspace.name
		this.description = workspace.description || ''
		this.icon = workspace.icon || ''
		this.pinned = workspace.pinned || false
		this.starred = workspace.starred || false
		this.isTemplate = workspace.isTemplate || false
		this.folderId = workspace.folderId
	}

	onOpen() {
		const { contentEl } = this
		contentEl.empty()

		contentEl.createEl('h2', { text: 'Edit workspace' })

		addWorkspaceFields(contentEl, this)

		new Setting(contentEl)
			.setName('Pin workspace')
			.setDesc('Pin this workspace for quick access')
			.addToggle((toggle) =>
				toggle.setValue(this.pinned).onChange((value) => {
					this.pinned = value
				})
			)

		new Setting(contentEl)
			.setName('Star workspace')
			.setDesc('Add this workspace to your favorites')
			.addToggle((toggle) =>
				toggle.setValue(this.starred).onChange((value) => {
					this.starred = value
				})
			)

		new Setting(contentEl)
			.setName('Use as template')
			.setDesc('Make this workspace available as a starting point for new workspaces')
			.addToggle((toggle) =>
				toggle.setValue(this.isTemplate).onChange((value) => {
					this.isTemplate = value
				})
			)

		addFolderDropdown(contentEl, this.plugin, 'Folder', this.folderId, (folderId) => {
			this.folderId = folderId
		})

		addSaveCancelButtons(
			contentEl,
			() => this.name,
			() => this.close(),
			async () => {
				await this.workspaceManager.updateWorkspace(this.workspace.id, {
					name: this.name.trim(),
					description: this.description.trim() || undefined,
					icon: this.icon.trim() || undefined,
					pinned: this.pinned,
					starred: this.starred,
					isTemplate: this.isTemplate,
					folderId: this.folderId,
				})
				this.plugin.refreshWorkspacesView()
				if (this.onSave) {
					this.onSave()
				}
				this.close()
			}
		)
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}

export class EditWorkspaceFuzzySuggestModal extends BaseWorkspaceFuzzyModal {
	constructor(app: App, workspaceManager: WorkspaceManager, plugin: SuperchargedWorkspacesPlugin) {
		super(app, workspaceManager, plugin)
		this.setPlaceholder('Select workspace to edit...')
	}

	getItems(): WorkspaceConfig[] {
		return this.workspaceManager.getAllWorkspaces()
	}

	renderSuggestion(item: { item: WorkspaceConfig }, el: HTMLElement) {
		this.renderWorkspaceSuggestion(item.item, el, false)
	}

	onChooseItem(workspace: WorkspaceConfig): void {
		new RenameWorkspaceModal(this.app, this.workspaceManager, this.plugin, workspace).open()
	}
}

export class FilteredWorkspaceFuzzySuggestModal extends BaseWorkspaceFuzzyModal {
	constructor(
		app: App,
		workspaceManager: WorkspaceManager,
		private filterType: 'recent' | 'pinned' | 'favorites',
		plugin: SuperchargedWorkspacesPlugin
	) {
		super(app, workspaceManager, plugin)
		const titles = {
			recent: 'Recent workspaces',
			pinned: 'Pinned workspaces',
			favorites: 'Favorite workspaces',
		}
		this.setPlaceholder(`${titles[filterType]}...`)
	}

	getItems(): WorkspaceConfig[] {
		return filterBySmartGroup(this.workspaceManager.getAllWorkspaces(), this.filterType)
	}

	onChooseItem(workspace: WorkspaceConfig): void {
		void this.plugin.loadWorkspaceAndRefresh(workspace.id)
	}
}
