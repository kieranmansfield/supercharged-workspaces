export interface WorkspaceConfig {
	id: string
	name: string
	description?: string
	layout: Record<string, unknown> // Obsidian's workspace layout object
	createdAt: number
	updatedAt: number
	icon?: string
	commandEnabled?: boolean
	folderId?: string // Optional folder assignment
	pinned?: boolean // For pinned smart group
	starred?: boolean // For favorites smart group
	lastAccessed?: number // Timestamp for recent smart group
	isTemplate?: boolean // Marked as a reusable starting point for new workspaces
}

export interface WorkspaceFolder {
	id: string
	name: string
	icon?: string
	color?: string
	collapsed?: boolean // UI state for collapsible sections
	order?: number // For manual folder ordering
}

export type SmartGroupType = 'all' | 'recent' | 'pinned' | 'favorites'

export interface PluginSettings {
	workspaces: Record<string, WorkspaceConfig>
	folders: Record<string, WorkspaceFolder> // Folder definitions
	ui: {
		showStatusBar: boolean
	}
	features: {
		autoSave: boolean
		enableBetaFolders: boolean // Toggle folder functionality (beta)
		enableDragAndDrop: boolean // Toggle drag-and-drop reordering
		enablePin: boolean // Toggle pin functionality
		enableStar: boolean // Toggle star functionality
		enableRecent: boolean // Toggle recent workspaces functionality
	}
	ordering: {
		workspaceOrder: string[] // Array of workspace IDs in custom order
		folderOrder: string[] // Order of folders in panel
	}
	view: {
		activeWorkspaceId: string | null
		activeSmartGroup: SmartGroupType | null // Current view filter
		collapsedFolders: Set<string> // Track which folders are collapsed
	}
}

export const FOLDER_COLORS: { name: string; value: string }[] = [
	{ name: 'None', value: '' },
	{ name: 'Red', value: '#e74c3c' },
	{ name: 'Blue', value: '#3498db' },
	{ name: 'Green', value: '#2ecc71' },
	{ name: 'Yellow', value: '#f39c12' },
	{ name: 'Purple', value: '#9b59b6' },
	{ name: 'Orange', value: '#e67e22' },
	{ name: 'Pink', value: '#ff69b4' },
]

export const DEFAULT_SETTINGS: PluginSettings = {
	workspaces: {},
	folders: {},
	ui: {
		showStatusBar: true,
	},
	features: {
		autoSave: false,
		enableBetaFolders: false,
		enableDragAndDrop: false,
		enablePin: false,
		enableStar: false,
		enableRecent: false,
	},
	ordering: {
		workspaceOrder: [],
		folderOrder: [],
	},
	view: {
		activeWorkspaceId: null,
		activeSmartGroup: null,
		collapsedFolders: new Set(),
	},
}
