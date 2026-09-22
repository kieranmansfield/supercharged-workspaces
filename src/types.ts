export interface WorkspaceConfig {
	id: string
	name: string
	description?: string
	layout: unknown // Obsidian's workspace layout object
	createdAt: number
	updatedAt: number
	icon?: string
	commandEnabled?: boolean
	folderId?: string // Optional folder assignment
	pinned?: boolean // For pinned smart group
	starred?: boolean // For favorites smart group
	lastAccessed?: number // Timestamp for recent smart group
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
	activeWorkspaceId: string | null
	autoSave: boolean
	showStatusBar: boolean
	enabledCommands: Set<string>
	workspaceOrder: string[] // Array of workspace IDs in custom order
	folders: Record<string, WorkspaceFolder> // Folder definitions
	folderOrder: string[] // Order of folders in panel
	activeSmartGroup: SmartGroupType | null // Current view filter
	showSmartGroups: boolean // Toggle smart groups visibility
	collapsedFolders: Set<string> // Track which folders are collapsed
	enableBetaFolders: boolean // Toggle folder functionality (beta)
	enableDragAndDrop: boolean // Toggle drag-and-drop reordering
	enablePin: boolean // Toggle pin functionality
	enableStar: boolean // Toggle star functionality
	enableRecent: boolean // Toggle recent workspaces functionality
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
	activeWorkspaceId: null,
	autoSave: false,
	showStatusBar: true,
	enabledCommands: new Set(),
	workspaceOrder: [],
	folders: {},
	folderOrder: [],
	activeSmartGroup: null,
	showSmartGroups: true,
	collapsedFolders: new Set(),
	enableBetaFolders: false,
	enableDragAndDrop: false,
	enablePin: false,
	enableStar: false,
	enableRecent: false,
}
