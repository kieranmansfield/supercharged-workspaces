import { Plugin, Menu, debounce, Debouncer } from 'obsidian'
import { PluginSettings } from './types'
import { migrateSettings } from './settingsMigration'
import { WorkspaceManager } from './WorkspaceManager'
import { FolderManager } from './FolderManager'
import { registerCommands } from './commands'
import { SettingsTab } from './SettingsTab'
import { WorkspaceFuzzySuggestModal } from './WorkspaceModal'
import { WorkspacesView, VIEW_TYPE_WORKSPACES } from './WorkspacesView'

export default class SuperchargedWorkspacesPlugin extends Plugin {
	settings!: PluginSettings
	workspaceManager!: WorkspaceManager
	folderManager!: FolderManager
	statusBarItem: HTMLElement | null = null
	workspaceCommands: string[] = []
	private debouncedAutoSave!: Debouncer<[], void>

	async onload() {
		await this.loadSettings()

		// Initialize workspace manager
		this.workspaceManager = new WorkspaceManager(
			this.app,
			() => this.settings.workspaces,
			() => this.saveSettings()
		)

		// Initialize folder manager
		this.folderManager = new FolderManager(
			() => this.settings,
			() => this.saveSettings()
		)

		// Register workspaces view
		this.registerView(VIEW_TYPE_WORKSPACES, (leaf) => new WorkspacesView(leaf, this))

		// Register commands
		registerCommands(this, this.workspaceManager, (workspaceId: string | null) =>
			this.updateStatusBar(workspaceId)
		)

		// Add command to open workspaces panel
		this.addCommand({
			id: 'open-workspaces-panel',
			name: 'Open workspaces panel',
			callback: () => this.activateView(),
		})

		// Add ribbon icon
		this.addRibbonIcon('layout', 'Load workspace', () => {
			new WorkspaceFuzzySuggestModal(this.app, this.workspaceManager, this).open()
		})

		// Add status bar item
		this.statusBarItem = this.addStatusBarItem()
		this.updateStatusBar(this.settings.view.activeWorkspaceId)

		// Add settings tab
		this.addSettingTab(new SettingsTab(this.app, this))

		// Register individual workspace commands
		this.registerWorkspaceCommands()

		// Listen for layout changes if auto-save is enabled. layout-change fires on
		// every pane resize/active-leaf switch, not just meaningful edits, so debounce
		// it to avoid saving (and writing to disk) on every intermediate event.
		this.debouncedAutoSave = debounce(() => this.autoSaveWorkspace(), 1000, true)
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				if (this.settings.features.autoSave && this.settings.view.activeWorkspaceId) {
					this.debouncedAutoSave()
				}
			})
		)
	}

	onunload() {
		// Cleanup is handled automatically by registerEvent
	}

	async loadSettings() {
		const data: unknown = await this.loadData()
		this.settings = migrateSettings(data)
	}

	async saveSettings() {
		// Convert Set to array for JSON serialization
		const dataToSave: Omit<PluginSettings, 'view'> & {
			view: Omit<PluginSettings['view'], 'collapsedFolders'> & { collapsedFolders: string[] }
		} = {
			...this.settings,
			view: {
				...this.settings.view,
				collapsedFolders: Array.from(this.settings.view.collapsedFolders),
			},
		}
		await this.saveData(dataToSave)
	}

	updateStatusBar(workspaceId: string | null) {
		if (!this.statusBarItem) return

		this.settings.view.activeWorkspaceId = workspaceId
		void this.saveSettings()

		if (!this.settings.ui.showStatusBar) {
			this.statusBarItem.setCssProps({ display: 'none' })
			return
		}

		this.statusBarItem.setCssProps({ display: 'block' })

		if (workspaceId) {
			const workspace = this.workspaceManager.getWorkspaceById(workspaceId)
			if (workspace) {
				const icon = workspace.icon || '📋'
				this.statusBarItem.setText(`${icon} ${workspace.name}`)
				this.statusBarItem.addClass('mod-clickable')
				this.statusBarItem.onclick = (event: MouseEvent) => {
					this.showWorkspaceMenu(event)
				}
			}
		} else {
			this.statusBarItem.setText('No workspace')
			this.statusBarItem.addClass('mod-clickable')
			this.statusBarItem.onclick = (event: MouseEvent) => {
				this.showWorkspaceMenu(event)
			}
		}

		// Refresh the workspaces panel
		this.refreshWorkspacesView()
	}

	async loadWorkspaceAndRefresh(id: string): Promise<void> {
		// Flush any pending debounced autosave for the workspace we're leaving
		// before switching, so edits made just before the switch aren't lost
		// or misattributed to the workspace being switched into.
		const previousId = this.settings.view.activeWorkspaceId
		if (this.settings.features.autoSave && previousId && previousId !== id) {
			this.debouncedAutoSave.cancel()
			this.autoSaveWorkspace()
		}

		// Set active workspace before changing layout: changeLayout() fires
		// 'layout-change' synchronously, and autosave must attribute that
		// event to the workspace being switched to, not the one being left.
		this.updateStatusBar(id)
		await this.workspaceManager.loadWorkspace(id)
	}

	updateStatusBarVisibility() {
		if (this.statusBarItem) {
			this.statusBarItem.setCssProps({
				display: this.settings.ui.showStatusBar ? 'block' : 'none',
			})
		}
	}

	private autoSaveWorkspace() {
		if (!this.settings.view.activeWorkspaceId) return

		const layout = this.app.workspace.getLayout()
		void this.workspaceManager.updateWorkspace(
			this.settings.view.activeWorkspaceId,
			{ layout, updatedAt: Date.now() },
			true
		)
		this.refreshWorkspacesView()
	}

	private showWorkspaceMenu(event: MouseEvent) {
		const menu = new Menu()
		const workspaces = this.workspaceManager.getAllWorkspaces()

		if (workspaces.length === 0) {
			menu.addItem((item) => {
				item.setTitle('No workspaces saved').setDisabled(true)
			})
		} else {
			workspaces.forEach((workspace) => {
				menu.addItem((item) => {
					const icon = workspace.icon || '📋'
					const isActive = workspace.id === this.settings.view.activeWorkspaceId

					item
						.setTitle(`${icon} ${workspace.name}`)
						.setChecked(isActive)
						.onClick(() => void this.loadWorkspaceAndRefresh(workspace.id))
				})
			})
		}

		menu.showAtMouseEvent(event)
	}

	async activateView() {
		const { workspace } = this.app

		let leaf = workspace.getLeavesOfType(VIEW_TYPE_WORKSPACES)[0]

		if (!leaf) {
			// Open in right sidebar
			const rightLeaf = workspace.getRightLeaf(false)
			if (rightLeaf) {
				await rightLeaf.setViewState({
					type: VIEW_TYPE_WORKSPACES,
					active: true,
				})
				leaf = rightLeaf
			}
		}

		if (leaf) {
			void workspace.revealLeaf(leaf)
		}
	}

	refreshWorkspacesView() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKSPACES)
		leaves.forEach((leaf) => {
			const view = leaf.view
			if (view instanceof WorkspacesView) {
				view.refresh()
			}
		})
	}

	registerWorkspaceCommands() {
		// Note: Obsidian doesn't provide a way to remove commands,
		// so we track which ones are registered and only add new ones
		// Plugin reload is required for command changes to take full effect

		// Register commands for enabled workspaces
		const workspaces = this.workspaceManager.getAllWorkspaces()
		workspaces.forEach((workspace) => {
			if (workspace.commandEnabled) {
				const commandId = `load-workspace-${workspace.id}`

				// Check if command is already registered
				if (!this.workspaceCommands.includes(commandId)) {
					const commandName = `Load workspace: ${
						workspace.icon ? workspace.icon + ' ' : ''
					}${workspace.name}`

					this.addCommand({
						id: commandId,
						name: commandName,
						callback: () => this.loadWorkspaceAndRefresh(workspace.id),
					})

					this.workspaceCommands.push(commandId)
				}
			}
		})
	}
}
