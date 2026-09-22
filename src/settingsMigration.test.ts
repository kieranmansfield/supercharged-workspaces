import { describe, expect, it } from 'vitest'
import { migrateSettings } from './settingsMigration'
import { DEFAULT_SETTINGS } from './types'

describe('migrateSettings', () => {
	it('returns defaults for a fresh install (null)', () => {
		expect(migrateSettings(null)).toEqual(DEFAULT_SETTINGS)
	})

	it('returns defaults for an empty object', () => {
		expect(migrateSettings({})).toEqual(DEFAULT_SETTINGS)
	})

	it('passes through already-nested data unchanged', () => {
		const nested = {
			workspaces: { a: { id: 'a' } },
			folders: {},
			ui: { showStatusBar: false, showSmartGroups: false },
			features: {
				autoSave: true,
				enableBetaFolders: true,
				enableDragAndDrop: true,
				enablePin: true,
				enableStar: true,
				enableRecent: true,
			},
			ordering: { workspaceOrder: ['a'], folderOrder: [] },
			view: { activeWorkspaceId: 'a', activeSmartGroup: 'pinned', collapsedFolders: ['f1'] },
		}
		const result = migrateSettings(nested)
		expect(result.workspaces).toEqual(nested.workspaces)
		expect(result.ui).toEqual(nested.ui)
		expect(result.features).toEqual(nested.features)
		expect(result.ordering).toEqual(nested.ordering)
		expect(result.view.activeWorkspaceId).toBe('a')
		expect(result.view.activeSmartGroup).toBe('pinned')
		expect(result.view.collapsedFolders).toEqual(new Set(['f1']))
	})

	it('lifts a pre-0.0.9 flat settings object into the nested shape', () => {
		const flat = {
			workspaces: { a: { id: 'a' } },
			folders: { f1: { id: 'f1', name: 'Folder' } },
			activeWorkspaceId: 'a',
			autoSave: true,
			showStatusBar: false,
			enabledCommands: ['ignored-dead-field'],
			workspaceOrder: ['a'],
			folderOrder: ['f1'],
			activeSmartGroup: 'favorites',
			showSmartGroups: false,
			collapsedFolders: ['f1'],
			enableBetaFolders: true,
			enableDragAndDrop: true,
			enablePin: true,
			enableStar: true,
			enableRecent: true,
		}

		const result = migrateSettings(flat)

		expect(result.workspaces).toEqual(flat.workspaces)
		expect(result.folders).toEqual(flat.folders)
		expect(result.ui).toEqual({ showStatusBar: false, showSmartGroups: false })
		expect(result.features).toEqual({
			autoSave: true,
			enableBetaFolders: true,
			enableDragAndDrop: true,
			enablePin: true,
			enableStar: true,
			enableRecent: true,
		})
		expect(result.ordering).toEqual({ workspaceOrder: ['a'], folderOrder: ['f1'] })
		expect(result.view).toEqual({
			activeWorkspaceId: 'a',
			activeSmartGroup: 'favorites',
			collapsedFolders: new Set(['f1']),
		})
	})

	it('fills in missing fields from defaults on partial old data', () => {
		const partial = { showStatusBar: false }
		const result = migrateSettings(partial)
		expect(result.ui.showStatusBar).toBe(false)
		expect(result.ui.showSmartGroups).toBe(DEFAULT_SETTINGS.ui.showSmartGroups)
		expect(result.features).toEqual(DEFAULT_SETTINGS.features)
	})
})
