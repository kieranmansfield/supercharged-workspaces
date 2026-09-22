import { App, Notice } from 'obsidian'
import { WorkspaceConfig } from './types'
import { generateUniqueId } from './id'

export class WorkspaceManager {
	constructor(
		private app: App,
		private getWorkspaces: () => Record<string, WorkspaceConfig>,
		private saveSettings: () => Promise<void>
	) {}

	async saveWorkspace(name: string, description?: string, icon?: string): Promise<WorkspaceConfig> {
		const layout = this.app.workspace.getLayout()
		const id = this.generateId()
		const now = Date.now()

		const workspace: WorkspaceConfig = {
			id,
			name,
			description,
			icon,
			layout,
			createdAt: now,
			updatedAt: now,
		}

		const workspaces = this.getWorkspaces()
		workspaces[id] = workspace
		await this.saveSettings()

		new Notice(`Workspace "${name}" saved successfully`)
		return workspace
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

	async updateWorkspace(id: string, updates: Partial<WorkspaceConfig>): Promise<void> {
		const workspaces = this.getWorkspaces()
		const workspace = workspaces[id]

		if (!workspace) {
			new Notice('Workspace not found')
			return
		}

		Object.assign(workspace, updates, { updatedAt: Date.now() })
		await this.saveSettings()
		new Notice(`Workspace "${workspace.name}" updated`)
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
		return Object.values(this.getWorkspaces()).sort((a, b) => b.updatedAt - a.updatedAt)
	}

	private generateId(): string {
		return `ws_${generateUniqueId()}`
	}
}
