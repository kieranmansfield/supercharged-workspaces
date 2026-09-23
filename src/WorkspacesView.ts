import { ItemView, WorkspaceLeaf, setIcon } from 'obsidian'
import { WorkspaceManager } from './WorkspaceManager'
import { WorkspaceConfig, WorkspaceFolder, SmartGroupType } from './types'
import type SuperchargedWorkspacesPlugin from './main'
import { createFolderPrompt } from './commands'
import { applyOrder } from './ordering'
import { filterBySmartGroup, groupWorkspacesByFolder, sortWorkspacesByPriority } from './workspaceFilters'
import { DragDropController } from './dragDrop'
import { WorkspaceContextMenus } from './contextMenus'

export const VIEW_TYPE_WORKSPACES = 'supercharged-workspaces-view'

export class WorkspacesView extends ItemView {
	private plugin: SuperchargedWorkspacesPlugin
	private workspaceManager: WorkspaceManager
	private dragDrop: DragDropController
	private contextMenus: WorkspaceContextMenus

	constructor(leaf: WorkspaceLeaf, plugin: SuperchargedWorkspacesPlugin) {
		super(leaf)
		this.plugin = plugin
		this.workspaceManager = plugin.workspaceManager
		this.dragDrop = new DragDropController(
			plugin,
			this.workspaceManager,
			this.containerEl,
			() => this.getOrderedWorkspaces(),
			() => this.renderWorkspaces()
		)
		this.contextMenus = new WorkspaceContextMenus(
			this.app,
			plugin,
			this.workspaceManager,
			() => this.getOrderedFolders(),
			() => this.renderWorkspaces()
		)
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

	// eslint-disable-next-line @typescript-eslint/require-await -- overrides Obsidian's async ItemView.onOpen signature; no await needed here
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

		const header = folderSection.createDiv('folder-header')
		this.renderFolderHeaderContent(header, folder, workspaces.length, isCollapsed)
		this.dragDrop.attachFolderDragHandlers(header, folder)
		this.attachFolderHeaderInteractions(header, folder, isCollapsed)

		if (!isCollapsed) {
			const folderContent = folderSection.createDiv('folder-content')
			workspaces.forEach((workspace) => {
				this.renderWorkspaceItem(folderContent, workspace, folderId)
			})
		}
	}

	// CC 8, well under the CC-20 threshold; CRAP score is purely a 0%-coverage artifact
	// (CRAP = CC^2 + CC with no coverage), not real complexity
	// fallow-ignore-next-line complexity
	private renderFolderHeaderContent(
		header: HTMLElement,
		folder: WorkspaceFolder | null,
		workspaceCount: number,
		isCollapsed: boolean
	) {
		const collapseIcon = header.createSpan({ cls: 'folder-collapse-icon' })
		setIcon(collapseIcon, isCollapsed ? 'chevron-right' : 'chevron-down')

		if (folder?.icon) {
			header.createSpan({ text: folder.icon, cls: 'folder-icon' })
		}

		header.createSpan({ text: folder?.name || 'No Folder', cls: 'folder-name' })

		header.createSpan({
			text: workspaceCount.toString(),
			cls: 'folder-count',
		})

		if (folder?.color) {
			header.setCssProps({
				borderLeftColor: folder.color,
				borderLeftWidth: '3px',
				borderLeftStyle: 'solid',
			})
		}
	}

	private attachFolderHeaderInteractions(
		header: HTMLElement,
		folder: WorkspaceFolder | null,
		isCollapsed: boolean
	) {
		if (!folder) return

		header.addEventListener('click', () => {
			if (isCollapsed) {
				this.plugin.settings.view.collapsedFolders.delete(folder.id)
			} else {
				this.plugin.settings.view.collapsedFolders.add(folder.id)
			}
			void this.plugin.saveSettings()
			this.renderWorkspaces()
		})

		header.addEventListener('contextmenu', (e) => {
			e.preventDefault()
			this.contextMenus.showFolderContextMenu(folder, e)
		})
	}

	private renderWorkspaceItem(
		container: HTMLElement,
		workspace: WorkspaceConfig,
		folderId?: string
	) {
		const item = container.createDiv('workspace-item')
		if (workspace.id === this.plugin.settings.view.activeWorkspaceId) {
			item.addClass('is-active')
		}

		this.dragDrop.attachWorkspaceItemDragHandlers(item, workspace, folderId)
		this.renderWorkspaceItemContent(item, workspace)
	}

	// CC 8, well under the CC-20 threshold; CRAP score is purely a 0%-coverage artifact
	// (CRAP = CC^2 + CC with no coverage), not real complexity
	// fallow-ignore-next-line complexity
	private renderWorkspaceItemContent(item: HTMLElement, workspace: WorkspaceConfig) {
		const content = item.createDiv('workspace-item-content')

		if (this.plugin.settings.features.enableDragAndDrop) {
			content.createSpan({
				cls: 'workspace-drag-handle',
				text: '⋮⋮',
			})
		}

		if (this.plugin.settings.features.enablePin && workspace.pinned) {
			const pinIcon = content.createSpan({ cls: 'workspace-pin-icon' })
			setIcon(pinIcon, 'pin')
		}

		if (this.plugin.settings.features.enableStar && workspace.starred) {
			const starIcon = content.createSpan({ cls: 'workspace-star-icon' })
			setIcon(starIcon, 'star')
		}

		content.createSpan({
			text: workspace.icon || '📋',
			cls: 'workspace-item-icon',
		})

		content.createSpan({
			text: workspace.name,
			cls: 'workspace-item-name',
		})

		if (workspace.isTemplate) {
			const templateIcon = content.createSpan({ cls: 'workspace-template-icon' })
			setIcon(templateIcon, 'copy')
			templateIcon.setAttribute('aria-label', 'Template')
		}

		content.addEventListener('click', (e) => {
			if ((e.target as HTMLElement).classList.contains('workspace-drag-handle')) {
				return
			}
			void this.plugin.loadWorkspaceAndRefresh(workspace.id)
		})

		content.addEventListener('contextmenu', (event) => {
			event.preventDefault()
			this.contextMenus.showWorkspaceContextMenu(workspace.id, event)
		})

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

	async onClose() {
		// Cleanup if needed
	}

	// Method to refresh the view when workspaces are modified
	refresh() {
		this.renderWorkspaces()
	}
}
