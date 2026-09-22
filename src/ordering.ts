export function applyOrder<T>(items: T[], order: string[] | undefined, getId: (item: T) => string): T[] {
	if (!order || order.length === 0) {
		return items
	}

	const ordered: T[] = []
	const remaining = new Map(items.map((item) => [getId(item), item]))

	for (const id of order) {
		const item = remaining.get(id)
		if (item) {
			ordered.push(item)
			remaining.delete(id)
		}
	}

	for (const item of remaining.values()) {
		ordered.push(item)
	}

	return ordered
}

export function reorder(currentOrder: string[], draggedId: string, targetId: string): string[] {
	const newOrder = [...currentOrder]
	const draggedIndex = newOrder.indexOf(draggedId)
	const targetIndex = newOrder.indexOf(targetId)

	if (draggedIndex === -1 || targetIndex === -1) {
		return newOrder
	}

	newOrder.splice(draggedIndex, 1)
	const insertIndex = newOrder.indexOf(targetId)
	newOrder.splice(insertIndex, 0, draggedId)

	return newOrder
}
