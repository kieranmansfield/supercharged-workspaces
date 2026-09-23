import { App, Notice } from 'obsidian'
import { WorkspaceConfig } from './types'
import { generateUniqueId } from './id'
import { compareByName } from './workspaceFilters'

export const CURRENT_LAYOUT = '__current__'

export class WorkspaceManager {
	constructor(
		private app: App,
		private getWorkspaces: () => Record<string, WorkspaceConfig>,
		private saveSettings: () => Promise<void>
	) {}

	async saveWorkspace(name: string, description?: string, icon?: string): Promise<WorkspaceConfig> {
		const workspace = await this.persistWorkspace(
			name,
			description,
			icon,
			this.app.workspace.getLayout()
		)
		new Notice(`Workspace "${name}" saved successfully`)
		return workspace
	}

	async createWorkspace(
		name: string,
		description?: string,
		icon?: string,
		templateId?: string
	): Promise<WorkspaceConfig> {
		const layout = this.resolveNewWorkspaceLayout(templateId)
		const workspace = await this.persistWorkspace(name, description, icon, layout)
		new Notice(`Workspace "${name}" created`)
		return workspace
	}

	private resolveNewWorkspaceLayout(templateId?: string): Record<string, unknown> {
		if (!templateId) return this.blankLayout()
		if (templateId === CURRENT_LAYOUT) return this.cloneLayout(this.app.workspace.getLayout())

		const template = this.getWorkspaces()[templateId]
		return this.cloneLayout(template ? template.layout : this.app.workspace.getLayout())
	}

	private async persistWorkspace(
		name: string,
		description: string | undefined,
		icon: string | undefined,
		layout: Record<string, unknown>
	): Promise<WorkspaceConfig> {
		const now = Date.now()
		const workspace: WorkspaceConfig = {
			id: this.generateId(),
			name,
			description,
			icon,
			layout,
			createdAt: now,
			updatedAt: now,
		}

		const workspaces = this.getWorkspaces()
		workspaces[workspace.id] = workspace
		await this.saveSettings()

		return workspace
	}

	private cloneLayout(layout: Record<string, unknown>): Record<string, unknown> {
		return JSON.parse(JSON.stringify(layout)) as Record<string, unknown>
	}

	private blankLayout(): Record<string, unknown> {
		const layout = this.cloneLayout(this.app.workspace.getLayout())
		layout.main = {
			id: generateUniqueId(),
			type: 'split',
			children: [
				{
					id: generateUniqueId(),
					type: 'tabs',
					children: [
						{
							id: generateUniqueId(),
							type: 'leaf',
							state: { type: 'empty', state: {} },
						},
					],
				},
			],
			direction: 'vertical',
		}
		return layout
	}

	async loadWorkspace(id: string): Promise<void> {
		const workspaces = this.getWorkspaces()
		const workspace = workspaces[id]

		if (!workspace) {
			new Notice('Workspace not found')
			return
		}

		try {
			await this.app.workspace.changeLayout(workspace.layout)
			// Update lastAccessed timestamp
			workspace.lastAccessed = Date.now()
			await this.saveSettings()
			new Notice(`Loaded workspace: ${workspace.name}`)
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error)
			new Notice(`Failed to load workspace "${workspace.name}": ${reason}`)
		}
	}

	async updateWorkspace(
		id: string,
		updates: Partial<WorkspaceConfig>,
		silent = false
	): Promise<void> {
		const workspaces = this.getWorkspaces()
		const workspace = workspaces[id]

		if (!workspace) {
			if (!silent) new Notice('Workspace not found')
			return
		}

		Object.assign(workspace, updates, { updatedAt: Date.now() })
		await this.saveSettings()
		if (!silent) new Notice(`Workspace "${workspace.name}" updated`)
	}

	async deleteWorkspace(id: string): Promise<void> {
		const workspaces = this.getWorkspaces()
		const workspace = workspaces[id]

		if (!workspace) {
			new Notice('Workspace not found')
			return
		}

		delete workspaces[id]
		await this.saveSettings()
		new Notice(`Workspace "${workspace.name}" deleted`)
	}

	getWorkspaceById(id: string): WorkspaceConfig | undefined {
		return this.getWorkspaces()[id]
	}

	getAllWorkspaces(): WorkspaceConfig[] {
		return Object.values(this.getWorkspaces()).sort(compareByName)
	}

	private generateId(): string {
		return `ws_${generateUniqueId()}`
	}
}
