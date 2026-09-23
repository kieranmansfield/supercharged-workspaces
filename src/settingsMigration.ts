import { DEFAULT_SETTINGS, PluginSettings, SmartGroupType } from './types'

/**
 * Loads persisted settings into the current nested PluginSettings shape.
 * Handles three cases: fresh install (raw is null), already-nested data
 * (current format), and pre-nesting flat data (versions <= 0.0.8).
 */
export function migrateSettings(raw: unknown): PluginSettings {
	const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
	const nested = isNestedFormat(data) ? data : liftFlatFormat(data)

	return {
		workspaces: (nested.workspaces as PluginSettings['workspaces']) ?? DEFAULT_SETTINGS.workspaces,
		folders: (nested.folders as PluginSettings['folders']) ?? DEFAULT_SETTINGS.folders,
		ui: buildUi(asRecord(nested.ui)),
		features: buildFeatures(asRecord(nested.features)),
		ordering: buildOrdering(asRecord(nested.ordering)),
		view: buildView(asRecord(nested.view)),
	}
}

function buildUi(ui: Record<string, unknown>): PluginSettings['ui'] {
	return {
		showStatusBar: (ui.showStatusBar as boolean) ?? DEFAULT_SETTINGS.ui.showStatusBar,
	}
}

function buildFeatures(features: Record<string, unknown>): PluginSettings['features'] {
	const defaults = DEFAULT_SETTINGS.features
	return {
		autoSave: (features.autoSave as boolean) ?? defaults.autoSave,
		enableBetaFolders: (features.enableBetaFolders as boolean) ?? defaults.enableBetaFolders,
		enableDragAndDrop: (features.enableDragAndDrop as boolean) ?? defaults.enableDragAndDrop,
		enablePin: (features.enablePin as boolean) ?? defaults.enablePin,
		enableStar: (features.enableStar as boolean) ?? defaults.enableStar,
		enableRecent: (features.enableRecent as boolean) ?? defaults.enableRecent,
	}
}

function buildOrdering(ordering: Record<string, unknown>): PluginSettings['ordering'] {
	return {
		workspaceOrder: (ordering.workspaceOrder as string[]) ?? [],
		folderOrder: (ordering.folderOrder as string[]) ?? [],
	}
}

function buildView(view: Record<string, unknown>): PluginSettings['view'] {
	return {
		activeWorkspaceId: (view.activeWorkspaceId as string | null) ?? null,
		activeSmartGroup: (view.activeSmartGroup as SmartGroupType | null) ?? null,
		collapsedFolders: toSet(view.collapsedFolders),
	}
}

function isNestedFormat(data: Record<string, unknown>): boolean {
	return typeof data.ui === 'object' && data.ui !== null
}

function liftFlatFormat(flat: Record<string, unknown>): Record<string, unknown> {
	return {
		workspaces: flat.workspaces,
		folders: flat.folders,
		ui: {
			showStatusBar: flat.showStatusBar,
		},
		features: {
			autoSave: flat.autoSave,
			enableBetaFolders: flat.enableBetaFolders,
			enableDragAndDrop: flat.enableDragAndDrop,
			enablePin: flat.enablePin,
			enableStar: flat.enableStar,
			enableRecent: flat.enableRecent,
		},
		ordering: {
			workspaceOrder: flat.workspaceOrder,
			folderOrder: flat.folderOrder,
		},
		view: {
			activeWorkspaceId: flat.activeWorkspaceId,
			activeSmartGroup: flat.activeSmartGroup,
			collapsedFolders: flat.collapsedFolders,
		},
	}
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function toSet(value: unknown): Set<string> {
	return Array.isArray(value) ? new Set(value as string[]) : new Set()
}
