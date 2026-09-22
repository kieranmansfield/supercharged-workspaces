import { App, PluginSettingTab, Setting } from 'obsidian'
import type SuperchargedWorkspacesPlugin from './main'
import { WorkspaceConfig } from './types'

export class SettingsTab extends PluginSettingTab {
	plugin: SuperchargedWorkspacesPlugin

	constructor(app: App, plugin: SuperchargedWorkspacesPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()

		new Setting(containerEl)
			.setName('Show status bar')
			.setDesc('Display current workspace name in the status bar')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.ui.showStatusBar).onChange(async (value) => {
					this.plugin.settings.ui.showStatusBar = value
					await this.plugin.saveSettings()
					this.plugin.updateStatusBarVisibility()
				})
			)

		new Setting(containerEl)
			.setName('Auto-save current workspace')
			.setDesc('Automatically save workspace layout changes (experimental)')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.features.autoSave).onChange(async (value) => {
					this.plugin.settings.features.autoSave = value
					await this.plugin.saveSettings()
				})
			)

		new Setting(containerEl)
			.setName('Enable workspace folders (beta)')
			.setDesc('Enable folder organization for workspaces. This is a beta feature.')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.features.enableBetaFolders).onChange(async (value) => {
					this.plugin.settings.features.enableBetaFolders = value
					await this.plugin.saveSettings()
					this.plugin.refreshWorkspacesView()
				})
			)

		new Setting(containerEl)
			.setName('Enable drag-and-drop reordering')
			.setDesc('Allow reordering workspaces and folders by dragging them')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.features.enableDragAndDrop).onChange(async (value) => {
					this.plugin.settings.features.enableDragAndDrop = value
					await this.plugin.saveSettings()
					this.plugin.refreshWorkspacesView()
				})
			)

		new Setting(containerEl)
			.setName('Enable pin workspaces')
			.setDesc('Enable pinning workspaces to keep them at the top')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.features.enablePin).onChange(async (value) => {
					this.plugin.settings.features.enablePin = value
					await this.plugin.saveSettings()
					this.plugin.refreshWorkspacesView()
				})
			)

		new Setting(containerEl)
			.setName('Enable star workspaces')
			.setDesc('Enable starring workspaces as favorites')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.features.enableStar).onChange(async (value) => {
					this.plugin.settings.features.enableStar = value
					await this.plugin.saveSettings()
					this.plugin.refreshWorkspacesView()
				})
			)

		new Setting(containerEl)
			.setName('Enable recent workspaces')
			.setDesc('Enable tracking and filtering recently accessed workspaces')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.features.enableRecent).onChange(async (value) => {
					this.plugin.settings.features.enableRecent = value
					await this.plugin.saveSettings()
					this.plugin.refreshWorkspacesView()
				})
			)

		// Workspace statistics
		new Setting(containerEl).setName('Workspace statistics').setHeading()

		const workspaces = this.plugin.workspaceManager.getAllWorkspaces()
		const statsDiv = containerEl.createDiv('supercharged-workspaces-stats')

		statsDiv.createEl('p', {
			text: `Total saved workspaces: ${workspaces.length}`,
		})

		if (workspaces.length > 0) {
			const oldestDate = new Date(
				Math.min(...workspaces.map((w: WorkspaceConfig) => w.createdAt))
			).toLocaleDateString()
			statsDiv.createEl('p', {
				text: `Oldest workspace: ${oldestDate}`,
			})
		}

		// Workspace commands
		new Setting(containerEl).setName('Workspace commands').setHeading()
		containerEl.createEl('p', {
			text: 'Enable command palette commands for quick access to specific workspaces',
			cls: 'setting-item-description',
		})

		if (workspaces.length === 0) {
			containerEl.createEl('p', {
				text: 'No workspaces available. Create a workspace first.',
				cls: 'setting-item-description',
			})
		} else {
			workspaces.forEach((workspace: WorkspaceConfig) => {
				new Setting(containerEl)
					.setName((workspace.icon ? workspace.icon + ' ' : '') + workspace.name)
					.setDesc(workspace.description || 'Load this workspace from command palette')
					.addToggle((toggle) =>
						toggle.setValue(workspace.commandEnabled || false).onChange(async (value) => {
							workspace.commandEnabled = value
							await this.plugin.saveSettings()
							this.plugin.registerWorkspaceCommands()
						})
					)
			})
		}
	}
}
