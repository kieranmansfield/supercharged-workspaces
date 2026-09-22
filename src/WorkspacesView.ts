import { ItemView, WorkspaceLeaf, Menu, Modal, setIcon } from 'obsidian'
import { WorkspaceManager } from './WorkspaceManager'
import { RenameWorkspaceModal } from './WorkspaceModal'
import { WorkspaceConfig, WorkspaceFolder, SmartGroupType, FOLDER_COLORS } from './types'
import SuperchargedWorkspacesPlugin from './main'
import { createFolderPrompt } from './commands'
import { applyOrder, reorder } from './ordering'
import { filterBySmartGroup, groupWorkspacesByFolder, sortWorkspacesByPriority } from './workspaceFilters'

export const VIEW_TYPE_WORKSPACES = 'supercharged-workspaces-view'

export class WorkspacesView extends ItemView {
	private plugin: SuperchargedWorkspacesPlugin
	private workspaceManager: WorkspaceManager
	private draggedElement: HTMLElement | null = null
	private draggedWorkspaceId: string | null = null
	private draggedFromFolder: string | null = null
	private draggedFolderId: string | null = null

	constructor(leaf: WorkspaceLeaf, plugin: SuperchargedWorkspacesPlugin) {
		super(leaf)
		this.plugin = plugin
		this.workspaceManager = plugin.workspaceManager
	}

	getViewType(): string {
		return VIEW_TYPE_WORKSPACES
	}

	getDisplayText(): string {
		return 'Workspaces'
	}

	getIcon(): string {
		return 'layout'
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	async onOpen() {
		const container = this.containerEl.children[1]
		container.empty()
		container.addClass('workspaces-view')

		this.renderWorkspaces()
	}

	renderWorkspaces() {
		const container = this.containerEl.children[1] as HTMLElement
		container.empty()

		const allWorkspaces = this.workspaceManager.getAllWorkspaces()

		if (allWorkspaces.length === 0) {
			const emptyState = container.createDiv('workspaces-empty-state')
			emptyState.createEl('p', {
				text: 'No workspaces yet',
				cls: 'workspaces-empty-text',
			})
			emptyState.createEl('p', {
				text: 'Use "save current workspace" to create your first workspace',
				cls: 'workspaces-empty-hint',
			})
			return
		}

		// Check if smart group bar should be shown
		const shouldShowSmartGroupBar =
			this.plugin.settings.features.enableRecent ||
			this.plugin.settings.features.enablePin ||
			this.plugin.settings.features.enableStar ||
			this.plugin.settings.features.enableBetaFolders

		// Render the smart group bar if any features are enabled
		if (shouldShowSmartGroupBar) {
			this.renderSmartGroupBar(container)
		}

		// Apply smart group filter
		const workspaces = filterBySmartGroup(allWorkspaces, this.plugin.settings.view.activeSmartGroup)

		// Main container
		const listContainer = container.createDiv('workspaces-list')

		// Render based on active smart group or folder view
		if (this.plugin.settings.view.activeSmartGroup) {
			// Smart group view - flat list
			this.renderFlatWorkspaceList(listContainer, workspaces)
		} else if (this.plugin.settings.features.enableBetaFolders) {
			// Folder view - organized by folders (only if beta enabled)
			this.renderFolderView(listContainer, workspaces)
		} else {
			// Default flat list when folders disabled
			this.renderFlatWorkspaceList(listContainer, workspaces)
		}
	}

	private renderSmartGroupBar(container: HTMLElement) {
		const bar = container.createDiv('smart-group-bar')

		// Only show filter buttons if enabled
		if (this.plugin.settings.ui.showSmartGroups) {
			const groups: Array<{
				id: SmartGroupType | null
				label: string
				icon: string
			}> = [{ id: null, label: 'All', icon: 'layout-grid' }]

			// Add recent smart group if enabled
			if (this.plugin.settings.features.enableRecent) {
				groups.push({ id: 'recent', label: 'Recent', icon: 'clock' })
			}

			// Add pin smart group if enabled
			if (this.plugin.settings.features.enablePin) {
				groups.push({ id: 'pinned', label: 'Pinned', icon: 'pin' })
			}

			// Add star smart group if enabled
			if (this.plugin.settings.features.enableStar) {
				groups.push({
					id: 'favorites',
					label: 'Favorites',
					icon: 'star',
				})
			}

			groups.forEach((group) => {
				const btn = bar.createEl('button', {
					cls: 'smart-group-button',
				})

				if (this.plugin.settings.view.activeSmartGroup === group.id) {
					btn.addClass('is-active')
				}

				const iconEl = btn.createSpan({ cls: 'smart-group-icon' })
				setIcon(iconEl, group.icon)

				// Add aria-label for accessibility
				btn.setAttribute('aria-label', group.label)

				btn.addEventListener('click', () => {
					this.plugin.settings.view.activeSmartGroup = group.id
					void this.plugin.saveSettings()
					this.renderWorkspaces()
				})
			})
		}

		// Add folder button (only if beta enabled)
		if (this.plugin.settings.features.enableBetaFolders) {
			const addFolderBtn = bar.createEl('button', {
				cls: 'smart-group-button add-folder-button',
			})
			addFolderBtn.setAttribute('aria-label', 'Add folder')

			const iconEl = addFolderBtn.createSpan({ cls: 'smart-group-icon' })
			setIcon(iconEl, 'folder-plus')

			addFolderBtn.addEventListener('click', (e) => {
				e.preventDefault()
				e.stopPropagation()
				createFolderPrompt(this.plugin)
			})
		}
	}

	private renderFlatWorkspaceList(container: HTMLElement, workspaces: WorkspaceConfig[]) {
		const sortedWorkspaces = this.sortWorkspaces(workspaces)
		sortedWorkspaces.forEach((workspace) => {
			this.renderWorkspaceItem(container, workspace)
		})
	}

	private renderFolderView(container: HTMLElement, workspaces: WorkspaceConfig[]) {
		const sortedWorkspaces = this.sortWorkspaces(workspaces)
		const folders = this.getOrderedFolders()
		const workspacesByFolder = groupWorkspacesByFolder(this.getOrderedWorkspaces(), sortedWorkspaces)

		// Render all folders (even empty ones)
		folders.forEach((folder) => {
			const folderWorkspaces = workspacesByFolder.get(folder.id) || []
			this.renderFolder(container, folder, folderWorkspaces)
		})

		// Render workspaces without folder (at root level, no folder wrapper)
		const noFolderWorkspaces = workspacesByFolder.get(null) || []
		if (noFolderWorkspaces.length > 0) {
			noFolderWorkspaces.forEach((workspace) => {
				this.renderWorkspaceItem(container, workspace)
			})
		}
	}

	private renderFolder(
		container: HTMLElement,
		folder: WorkspaceFolder | null,
		workspaces: WorkspaceConfig[]
	) {
		const folderId = folder?.id || 'no-folder'
		const isCollapsed = folder ? this.plugin.settings.view.collapsedFolders.has(folder.id) : false

		const folderSection = container.createDiv('workspace-folder')
		folderSection.dataset.folderId = folderId

		// Folder header
		const header = folderSection.createDiv('folder-header')

		// Make folder draggable (not for "No Folder") and only if enabled
		if (folder && this.plugin.settings.features.enableDragAndDrop) {
			header.draggable = true
			header.addEventListener('dragstart', (e) => this.onFolderDragStart(e, folder.id))
			header.addEventListener('dragend', (e) => this.onFolderDragEnd(e))
			header.addEventListener('dragover', (e) => this.onDragOver(e))
			header.addEventListener('drop', (e) => this.onFolderDrop(e, folder.id))
			header.addEventListener('dragenter', (e) => this.onDragEnter(e))
			header.addEventListener('dragleave', (e) => this.onDragLeave(e))
		}

		// Collapse icon
		const collapseIcon = header.createSpan({ cls: 'folder-collapse-icon' })
		setIcon(collapseIcon, isCollapsed ? 'chevron-right' : 'chevron-down')

		// Folder icon
		if (folder?.icon) {
			header.createSpan({ text: folder.icon, cls: 'folder-icon' })
		}

		// Folder name
		const folderName = folder?.name || 'No Folder'
		header.createSpan({ text: folderName, cls: 'folder-name' })

		// Count badge
		header.createSpan({
			text: workspaces.length.toString(),
			cls: 'folder-count',
		})

		// Folder color
		if (folder?.color) {
			header.setCssProps({
				borderLeftColor: folder.color,
				borderLeftWidth: '3px',
				borderLeftStyle: 'solid',
			})
		}

		// Click to toggle collapse
		header.addEventListener('click', () => {
			if (folder) {
				if (isCollapsed) {
					this.plugin.settings.view.collapsedFolders.delete(folder.id)
				} else {
					this.plugin.settings.view.collapsedFolders.add(folder.id)
				}
				void this.plugin.saveSettings()
				this.renderWorkspaces()
			}
		})

		// Context menu for folder
		if (folder) {
			header.addEventListener('contextmenu', (e) => {
				e.preventDefault()
				this.showFolderContextMenu(folder, e)
			})
		}

		// Folder content (workspaces)
		if (!isCollapsed) {
			const folderContent = folderSection.createDiv('folder-content')
			workspaces.forEach((workspace) => {
				this.renderWorkspaceItem(folderContent, workspace, folderId)
			})
		}
	}

	private renderWorkspaceItem(
		container: HTMLElement,
		workspace: WorkspaceConfig,
		folderId?: string
	) {
		const item = container.createDiv('workspace-item')
		const isActive = workspace.id === this.plugin.settings.view.activeWorkspaceId

		if (isActive) {
			item.addClass('is-active')
		}

		// Make draggable if enabled
		if (this.plugin.settings.features.enableDragAndDrop) {
			item.draggable = true
			item.dataset.workspaceId = workspace.id
			if (folderId) {
				item.dataset.folderId = folderId
			}

			// Drag events
			item.addEventListener('dragstart', (e) => this.onDragStart(e, workspace.id, folderId || null))
			item.addEventListener('dragend', (e) => this.onDragEnd(e))
			item.addEventListener('dragover', (e) => this.onDragOver(e))
			item.addEventListener('drop', (e) => {
				void (async () => {
					await this.onDrop(e, workspace.id, folderId)
				})()
			})
			item.addEventListener('dragenter', (e) => this.onDragEnter(e))
			item.addEventListener('dragleave', (e) => this.onDragLeave(e))
		}

		// Main content
		const content = item.createDiv('workspace-item-content')

		// Drag handle (only if drag-and-drop is enabled)
		if (this.plugin.settings.features.enableDragAndDrop) {
			const dragHandle = content.createSpan({
				cls: 'workspace-drag-handle',
			})
			dragHandle.innerHTML = '⋮⋮'
		}

		// Pinned indicator
		if (this.plugin.settings.features.enablePin && workspace.pinned) {
			const pinIcon = content.createSpan({ cls: 'workspace-pin-icon' })
			setIcon(pinIcon, 'pin')
		}

		// Starred indicator
		if (this.plugin.settings.features.enableStar && workspace.starred) {
			const starIcon = content.createSpan({ cls: 'workspace-star-icon' })
			setIcon(starIcon, 'star')
		}

		// Icon
		content.createSpan({
			text: workspace.icon || '📋',
			cls: 'workspace-item-icon',
		})

		// Name
		content.createSpan({
			text: workspace.name,
			cls: 'workspace-item-name',
		})

		// Click to load
		content.addEventListener('click', (e) => {
			if ((e.target as HTMLElement).classList.contains('workspace-drag-handle')) {
				return
			}
			void this.plugin.loadWorkspaceAndRefresh(workspace.id)
		})

		// Context menu
		content.addEventListener('contextmenu', (event) => {
			event.preventDefault()
			this.showWorkspaceContextMenu(workspace.id, event)
		})

		// Tooltip
		if (workspace.description) {
			content.setAttribute('aria-label', workspace.description)
		}
	}

	private getOrderedFolders(): WorkspaceFolder[] {
		const folders = this.plugin.folderManager.getAll()
		const order = this.plugin.settings.ordering.folderOrder

		if (order.length === 0) {
			return folders.sort(
				(a: WorkspaceFolder, b: WorkspaceFolder) => (a.order || 0) - (b.order || 0)
			)
		}

		return applyOrder(folders, order, (f) => f.id)
	}

	private showWorkspaceContextMenu(workspaceId: string, event: MouseEvent) {
		const menu = new Menu()
		const workspace = this.workspaceManager.getWorkspaceById(workspaceId)

		if (!workspace) return

		menu.addItem((item) => {
			item
				.setTitle('Load workspace')
				.setIcon('play')
				.onClick(() => void this.plugin.loadWorkspaceAndRefresh(workspaceId))
		})

		menu.addItem((item) => {
			item
				.setTitle('Update workspace')
				.setIcon('save')
				.onClick(async () => {
					const layout = this.app.workspace.getLayout()
					await this.workspaceManager.updateWorkspace(workspaceId, {
						layout,
						updatedAt: Date.now(),
					})
					this.renderWorkspaces()
				})
		})

		menu.addSeparator()

		// Pin/Unpin (only if enabled)
		if (this.plugin.settings.features.enablePin) {
			menu.addItem((item) => {
				const isPinned = workspace.pinned || false
				item
					.setTitle(isPinned ? 'Unpin workspace' : 'Pin workspace')
					.setIcon('pin')
					.onClick(async () => {
						await this.workspaceManager.updateWorkspace(workspaceId, {
							pinned: !isPinned,
						})
						this.renderWorkspaces()
					})
			})
		}

		// Star/Unstar (only if enabled)
		if (this.plugin.settings.features.enableStar) {
			menu.addItem((item) => {
				const isStarred = workspace.starred || false
				item
					.setTitle(isStarred ? 'Unstar workspace' : 'Star workspace')
					.setIcon('star')
					.onClick(async () => {
						await this.workspaceManager.updateWorkspace(workspaceId, {
							starred: !isStarred,
						})
						this.renderWorkspaces()
					})
			})
		}
		// Move to folder submenu (only if beta enabled)
		if (this.plugin.settings.features.enableBetaFolders) {
			menu.addItem((item) => {
				item
					.setTitle('Move to folder')
					.setIcon('folder')
					.onClick(() => {
						this.showMoveToFolderMenu(workspace, event)
					})
			})
		}

		menu.addSeparator()

		menu.addItem((item) => {
			item
				.setTitle('Rename workspace')
				.setIcon('pencil')
				.onClick(() => {
					new RenameWorkspaceModal(this.app, this.workspaceManager, this.plugin, workspace, () =>
						this.renderWorkspaces()
					).open()
				})
		})

		menu.addItem((item) => {
			item
				.setTitle('Delete workspace')
				.setIcon('trash')
				.onClick(async () => {
					const confirmed = await this.confirmDelete(workspace.name)
					if (confirmed) {
						void this.workspaceManager.deleteWorkspace(workspaceId)
						if (this.plugin.settings.view.activeWorkspaceId === workspaceId) {
							this.plugin.updateStatusBar(null)
						}
						this.renderWorkspaces()
					}
				})
		})

		menu.showAtMouseEvent(event)
	}

	private async confirmDelete(workspaceName: string): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new Modal(this.app)
			modal.titleEl.setText('Delete workspace')
			modal.contentEl.createEl('p', {
				text: `Are you sure you want to delete "${workspaceName}"?`,
			})

			const buttonContainer = modal.contentEl.createDiv('modal-button-container')

			buttonContainer.createEl('button', { text: 'Cancel' }).addEventListener('click', () => {
				modal.close()
				resolve(false)
			})

			const deleteBtn = buttonContainer.createEl('button', {
				text: 'Delete',
				cls: 'mod-warning',
			})
			deleteBtn.addEventListener('click', () => {
				modal.close()
				resolve(true)
			})

			modal.open()
		})
	}

	private showMoveToFolderMenu(workspace: WorkspaceConfig, event: MouseEvent) {
		const menu = new Menu()

		// Option to remove from folder
		if (workspace.folderId) {
			menu.addItem((item) => {
				item
					.setTitle('Remove from folder')
					.setIcon('x')
					.onClick(() => {
						delete workspace.folderId
						void this.plugin.saveSettings()
						this.renderWorkspaces()
					})
			})
			menu.addSeparator()
		}

		// List all folders
		const folders = this.getOrderedFolders()
		if (folders.length === 0) {
			menu.addItem((item) => {
				item.setTitle('No folders available').setDisabled(true)
			})
		} else {
			folders.forEach((folder) => {
				menu.addItem((item) => {
					item
						.setTitle(folder.name)
						.setIcon('folder')
						.setChecked(workspace.folderId === folder.id)
						.onClick(() => {
							workspace.folderId = folder.id
							void this.plugin.saveSettings()
							this.renderWorkspaces()
						})
				})
			})
		}

		menu.showAtMouseEvent(event)
	}

	private showFolderContextMenu(folder: WorkspaceFolder, event: MouseEvent) {
		const menu = new Menu()

		menu.addItem((item) => {
			item
				.setTitle('Rename folder')
				.setIcon('pencil')
				.onClick(() => {
					void this.renameFolderPrompt(folder)
				})
		})

		menu.addItem((item) => {
			item
				.setTitle('Change color')
				.setIcon('palette')
				.onClick(() => {
					void this.changeFolderColorPrompt(folder)
				})
		})

		menu.addSeparator()

		menu.addItem((item) => {
			item
				.setTitle('Delete folder')
				.setIcon('trash')
				.onClick(async () => {
					const confirmed = await this.confirmDelete(folder.name)
					if (confirmed) {
						this.deleteFolder(folder.id)
					}
				})
		})

		menu.showAtMouseEvent(event)
	}

	private renameFolderPrompt(folder: WorkspaceFolder) {
		const modal = new Modal(this.app)
		modal.titleEl.setText('Rename folder')

		const input = modal.contentEl.createEl('input', {
			type: 'text',
			value: folder.name,
		})
		input.setCssProps({
			width: '100%',
			marginBottom: '1em',
		})

		const buttonContainer = modal.contentEl.createDiv('modal-button-container')

		buttonContainer.createEl('button', { text: 'Cancel' }).addEventListener('click', () => {
			modal.close()
		})

		const saveBtn = buttonContainer.createEl('button', {
			text: 'Save',
			cls: 'mod-cta',
		})
		saveBtn.addEventListener('click', () => {
			if (input.value.trim()) {
				void this.plugin.folderManager.rename(folder.id, input.value.trim()).then(() => {
					this.renderWorkspaces()
					modal.close()
				})
			}
		})

		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				saveBtn.click()
			} else if (e.key === 'Escape') {
				modal.close()
			}
		})

		modal.open()
		input.focus()
		input.select()
	}

	private changeFolderColorPrompt(folder: WorkspaceFolder) {
		const menu = new Menu()

		FOLDER_COLORS.forEach((color) => {
			menu.addItem((item) => {
				item
					.setTitle(color.name)
					.setChecked(folder.color === color.value)
					.onClick(() => {
						void this.plugin.folderManager.setColor(folder.id, color.value).then(() => {
							this.renderWorkspaces()
						})
					})
			})
		})

		menu.showAtPosition({
			x: window.innerWidth / 2,
			y: window.innerHeight / 2,
		})
	}

	private deleteFolder(folderId: string) {
		void this.plugin.folderManager.delete(folderId).then(() => {
			this.renderWorkspaces()
		})
	}

	private getOrderedWorkspaces() {
		const allWorkspaces = this.workspaceManager.getAllWorkspaces()
		const order = this.plugin.settings.ordering.workspaceOrder
		const ordered = applyOrder(allWorkspaces, order, (w) => w.id)

		return this.sortWorkspaces(ordered)
	}

	private sortWorkspaces(workspaces: WorkspaceConfig[]): WorkspaceConfig[] {
		return sortWorkspacesByPriority(
			workspaces,
			this.plugin.settings.features.enablePin,
			this.plugin.settings.features.enableStar
		)
	}

	private onDragStart(e: DragEvent, workspaceId: string, folderId?: string | null) {
		this.draggedWorkspaceId = workspaceId
		this.draggedFromFolder = folderId || null
		this.draggedElement = e.target as HTMLElement
		this.draggedElement.addClass('is-dragging')
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move'
			e.dataTransfer.setData('text/plain', workspaceId)
		}
	}

	private onFolderDragStart(e: DragEvent, folderId: string) {
		this.draggedFolderId = folderId
		this.draggedElement = e.currentTarget as HTMLElement
		this.draggedElement.addClass('is-dragging')
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move'
			e.dataTransfer.setData('text/plain', folderId)
		}
		e.stopPropagation()
	}

	private onDragEnd(e: DragEvent) {
		if (this.draggedElement) {
			this.draggedElement.removeClass('is-dragging')
		}
		this.draggedElement = null
		this.draggedWorkspaceId = null

		// Remove all drag-over classes
		const items = this.containerEl.querySelectorAll('.workspace-item')
		items.forEach((item) => {
			item.removeClass('drag-over')
		})
	}

	private onFolderDragEnd(e: DragEvent) {
		if (this.draggedElement) {
			this.draggedElement.removeClass('is-dragging')
		}
		this.draggedElement = null
		this.draggedFolderId = null

		// Remove all drag-over classes
		const headers = this.containerEl.querySelectorAll('.folder-header')
		headers.forEach((header) => {
			header.removeClass('drag-over')
		})
	}

	private onDragOver(e: DragEvent) {
		e.preventDefault()
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move'
		}
	}

	private onDragEnter(e: DragEvent) {
		const target = e.currentTarget as HTMLElement
		if (target !== this.draggedElement) {
			target.addClass('drag-over')
		}
	}

	private onDragLeave(e: DragEvent) {
		const target = e.currentTarget as HTMLElement
		target.removeClass('drag-over')
	}

	private async onDrop(e: DragEvent, targetWorkspaceId: string, targetFolderId?: string) {
		e.preventDefault()
		e.stopPropagation()

		const target = e.currentTarget as HTMLElement
		target.removeClass('drag-over')

		if (!this.draggedWorkspaceId || this.draggedWorkspaceId === targetWorkspaceId) {
			return
		}

		// Get dragged workspace
		const draggedWorkspace = this.workspaceManager.getWorkspaceById(this.draggedWorkspaceId)
		if (!draggedWorkspace) return

		// If beta folders enabled and dropped on a workspace in a different folder, move to that folder
		if (this.plugin.settings.features.enableBetaFolders) {
			const resolvedTargetFolderId = targetFolderId === 'no-folder' ? undefined : targetFolderId
			if (this.draggedFromFolder !== resolvedTargetFolderId) {
				draggedWorkspace.folderId = resolvedTargetFolderId
			}
		}

		// Update order
		const workspaces = this.getOrderedWorkspaces()

		// Initialize workspaceOrder if empty
		if (!this.plugin.settings.ordering.workspaceOrder || this.plugin.settings.ordering.workspaceOrder.length === 0) {
			this.plugin.settings.ordering.workspaceOrder = workspaces.map((w) => w.id)
		}

		const currentOrder = this.plugin.settings.ordering.workspaceOrder
		if (currentOrder.includes(this.draggedWorkspaceId) && currentOrder.includes(targetWorkspaceId)) {
			this.plugin.settings.ordering.workspaceOrder = reorder(currentOrder, this.draggedWorkspaceId, targetWorkspaceId)
			await this.plugin.saveSettings()
			this.renderWorkspaces()
		}
	}

	private onFolderDrop(e: DragEvent, targetFolderId: string) {
		e.preventDefault()
		e.stopPropagation()

		const target = e.currentTarget as HTMLElement
		target.removeClass('drag-over')

		if (!this.draggedFolderId || this.draggedFolderId === targetFolderId) {
			return
		}

		// Reorder folders
		const folderOrder = this.plugin.settings.ordering.folderOrder
		if (folderOrder.includes(this.draggedFolderId) && folderOrder.includes(targetFolderId)) {
			this.plugin.settings.ordering.folderOrder = reorder(folderOrder, this.draggedFolderId, targetFolderId)
			void this.plugin.saveSettings()
			this.renderWorkspaces()
		}
	}

	async onClose() {
		// Cleanup if needed
	}

	// Method to refresh the view when workspaces are modified
	refresh() {
		this.renderWorkspaces()
	}
}
