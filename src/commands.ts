import { Modal, Notice } from 'obsidian'
import { WorkspaceManager } from './WorkspaceManager'
import {
	WorkspaceManagementModal,
	SaveWorkspaceModal,
	WorkspaceFuzzySuggestModal,
	EditWorkspaceFuzzySuggestModal,
	FilteredWorkspaceFuzzySuggestModal,
} from './WorkspaceModal'
import { WorkspaceConfig, WorkspaceFolder } from './types'
import SuperchargedWorkspacesPlugin from './main'

export function registerCommands(
	plugin: SuperchargedWorkspacesPlugin,
	workspaceManager: WorkspaceManager,
	updateStatusBar: (workspaceId: string | null) => void
) {
	// Save current workspace
	plugin.addCommand({
		id: 'save-workspace',
		name: 'Save current workspace',
		callback: () => {
			const modal = new SaveWorkspaceModal(
				plugin.app,
				workspaceManager,
				plugin,
				(workspace: WorkspaceConfig) => {
					updateStatusBar(workspace.id)
					plugin.refreshWorkspacesView()
				}
			)
			modal.open()
		},
	})

	// Create new workspace from current layout (alias for clarity)
	plugin.addCommand({
		id: 'create-new-workspace',
		name: 'Create new workspace from current layout',
		callback: () => {
			const modal = new SaveWorkspaceModal(
				plugin.app,
				workspaceManager,
				plugin,
				(workspace: WorkspaceConfig) => {
					updateStatusBar(workspace.id)
					plugin.refreshWorkspacesView()
				}
			)
			modal.open()
		},
	})

	// Manage workspaces
	plugin.addCommand({
		id: 'manage-workspaces',
		name: 'Manage workspaces',
		callback: () => {
			const modal = new WorkspaceManagementModal(
				plugin.app,
				workspaceManager,
				plugin,
				(workspaceId: string) => {
					updateStatusBar(workspaceId)
				}
			)
			modal.open()
		},
	})

	// Load workspace (with fuzzy search)
	plugin.addCommand({
		id: 'load-workspace',
		name: 'Load workspace',
		callback: () => {
			const modal = new WorkspaceFuzzySuggestModal(
				plugin.app,
				workspaceManager,
				(workspaceId: string) => {
					updateStatusBar(workspaceId)
					plugin.refreshWorkspacesView()
				}
			)
			modal.open()
		},
	})

	// Edit workspace
	plugin.addCommand({
		id: 'edit-workspace',
		name: 'Edit workspace',
		callback: () => {
			const modal = new EditWorkspaceFuzzySuggestModal(plugin.app, workspaceManager, plugin)
			modal.open()
			// Note: refresh happens in RenameWorkspaceModal save
		},
	})

	// Update current workspace (overwrite)
	plugin.addCommand({
		id: 'update-current-workspace',
		name: 'Update current workspace',
		callback: async () => {
			// Get the active workspace ID from plugin settings
			const activeWorkspaceId = plugin.settings.activeWorkspaceId

			if (!activeWorkspaceId) {
				return
			}

			const layout = plugin.app.workspace.getLayout()

			await workspaceManager.updateWorkspace(activeWorkspaceId, {
				layout,
				updatedAt: Date.now(),
			})

			// Refresh the panel
			plugin.refreshWorkspacesView()
		},
	})

	// Smart Group Commands
	plugin.addCommand({
		id: 'show-all-workspaces',
		name: 'Show all workspaces',
		callback: () => {
			plugin.settings.activeSmartGroup = 'all'
			void plugin.saveSettings()
			plugin.refreshWorkspacesView()
		},
	})

	// Recent workspaces command (only if enabled)
	if (plugin.settings.enableRecent) {
		plugin.addCommand({
			id: 'show-recent-workspaces',
			name: 'Show recent workspaces',
			callback: () => {
				const modal = new FilteredWorkspaceFuzzySuggestModal(
					plugin.app,
					workspaceManager,
					'recent',
					(workspaceId: string) => {
						updateStatusBar(workspaceId)
						plugin.refreshWorkspacesView()
					}
				)
				modal.open()
			},
		})
	}

	// Pinned workspaces command (only if enabled)
	if (plugin.settings.enablePin) {
		plugin.addCommand({
			id: 'show-pinned-workspaces',
			name: 'Show pinned workspaces',
			callback: () => {
				const modal = new FilteredWorkspaceFuzzySuggestModal(
					plugin.app,
					workspaceManager,
					'pinned',
					(workspaceId: string) => {
						updateStatusBar(workspaceId)
						plugin.refreshWorkspacesView()
					}
				)
				modal.open()
			},
		})
	}

	// Favorites workspaces command (only if enabled)
	if (plugin.settings.enableStar) {
		plugin.addCommand({
			id: 'show-favorites-workspaces',
			name: 'Show favorite workspaces',
			callback: () => {
				const modal = new FilteredWorkspaceFuzzySuggestModal(
					plugin.app,
					workspaceManager,
					'favorites',
					(workspaceId: string) => {
						updateStatusBar(workspaceId)
						plugin.refreshWorkspacesView()
					}
				)
				modal.open()
			},
		})
	}

	plugin.addCommand({
		id: 'clear-smart-group-filter',
		name: 'Clear smart group filter',
		callback: () => {
			plugin.settings.activeSmartGroup = null
			void plugin.saveSettings()
			plugin.refreshWorkspacesView()
		},
	})

	// Create new folder (only if beta enabled)
	if (plugin.settings.enableBetaFolders) {
		plugin.addCommand({
			id: 'create-folder',
			name: 'Create workspace folder',
			callback: () => {
				createFolderPrompt(plugin)
			},
		})
	}
}

export function createFolderPrompt(plugin: SuperchargedWorkspacesPlugin) {
	const modal = new Modal(plugin.app)
	modal.titleEl.setText('Create workspace folder')

	let folderName = ''
	let folderIcon = ''
	let folderColor = ''

	// Name input
	modal.contentEl.createEl('p', {
		text: 'Folder name:',
		cls: 'setting-item-name',
	})
	const nameInput = modal.contentEl.createEl('input', {
		type: 'text',
		placeholder: 'My folder',
	})
	nameInput.setCssProps({ width: '100%', marginBottom: '1em' })
	nameInput.addEventListener('input', (e) => {
		folderName = (e.target as HTMLInputElement).value
	})

	// Icon input (optional)
	modal.contentEl.createEl('p', {
		text: 'Emoji icon (optional):',
		cls: 'setting-item-name',
	})
	const iconInput = modal.contentEl.createEl('input', {
		type: 'text',
		placeholder: '📁',
	})
	iconInput.setCssProps({ width: '100%', marginBottom: '1em' })
	iconInput.addEventListener('input', (e) => {
		folderIcon = (e.target as HTMLInputElement).value
	})

	// Color picker
	modal.contentEl.createEl('p', {
		text: 'Color (optional):',
		cls: 'setting-item-name',
	})
	const colorContainer = modal.contentEl.createDiv('folder-color-picker')
	colorContainer.setCssProps({ display: 'flex', gap: '8px', marginBottom: '1em' })

	const colors = [
		{ name: 'None', value: '' },
		{ name: 'Red', value: '#e74c3c' },
		{ name: 'Blue', value: '#3498db' },
		{ name: 'Green', value: '#2ecc71' },
		{ name: 'Yellow', value: '#f39c12' },
		{ name: 'Purple', value: '#9b59b6' },
		{ name: 'Orange', value: '#e67e22' },
		{ name: 'Pink', value: '#ff69b4' },
	]

	colors.forEach((color) => {
		const colorBtn = colorContainer.createEl('button', {
			cls: 'color-swatch',
		})
		colorBtn.setCssProps({
			width: '24px',
			height: '24px',
			border: '1px solid var(--background-modifier-border)',
			borderRadius: '4px',
			cursor: 'pointer',
			backgroundColor: color.value || 'transparent',
		})
		colorBtn.setAttribute('aria-label', color.name)

		colorBtn.addEventListener('click', () => {
			folderColor = color.value
			// Update visual feedback
			colorContainer.querySelectorAll('.color-swatch').forEach((btn) => {
				;(btn as HTMLElement).setCssProps({ outline: 'none' })
			})
			colorBtn.setCssProps({
				outline: '2px solid var(--interactive-accent)',
				outlineOffset: '2px',
			})
		})
	})

	const buttonContainer = modal.contentEl.createDiv('modal-button-container')

	buttonContainer.createEl('button', { text: 'Cancel' }).addEventListener('click', () => {
		modal.close()
	})

	const createBtn = buttonContainer.createEl('button', {
		text: 'Create',
		cls: 'mod-cta',
	})
	createBtn.addEventListener('click', () => {
		void (async () => {
			const name = folderName.trim()
			if (!name) {
				new Notice('Please enter a folder name')
				return
			}

			const settings = plugin.settings
			const folderId = `folder-${Date.now()}`

			const newFolder: WorkspaceFolder = {
				id: folderId,
				name: name,
				icon: folderIcon.trim() || undefined,
				color: folderColor || undefined,
				order: Object.keys(settings.folders).length,
				collapsed: false,
			}

			settings.folders[folderId] = newFolder
			settings.folderOrder.push(folderId)

			await plugin.saveSettings()

			// Refresh the view
			plugin.refreshWorkspacesView()

			new Notice(`Folder "${name}" created`)
			modal.close()
		})()
	})

	nameInput.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			createBtn.click()
		} else if (e.key === 'Escape') {
			modal.close()
		}
	})

	modal.open()
	nameInput.focus()
}
