import { ItemView, WorkspaceLeaf, setIcon } from 'obsidian'
import { WorkspaceManager } from './WorkspaceManager'
import { WorkspaceConfig, WorkspaceFolder, SmartGroupType } from './types'
import type SuperchargedWorkspacesPlugin from './main'
import { createFolderPrompt } from './commands'
import { applyOrder } from './ordering'
import { filterBySmartGroup, groupWorkspacesByFolder, sortWorkspacesByPriority } from './workspaceFilters'
import { DragDropController } from './dragDrop'
import { WorkspaceContextMenus } from './contextMenus'
import { renderIcon } from './iconUtils'

export const VIEW_TYPE_WORKSPACES = 'supercharged-workspaces-view'

const SMART_GROUP_ACTIONS: Array<{ id: SmartGroupType | null; label: string; icon: string }> = [
	{ id: null, label: 'All workspaces', icon: 'layout-grid' },
	{ id: 'recent', label: 'Recent workspaces', icon: 'clock' },
	{ id: 'pinned', label: 'Pinned workspaces', icon: 'pin' },
	{ id: 'favorites', label: 'Favorite workspaces', icon: 'star' },
]

export class WorkspacesView extends ItemView {
	private plugin: SuperchargedWorkspacesPlugin
	private workspaceManager: WorkspaceManager
	private dragDrop: DragDropController
	private contextMenus: WorkspaceContextMenus
	private headerActions = new Map<string, HTMLElement>()

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
		this.containerEl.children[0].addClass('supercharged-workspaces-header')

		this.setupHeaderActions()
		this.renderWorkspaces()
	}

	private setupHeaderActions() {
		SMART_GROUP_ACTIONS.forEach((group) => {
			const key = group.id ?? 'all'
			const el = this.addAction(group.icon, group.label, () => {
				this.plugin.settings.view.activeSmartGroup = group.id
				void this.plugin.saveSettings()
				this.renderWorkspaces()
			})
			this.headerActions.set(key, el)
		})

		this.headerActions.set(
			'addFolder',
			this.addAction('folder-plus', 'New folder', (e) => {
				e.preventDefault()
				e.stopPropagation()
				createFolderPrompt(this.plugin)
			})
		)
	}

	private syncHeaderActions() {
		const features = this.plugin.settings.features
		this.toggleHeaderAction('recent', features.enableRecent)
		this.toggleHeaderAction('pinned', features.enablePin)
		this.toggleHeaderAction('favorites', features.enableStar)
		this.toggleHeaderAction('addFolder', features.enableFolders)

		const active = this.plugin.settings.view.activeSmartGroup
		SMART_GROUP_ACTIONS.forEach((group) => {
			this.headerActions.get(group.id ?? 'all')?.toggleClass('is-active', active === group.id)
		})
	}

	private toggleHeaderAction(key: string, visible: boolean) {
		const el = this.headerActions.get(key)
		if (el) el.toggleClass('is-hidden', !visible)
	}

	renderWorkspaces() {
		const container = this.containerEl.children[1] as HTMLElement
		container.empty()
		this.syncHeaderActions()

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

		// Apply smart group filter
		const workspaces = filterBySmartGroup(allWorkspaces, this.plugin.settings.view.activeSmartGroup)

		// Main container
		const listContainer = container.createDiv('workspaces-list')

		// Render based on active smart group or folder view
		if (this.plugin.settings.view.activeSmartGroup) {
			// Smart group view - flat list
			this.renderFlatWorkspaceList(listContainer, workspaces)
		} else if (this.plugin.settings.features.enableFolders) {
			// Folder view - organized by folders
			this.renderFolderView(listContainer, workspaces)
		} else {
			// Default flat list when folders disabled
			this.renderFlatWorkspaceList(listContainer, workspaces)
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
			const iconEl = header.createSpan({ cls: 'folder-icon' })
			renderIcon(iconEl, folder.icon, '')
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

		if (this.plugin.settings.features.enablePin && workspace.pinned) {
			const pinIcon = content.createSpan({ cls: 'workspace-pin-icon' })
			setIcon(pinIcon, 'pin')
		}

		if (this.plugin.settings.features.enableStar && workspace.starred) {
			const starIcon = content.createSpan({ cls: 'workspace-star-icon' })
			setIcon(starIcon, 'star')
		}

		const iconEl = content.createSpan({ cls: 'workspace-item-icon' })
		renderIcon(iconEl, workspace.icon, '📋')

		content.createSpan({
			text: workspace.name,
			cls: 'workspace-item-name',
		})

		if (workspace.isTemplate) {
			const templateIcon = content.createSpan({ cls: 'workspace-template-icon' })
			setIcon(templateIcon, 'copy')
			templateIcon.setAttribute('aria-label', 'Template')
		}

		content.addEventListener('click', () => {
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
