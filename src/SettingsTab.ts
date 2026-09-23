import { App, PluginSettingTab, SettingDefinition, SettingDefinitionItem, SettingDefinitionPage } from 'obsidian'
import type SuperchargedWorkspacesPlugin from './main'
import { WorkspaceConfig } from './types'
import { NewWorkspaceModal } from './WorkspaceModal'
import { applyOrder } from './ordering'
import { IconPickerModal, isLucideIcon, LUCIDE_PREFIX } from './iconUtils'

const WORKSPACE_KEY_PREFIX = 'workspace:'
const OPTIONAL_TEXT_FIELDS = new Set<WorkspaceField>(['icon', 'description'])

type WorkspaceField =
	| 'name'
	| 'icon'
	| 'description'
	| 'pinned'
	| 'starred'
	| 'isTemplate'
	| 'folderId'
	| 'commandEnabled'

function parseWorkspaceKey(key: string): { workspaceId: string; field: WorkspaceField } | null {
	if (!key.startsWith(WORKSPACE_KEY_PREFIX)) return null
	const [workspaceId, field] = key.slice(WORKSPACE_KEY_PREFIX.length).split(':') as [string, WorkspaceField]
	return { workspaceId, field }
}

export class SettingsTab extends PluginSettingTab {
	plugin: SuperchargedWorkspacesPlugin

	constructor(app: App, plugin: SuperchargedWorkspacesPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	// Called by Obsidian's declarative settings renderer for each control-type
	// setting definition, not from our own code.
	// fallow-ignore-next-line unused-class-member, complexity
	getControlValue(key: string): unknown {
		const parsed = parseWorkspaceKey(key)
		if (parsed) {
			const workspace = this.plugin.workspaceManager.getWorkspaceById(parsed.workspaceId)
			if (!workspace) return undefined
			if (parsed.field === 'folderId') return workspace.folderId ?? ''
			if (parsed.field === 'pinned' || parsed.field === 'starred' || parsed.field === 'isTemplate' || parsed.field === 'commandEnabled') {
				return workspace[parsed.field] ?? false
			}
			if (parsed.field === 'icon') return isLucideIcon(workspace.icon) ? '' : (workspace.icon ?? '')
			return workspace[parsed.field] ?? ''
		}

		switch (key) {
			case 'showStatusBar':
				return this.plugin.settings.ui.showStatusBar
			case 'autoSave':
				return this.plugin.settings.features.autoSave
			case 'enableFolders':
				return this.plugin.settings.features.enableFolders
			case 'enableDragAndDrop':
				return this.plugin.settings.features.enableDragAndDrop
			case 'enablePin':
				return this.plugin.settings.features.enablePin
			case 'enableStar':
				return this.plugin.settings.features.enableStar
			case 'enableRecent':
				return this.plugin.settings.features.enableRecent
			default:
				return undefined
		}
	}

	// Called by Obsidian's declarative settings renderer on user changes to a
	// control-type setting definition, not from our own code.
	// fallow-ignore-next-line unused-class-member, complexity
	async setControlValue(key: string, value: unknown): Promise<void> {
		const parsed = parseWorkspaceKey(key)
		if (parsed) {
			await this.setWorkspaceField(parsed.workspaceId, parsed.field, value)
			return
		}

		switch (key) {
			case 'showStatusBar':
				this.plugin.settings.ui.showStatusBar = value as boolean
				await this.plugin.saveSettings()
				this.plugin.updateStatusBarVisibility()
				return
			case 'autoSave':
				this.plugin.settings.features.autoSave = value as boolean
				await this.plugin.saveSettings()
				return
			case 'enableFolders':
				this.plugin.settings.features.enableFolders = value as boolean
				await this.plugin.saveSettings()
				this.plugin.refreshWorkspacesView()
				return
			case 'enableDragAndDrop':
				this.plugin.settings.features.enableDragAndDrop = value as boolean
				await this.plugin.saveSettings()
				this.plugin.refreshWorkspacesView()
				return
			case 'enablePin':
				this.plugin.settings.features.enablePin = value as boolean
				await this.plugin.saveSettings()
				this.plugin.refreshWorkspacesView()
				return
			case 'enableStar':
				this.plugin.settings.features.enableStar = value as boolean
				await this.plugin.saveSettings()
				this.plugin.refreshWorkspacesView()
				return
			case 'enableRecent':
				this.plugin.settings.features.enableRecent = value as boolean
				await this.plugin.saveSettings()
				this.plugin.refreshWorkspacesView()
				return
		}
	}

	private async setWorkspaceField(workspaceId: string, field: WorkspaceField, value: unknown): Promise<void> {
		await this.plugin.workspaceManager.updateWorkspace(
			workspaceId,
			this.buildWorkspaceUpdate(field, value),
			true
		)

		if (field === 'commandEnabled') {
			this.plugin.registerWorkspaceCommands()
		}
		this.plugin.refreshWorkspacesView()
	}

	// fallow-ignore-next-line complexity
	private buildWorkspaceUpdate(field: WorkspaceField, value: unknown): Partial<WorkspaceConfig> {
		if (field === 'folderId') return { folderId: (value as string) || undefined }
		if (OPTIONAL_TEXT_FIELDS.has(field)) return { [field]: (value as string) || undefined }
		return { [field]: value }
	}

	private orderedWorkspaces(): WorkspaceConfig[] {
		return applyOrder(
			this.plugin.workspaceManager.getAllWorkspaces(),
			this.plugin.settings.ordering.workspaceOrder,
			(w) => w.id
		)
	}

	private async reorderWorkspaces(oldIndex: number, newIndex: number): Promise<void> {
		const ids = this.orderedWorkspaces().map((w) => w.id)
		const [moved] = ids.splice(oldIndex, 1)
		ids.splice(newIndex, 0, moved)
		this.plugin.settings.ordering.workspaceOrder = ids
		await this.plugin.saveSettings()
		this.update()
		this.plugin.refreshWorkspacesView()
	}

	private folderOptions(): Record<string, string> {
		const options: Record<string, string> = { '': 'No folder' }
		for (const folder of this.plugin.folderManager.getAll()) {
			options[folder.id] = folder.name
		}
		return options
	}

	private iconActionDesc(icon: string | undefined): string {
		if (isLucideIcon(icon)) return `Currently: ${(icon as string).slice(LUCIDE_PREFIX.length)}`
		return 'Pick from a searchable list instead of typing an emoji'
	}

	private optionalWorkspaceItems(
		workspace: WorkspaceConfig,
		key: (field: WorkspaceField) => string
	): SettingDefinitionItem[] {
		const items: SettingDefinitionItem[] = []

		if (this.plugin.settings.features.enablePin) {
			items.push({
				name: 'Pin workspace',
				desc: 'Pin this workspace for quick access',
				control: { type: 'toggle', key: key('pinned') },
			})
		}

		if (this.plugin.settings.features.enableStar) {
			items.push({
				name: 'Star workspace',
				desc: 'Add this workspace to your favorites',
				control: { type: 'toggle', key: key('starred') },
			})
		}

		if (this.plugin.settings.features.enableFolders) {
			items.push({
				name: 'Folder',
				control: { type: 'dropdown', key: key('folderId'), options: this.folderOptions() },
			})
		}

		return items
	}

	private workspacePageItems(workspace: WorkspaceConfig): SettingDefinitionItem[] {
		const key = (field: WorkspaceField) => `${WORKSPACE_KEY_PREFIX}${workspace.id}:${field}`
		return [
			{ name: 'Workspace name', control: { type: 'text', key: key('name') } },
			{ name: 'Emoji icon', desc: 'Optional', control: { type: 'text', key: key('icon') } },
			{
				name: 'Choose a built-in icon',
				desc: this.iconActionDesc(workspace.icon),
				action: () => {
					new IconPickerModal(this.app, (icon) => {
						void this.setWorkspaceField(workspace.id, 'icon', icon).then(() => this.update())
					}).open()
				},
			},
			{
				name: 'Description',
				desc: 'Optional',
				control: { type: 'textarea', key: key('description') },
			},
			{
				name: 'Load via command palette',
				desc: 'Register a dedicated command to load this workspace',
				control: { type: 'toggle', key: key('commandEnabled') },
			},
			{
				name: 'Use as template',
				desc: 'Make this workspace available as a starting point for new workspaces',
				control: { type: 'toggle', key: key('isTemplate') },
			},
			...this.optionalWorkspaceItems(workspace, key),
		]
	}

	private workspaceDisplayName(workspace: WorkspaceConfig): string {
		if (workspace.icon && !isLucideIcon(workspace.icon)) return `${workspace.icon} ${workspace.name}`
		return workspace.name
	}

	private workspaceListItems(workspaces: WorkspaceConfig[]): SettingDefinitionPage[] {
		return workspaces.map((workspace) => ({
			type: 'page',
			name: this.workspaceDisplayName(workspace),
			desc: workspace.description || undefined,
			displayValue: workspace.isTemplate ? 'Template' : undefined,
			items: this.workspacePageItems(workspace),
		}))
	}

	// Called by Obsidian on every render of the settings tab, not from our own code.
	// fallow-ignore-next-line unused-class-member
	getSettingDefinitions(): SettingDefinitionItem[] {
		const workspaces = this.plugin.workspaceManager.getAllWorkspaces()

		const definitions: SettingDefinitionItem[] = [
			{
				type: 'list',
				heading: 'Workspaces',
				emptyState: 'No workspaces yet. Use the + button to create one.',
				items: this.workspaceListItems(this.orderedWorkspaces()),
				onReorder: (oldIndex, newIndex) => void this.reorderWorkspaces(oldIndex, newIndex),
				onDelete: (index) => {
					const workspace = this.orderedWorkspaces()[index]
					if (!workspace) return
					void this.plugin.workspaceManager.deleteWorkspace(workspace.id).then(() => {
						this.update()
						this.plugin.refreshWorkspacesView()
					})
				},
				addItem: {
					name: 'New workspace',
					action: () => {
						new NewWorkspaceModal(this.app, this.plugin.workspaceManager, this.plugin, () => {
							this.update()
							this.plugin.refreshWorkspacesView()
						}).open()
					},
				},
			},
			{
				name: 'Show status bar',
				desc: 'Display current workspace name in the status bar',
				control: { type: 'toggle', key: 'showStatusBar' },
			},
			{
				name: 'Auto-save current workspace',
				desc: 'Automatically save workspace layout changes (experimental)',
				control: { type: 'toggle', key: 'autoSave' },
			},
			{
				name: 'Workspace folders',
				desc: 'Organize workspaces into folders',
				control: { type: 'toggle', key: 'enableFolders' },
			},
			{
				name: 'Enable drag-and-drop reordering',
				desc: 'Allow reordering workspaces and folders by dragging them',
				control: { type: 'toggle', key: 'enableDragAndDrop' },
			},
			{
				name: 'Enable pin workspaces',
				desc: 'Enable pinning workspaces to keep them at the top',
				control: { type: 'toggle', key: 'enablePin' },
			},
			{
				name: 'Enable star workspaces',
				desc: 'Enable starring workspaces as favorites',
				control: { type: 'toggle', key: 'enableStar' },
			},
			{
				name: 'Enable recent workspaces',
				desc: 'Enable tracking and filtering recently accessed workspaces',
				control: { type: 'toggle', key: 'enableRecent' },
			},
			{
				type: 'group',
				heading: 'Workspace statistics',
				items: [{ name: `Total saved workspaces: ${workspaces.length}` }, ...this.oldestWorkspaceItem(workspaces)],
			},
		]

		return definitions
	}

	private oldestWorkspaceItem(workspaces: WorkspaceConfig[]): SettingDefinition[] {
		if (workspaces.length === 0) return []

		const oldestDate = new Date(Math.min(...workspaces.map((w) => w.createdAt))).toLocaleDateString()
		return [{ name: `Oldest workspace: ${oldestDate}` }]
	}
}
