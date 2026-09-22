import { describe, expect, it } from 'vitest'
import { filterBySmartGroup, groupWorkspacesByFolder, sortWorkspacesByPriority } from './workspaceFilters'
import { WorkspaceConfig } from './types'

function makeWorkspace(overrides: Partial<WorkspaceConfig> & { id: string }): WorkspaceConfig {
	return {
		name: overrides.id,
		layout: {},
		createdAt: 0,
		updatedAt: 0,
		...overrides,
	}
}

describe('filterBySmartGroup', () => {
	const workspaces = [
		makeWorkspace({ id: 'a', pinned: true }),
		makeWorkspace({ id: 'b', starred: true }),
		makeWorkspace({ id: 'c', lastAccessed: 100 }),
		makeWorkspace({ id: 'd' }),
	]

	it('returns everything for "all" or null', () => {
		expect(filterBySmartGroup(workspaces, 'all')).toEqual(workspaces)
		expect(filterBySmartGroup(workspaces, null)).toEqual(workspaces)
	})

	it('filters to pinned workspaces', () => {
		expect(filterBySmartGroup(workspaces, 'pinned').map((w) => w.id)).toEqual(['a'])
	})

	it('filters to starred workspaces', () => {
		expect(filterBySmartGroup(workspaces, 'favorites').map((w) => w.id)).toEqual(['b'])
	})

	it('filters to recently accessed, most recent first, capped at 10', () => {
		const recent = [
			makeWorkspace({ id: 'x', lastAccessed: 5 }),
			makeWorkspace({ id: 'y', lastAccessed: 20 }),
			makeWorkspace({ id: 'z' }),
		]
		expect(filterBySmartGroup(recent, 'recent').map((w) => w.id)).toEqual(['y', 'x'])
	})
})

describe('sortWorkspacesByPriority', () => {
	const workspaces = [
		makeWorkspace({ id: 'a' }),
		makeWorkspace({ id: 'b', pinned: true }),
		makeWorkspace({ id: 'c', starred: true }),
	]

	it('returns workspaces unchanged when both features disabled', () => {
		expect(sortWorkspacesByPriority(workspaces, false, false)).toEqual(workspaces)
	})

	it('does not mutate the input array', () => {
		const copy = [...workspaces]
		sortWorkspacesByPriority(workspaces, true, true)
		expect(workspaces).toEqual(copy)
	})

	it('puts pinned first when pin is enabled', () => {
		expect(sortWorkspacesByPriority(workspaces, true, false).map((w) => w.id)).toEqual(['b', 'a', 'c'])
	})

	it('puts starred first when star is enabled and pin is not', () => {
		expect(sortWorkspacesByPriority(workspaces, false, true).map((w) => w.id)).toEqual(['c', 'a', 'b'])
	})

	it('prioritizes pinned over starred when both enabled', () => {
		expect(sortWorkspacesByPriority(workspaces, true, true).map((w) => w.id)).toEqual(['b', 'c', 'a'])
	})
})

describe('groupWorkspacesByFolder', () => {
	it('groups workspaces by folderId, preserving order, using null for no folder', () => {
		const ordered = [
			makeWorkspace({ id: 'a', folderId: 'f1' }),
			makeWorkspace({ id: 'b' }),
			makeWorkspace({ id: 'c', folderId: 'f1' }),
			makeWorkspace({ id: 'd', folderId: 'f2' }),
		]
		const grouped = groupWorkspacesByFolder(ordered, ordered)
		expect(grouped.get('f1')?.map((w) => w.id)).toEqual(['a', 'c'])
		expect(grouped.get('f2')?.map((w) => w.id)).toEqual(['d'])
		expect(grouped.get(null)?.map((w) => w.id)).toEqual(['b'])
	})

	it('only includes workspaces present in the filtered subset', () => {
		const ordered = [
			makeWorkspace({ id: 'a', folderId: 'f1' }),
			makeWorkspace({ id: 'b', folderId: 'f1' }),
		]
		const filtered = [ordered[1]]
		const grouped = groupWorkspacesByFolder(ordered, filtered)
		expect(grouped.get('f1')?.map((w) => w.id)).toEqual(['b'])
	})
})
