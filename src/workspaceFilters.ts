import { SmartGroupType, WorkspaceConfig } from './types'

// Strips a leading emoji (and any space after it) so names sort by their
// actual text, regardless of whether an icon was typed into the name field.
const LEADING_EMOJI = /^\p{Extended_Pictographic}️?\s*/u

function sortKey(name: string): string {
	return name.replace(LEADING_EMOJI, '').trim().toLowerCase()
}

export function compareByName(a: { name: string }, b: { name: string }): number {
	return sortKey(a.name).localeCompare(sortKey(b.name))
}

export function filterBySmartGroup(
	workspaces: WorkspaceConfig[],
	filter: SmartGroupType | null
): WorkspaceConfig[] {
	switch (filter) {
		case 'recent':
			// Last 10 accessed workspaces
			return workspaces
				.filter((w) => w.lastAccessed)
				.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))
				.slice(0, 10)

		case 'pinned':
			return workspaces.filter((w) => w.pinned)

		case 'favorites':
			return workspaces.filter((w) => w.starred)

		case 'all':
		default:
			return workspaces
	}
}

export function sortWorkspacesByPriority(
	workspaces: WorkspaceConfig[],
	enablePin: boolean,
	enableStar: boolean
): WorkspaceConfig[] {
	// Only sort if at least one feature is enabled
	if (!enablePin && !enableStar) {
		return workspaces
	}

	// fallow-ignore-next-line complexity
	return [...workspaces].sort((a, b) => {
		// Pinned workspaces come first (if enabled)
		if (enablePin) {
			if (a.pinned && !b.pinned) return -1
			if (!a.pinned && b.pinned) return 1
		}

		// Then starred workspaces (if enabled)
		if (enableStar) {
			if (a.starred && !b.starred) return -1
			if (!a.starred && b.starred) return 1
		}

		// Otherwise maintain existing order (return 0 to preserve stability)
		return 0
	})
}

export function groupWorkspacesByFolder(
	orderedWorkspaces: WorkspaceConfig[],
	workspaces: WorkspaceConfig[]
): Map<string | null, WorkspaceConfig[]> {
	const grouped = new Map<string | null, WorkspaceConfig[]>()
	const workspaceSet = new Set(workspaces.map((w) => w.id))

	// Group workspaces by folder while maintaining order
	orderedWorkspaces.forEach((workspace) => {
		// Only include workspaces from the input array (for filtering)
		if (!workspaceSet.has(workspace.id)) return

		const folderId = workspace.folderId || null
		if (!grouped.has(folderId)) {
			grouped.set(folderId, [])
		}
		const group = grouped.get(folderId)
		if (group) {
			group.push(workspace)
		}
	})

	return grouped
}
