import { App, PluginSettingTab, SettingDefinition, SettingDefinitionItem } from 'obsidian'
import type SuperchargedWorkspacesPlugin from './main'
import { WorkspaceConfig } from './types'

const WORKSPACE_KEY_PREFIX = 'workspace:'

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
		if (key.startsWith(WORKSPACE_KEY_PREFIX)) {
			const workspaceId = key.slice(WORKSPACE_KEY_PREFIX.length)
			return this.plugin.workspaceManager.getWorkspaceById(workspaceId)?.commandEnabled ?? false
		}

		switch (key) {
			case 'showStatusBar':
				return this.plugin.settings.ui.showStatusBar
			case 'autoSave':
				return this.plugin.settings.features.autoSave
			case 'enableBetaFolders':
				return this.plugin.settings.features.enableBetaFolders
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
		if (key.startsWith(WORKSPACE_KEY_PREFIX)) {
			const workspaceId = key.slice(WORKSPACE_KEY_PREFIX.length)
			const workspace = this.plugin.workspaceManager.getWorkspaceById(workspaceId)
			if (workspace) {
				workspace.commandEnabled = value as boolean
				await this.plugin.saveSettings()
				this.plugin.registerWorkspaceCommands()
			}
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
			case 'enableBetaFolders':
				this.plugin.settings.features.enableBetaFolders = value as boolean
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

	// Called by Obsidian on every render of the settings tab, not from our own code.
	// fallow-ignore-next-line unused-class-member
	getSettingDefinitions(): SettingDefinitionItem[] {
		const workspaces = this.plugin.workspaceManager.getAllWorkspaces()

		const definitions: SettingDefinitionItem[] = [
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
				name: 'Enable workspace folders (beta)',
				desc: 'Enable folder organization for workspaces. This is a beta feature.',
				control: { type: 'toggle', key: 'enableBetaFolders' },
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
			{
				type: 'group',
				heading: 'Workspace commands',
				items:
					workspaces.length === 0
						? [{ name: 'No workspaces available. Create a workspace first.' }]
						: workspaces.map((workspace) => ({
								name: (workspace.icon ? workspace.icon + ' ' : '') + workspace.name,
								desc: workspace.description || 'Load this workspace from command palette',
								control: {
									type: 'toggle' as const,
									key: `${WORKSPACE_KEY_PREFIX}${workspace.id}`,
								},
							})),
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
