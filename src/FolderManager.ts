import { PluginSettings, WorkspaceFolder } from './types'

export class FolderManager {
	constructor(
		private getSettings: () => PluginSettings,
		private saveSettings: () => Promise<void>
	) {}

	async create(name: string, icon?: string, color?: string): Promise<WorkspaceFolder> {
		const settings = this.getSettings()
		const id = `folder-${Date.now()}`

		const folder: WorkspaceFolder = {
			id,
			name,
			icon: icon || undefined,
			color: color || undefined,
			order: Object.keys(settings.folders).length,
			collapsed: false,
		}

		settings.folders[id] = folder
		settings.folderOrder.push(id)
		await this.saveSettings()

		return folder
	}

	async rename(id: string, name: string): Promise<void> {
		const folder = this.getById(id)
		if (!folder) return

		folder.name = name
		await this.saveSettings()
	}

	async setColor(id: string, color: string | undefined): Promise<void> {
		const folder = this.getById(id)
		if (!folder) return

		folder.color = color || undefined
		await this.saveSettings()
	}

	async delete(id: string): Promise<void> {
		const settings = this.getSettings()
		if (!settings.folders[id]) return

		for (const workspace of Object.values(settings.workspaces)) {
			if (workspace.folderId === id) {
				delete workspace.folderId
			}
		}

		delete settings.folders[id]
		settings.folderOrder = settings.folderOrder.filter((folderId) => folderId !== id)
		settings.collapsedFolders.delete(id)

		await this.saveSettings()
	}

	getById(id: string): WorkspaceFolder | undefined {
		return this.getSettings().folders[id]
	}

	getAll(): WorkspaceFolder[] {
		return Object.values(this.getSettings().folders)
	}
}
