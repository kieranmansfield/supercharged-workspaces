import { describe, expect, it } from 'vitest'
import { applyOrder, reorder } from './ordering'

describe('applyOrder', () => {
	it('returns items unchanged when order is undefined', () => {
		const items = [{ id: 'a' }, { id: 'b' }]
		expect(applyOrder(items, undefined, (i) => i.id)).toEqual(items)
	})

	it('returns items unchanged when order is empty', () => {
		const items = [{ id: 'a' }, { id: 'b' }]
		expect(applyOrder(items, [], (i) => i.id)).toEqual(items)
	})

	it('reorders items to match the given order', () => {
		const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
		const result = applyOrder(items, ['c', 'a', 'b'], (i) => i.id)
		expect(result.map((i) => i.id)).toEqual(['c', 'a', 'b'])
	})

	it('appends items missing from the order, preserving their relative order', () => {
		const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
		const result = applyOrder(items, ['b'], (i) => i.id)
		expect(result.map((i) => i.id)).toEqual(['b', 'a', 'c'])
	})

	it('ignores stale ids in the order that no longer exist', () => {
		const items = [{ id: 'a' }, { id: 'b' }]
		const result = applyOrder(items, ['x', 'b', 'a'], (i) => i.id)
		expect(result.map((i) => i.id)).toEqual(['b', 'a'])
	})
})

describe('reorder', () => {
	it('moves a dragged item to sit before the target when dragging forward', () => {
		expect(reorder(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'a', 'c', 'd'])
	})

	it('moves a dragged item to sit before the target when dragging backward', () => {
		expect(reorder(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c'])
	})

	it('is a no-op when dragged and target are adjacent in the same direction', () => {
		expect(reorder(['a', 'b', 'c'], 'b', 'c')).toEqual(['a', 'b', 'c'])
	})

	it('returns the order unchanged when draggedId is missing', () => {
		expect(reorder(['a', 'b'], 'z', 'a')).toEqual(['a', 'b'])
	})

	it('returns the order unchanged when targetId is missing', () => {
		expect(reorder(['a', 'b'], 'a', 'z')).toEqual(['a', 'b'])
	})
})
