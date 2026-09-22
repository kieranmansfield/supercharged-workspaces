import { App, FuzzySuggestModal, Modal, Notice, Setting } from 'obsidian'
import { WorkspaceConfig, WorkspaceFolder } from './types'
import { WorkspaceManager } from './WorkspaceManager'
import SuperchargedWorkspacesPlugin from './main'
import { filterBySmartGroup } from './workspaceFilters'

export class WorkspaceManagementModal extends Modal {
	constructor(
		app: App,
		private workspaceManager: WorkspaceManager,
		private plugin: SuperchargedWorkspacesPlugin
	) {
		super(app)
	}

	onOpen() {
		const { contentEl } = this
		contentEl.empty()
		contentEl.addClass('supercharged-workspaces-modal')

		contentEl.createEl('h2', { text: 'Manage workspaces' })

		const workspaces = this.workspaceManager.getAllWorkspaces()

		if (workspaces.length === 0) {
			contentEl.createEl('p', {
				text: 'No saved workspaces yet. Use "save current workspace" to create one',
				cls: 'supercharged-workspaces-empty',
			})
			return
		}

		const listContainer = contentEl.createDiv('supercharged-workspaces-list')

		workspaces.forEach((workspace) => {
			const item = listContainer.createDiv('supercharged-workspace-item')

			const info = item.createDiv('workspace-info')

			const header = info.createDiv('workspace-header')
			if (workspace.icon) {
				header.createSpan({
					text: workspace.icon,
					cls: 'workspace-icon',
				})
			}
			header.createEl('h3', { text: workspace.name })

			const meta = info.createDiv('workspace-meta')
			const date = new Date(workspace.updatedAt).toLocaleString()
			meta.createEl('span', { text: `Last updated: ${date}` })

			if (workspace.description) {
				info.createEl('p', {
					text: workspace.description,
					cls: 'workspace-description',
				})
			}

			const actions = item.createDiv('workspace-actions')

			// Load button
			const loadBtn = actions.createEl('button', { text: 'Load' })
			loadBtn.addEventListener('click', () => {
				void (async () => {
					await this.plugin.loadWorkspaceAndRefresh(workspace.id)
					this.close()
				})()
			})

			// Edit button
			const editBtn = actions.createEl('button', { text: 'Edit' })
			editBtn.addEventListener('click', () => {
				this.close()
				new RenameWorkspaceModal(this.app, this.workspaceManager, this.plugin, workspace).open()
			})

			// Delete button
			const deleteBtn = actions.createEl('button', {
				text: 'Delete',
				cls: 'mod-warning',
			})
			deleteBtn.addEventListener('click', () => {
				void (async () => {
					if (confirm(`Delete workspace "${workspace.name}"?`)) {
						await this.workspaceManager.deleteWorkspace(workspace.id)
						this.plugin.refreshWorkspacesView()
						this.onOpen() // Refresh the list
					}
				})()
			})
		})
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
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
	private name = ''
	private description = ''
	private icon = ''
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

		new Setting(contentEl)
			.setName('Emoji icon (optional)')
			.setDesc('Enter a single emoji to identify this workspace')
			.addText((text) =>
				text
					.setPlaceholder('')
					.setValue(this.icon)
					.onChange((value) => {
						this.icon = value
					})
			)

		new Setting(contentEl)
			.setName('Workspace name')
			.setDesc('Enter a name for this workspace')
			.addText((text) =>
				text
					.setPlaceholder('My workspace')
					.setValue(this.name)
					.onChange((value) => {
						this.name = value
					})
			)

		new Setting(contentEl)
			.setName('Description (optional)')
			.setDesc('Add a description to help remember what this workspace is for')
			.addTextArea((text) =>
				text
					.setPlaceholder('Used for writing blog posts...')
					.setValue(this.description)
					.onChange((value) => {
						this.description = value
					})
			)

		// Folder selection (only if beta enabled)
		if (this.plugin.settings.enableBetaFolders) {
			const folders = Object.values(this.plugin.settings.folders)
			if (folders.length > 0) {
				new Setting(contentEl)
					.setName('Folder (optional)')
					.setDesc('Assign this workspace to a folder')
					.addDropdown((dropdown) => {
						dropdown.addOption('', 'No folder')
						folders.forEach((folder: WorkspaceFolder) => {
							dropdown.addOption(folder.id, folder.name)
						})
						dropdown.setValue(this.folderId || '')
						dropdown.onChange((value) => {
							this.folderId = value || undefined
						})
					})
			}
		}

		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText('Cancel').onClick(() => {
					this.close()
				})
			)
			.addButton((btn) =>
				btn
					.setButtonText('Save')
					.setCta()
					.onClick(async () => {
						if (!this.name.trim()) {
							new Notice('Please enter a workspace name')
							return
						}
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
					})
			)
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}

export class RenameWorkspaceModal extends Modal {
	private name: string
	private description: string
	private icon: string
	private pinned: boolean
	private starred: boolean
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
		this.folderId = workspace.folderId
	}

	onOpen() {
		const { contentEl } = this
		contentEl.empty()

		contentEl.createEl('h2', { text: 'Edit workspace' })

		new Setting(contentEl)
			.setName('Emoji icon (optional)')
			.setDesc('Enter a single emoji to identify this workspace')
			.addText((text) =>
				text
					.setPlaceholder('')
					.setValue(this.icon)
					.onChange((value) => {
						this.icon = value
					})
			)

		new Setting(contentEl).setName('Workspace name').addText((text) =>
			text
				.setPlaceholder('My workspace')
				.setValue(this.name)
				.onChange((value) => {
					this.name = value
				})
		)

		new Setting(contentEl).setName('Description (optional)').addTextArea((text) =>
			text
				.setPlaceholder('Used for writing blog posts...')
				.setValue(this.description)
				.onChange((value) => {
					this.description = value
				})
		)

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

		// Folder selection (only if beta enabled)
		if (this.plugin.settings.enableBetaFolders) {
			const folders = Object.values(this.plugin.settings.folders)
			if (folders.length > 0) {
				new Setting(contentEl)
					.setName('Folder')
					.setDesc('Assign this workspace to a folder')
					.addDropdown((dropdown) => {
						dropdown.addOption('', 'No folder')
						folders.forEach((folder: WorkspaceFolder) => {
							dropdown.addOption(folder.id, folder.name)
						})
						dropdown.setValue(this.folderId || '')
						dropdown.onChange((value) => {
							this.folderId = value || undefined
						})
					})
			}
		}

		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText('Cancel').onClick(() => {
					this.close()
				})
			)
			.addButton((btn) =>
				btn
					.setButtonText('Save')
					.setCta()
					.onClick(() => {
						void (async () => {
							if (!this.name.trim()) {
								new Notice('Please enter a workspace name')
								return
							}
							await this.workspaceManager.updateWorkspace(this.workspace.id, {
								name: this.name.trim(),
								description: this.description.trim() || undefined,
								icon: this.icon.trim() || undefined,
								pinned: this.pinned,
								starred: this.starred,
								folderId: this.folderId,
							})
							this.plugin.refreshWorkspacesView()
							if (this.onSave) {
								this.onSave()
							}
							this.close()
						})()
					})
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
