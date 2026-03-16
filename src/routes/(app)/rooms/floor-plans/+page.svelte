<script lang="ts">
	import { Plus, Pencil, Trash2, X, ArrowLeft } from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { t, translate } from '$lib/i18n/index.js';
	import { hasModuleAccess } from '$lib/permissions.js';
	import { selectClass } from '$lib/utils.js';

	let { data } = $props();
	const userRole = $derived(page.data.user?.role ?? 'guest');

	const floors = $derived([...new Set(data.plans.map((p) => p.floor))].sort((a, b) => a - b));
	let selectedFloor = $state(0);

	$effect(() => {
		if (floors.length > 0 && !floors.includes(selectedFloor)) {
			selectedFloor = floors[0];
		}
	});

	const activePlan = $derived(data.plans.find((p) => p.floor === selectedFloor));
	const planRooms = $derived(
		data.assignedRooms.filter((r) => r.floorPlanId === activePlan?.id)
	);

	let editMode = $state(false);
	let createOpen = $state(false);
	let editPlanOpen = $state(false);
	let deletePlanOpen = $state(false);
	let assignRoomOpen = $state(false);

	let uploadFile = $state<File | null>(null);
	let uploading = $state(false);

	let dragRoomId = $state<string | null>(null);
	let dragOffsetX = $state(0);
	let dragOffsetY = $state(0);
	let resizeRoomId = $state<string | null>(null);
	let resizeCorner = $state<string | null>(null);
	let resizeStartX = $state(0);
	let resizeStartY = $state(0);
	let resizeStartPos = $state({ x: 0, y: 0, w: 0, h: 0 });

	let livePositions = $state<Record<string, { x: number; y: number; w: number; h: number }>>({});

	let hoveredRoom = $state<string | null>(null);
	let containerEl = $state<HTMLDivElement | null>(null);

	function floorLabel(floor: number): string {
		if (floor < 0) return $t.rooms.basement;
		if (floor === 0) return $t.rooms.groundFloor;
		return translate('rooms.floorN', { n: String(floor) });
	}

	function getRoomPos(room: (typeof data.assignedRooms)[0]) {
		const live = livePositions[room.id];
		if (live) return live;
		return { x: room.posX ?? 45, y: room.posY ?? 45, w: room.posWidth ?? 10, h: room.posHeight ?? 10 };
	}

	function getContainerRect() {
		return containerEl?.getBoundingClientRect() ?? { left: 0, top: 0, width: 1, height: 1 };
	}

	function pxToPercent(px: number, total: number) {
		return (px / total) * 100;
	}

	function onOverlayPointerDown(e: PointerEvent, roomId: string) {
		if (!editMode) return;
		e.preventDefault();
		e.stopPropagation();
		const rect = getContainerRect();
		const room = planRooms.find((r) => r.id === roomId);
		if (!room) return;
		const pos = getRoomPos(room);
		dragRoomId = roomId;
		dragOffsetX = pxToPercent(e.clientX - rect.left, rect.width) - pos.x;
		dragOffsetY = pxToPercent(e.clientY - rect.top, rect.height) - pos.y;
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onOverlayPointerMove(e: PointerEvent, roomId: string) {
		if (dragRoomId !== roomId) return;
		const rect = getContainerRect();
		const room = planRooms.find((r) => r.id === roomId);
		if (!room) return;
		const pos = getRoomPos(room);
		let newX = pxToPercent(e.clientX - rect.left, rect.width) - dragOffsetX;
		let newY = pxToPercent(e.clientY - rect.top, rect.height) - dragOffsetY;
		newX = Math.max(0, Math.min(100 - pos.w, newX));
		newY = Math.max(0, Math.min(100 - pos.h, newY));
		livePositions[roomId] = { x: newX, y: newY, w: pos.w, h: pos.h };
	}

	function onOverlayPointerUp(roomId: string) {
		if (dragRoomId !== roomId) return;
		dragRoomId = null;
	}

	function onResizePointerDown(e: PointerEvent, roomId: string, corner: string) {
		if (!editMode) return;
		e.preventDefault();
		e.stopPropagation();
		const room = planRooms.find((r) => r.id === roomId);
		if (!room) return;
		const pos = getRoomPos(room);
		resizeRoomId = roomId;
		resizeCorner = corner;
		resizeStartX = e.clientX;
		resizeStartY = e.clientY;
		resizeStartPos = { x: pos.x, y: pos.y, w: pos.w, h: pos.h };
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onResizePointerMove(e: PointerEvent) {
		if (!resizeRoomId || !resizeCorner) return;
		const rect = getContainerRect();
		const dx = pxToPercent(e.clientX - resizeStartX, rect.width);
		const dy = pxToPercent(e.clientY - resizeStartY, rect.height);
		let { x, y, w, h } = resizeStartPos;

		if (resizeCorner.includes('e')) w = Math.max(3, w + dx);
		if (resizeCorner.includes('s')) h = Math.max(3, h + dy);
		if (resizeCorner.includes('w')) {
			const newW = Math.max(3, w - dx);
			x = x + w - newW;
			w = newW;
		}
		if (resizeCorner.includes('n')) {
			const newH = Math.max(3, h - dy);
			y = y + h - newH;
			h = newH;
		}

		x = Math.max(0, x);
		y = Math.max(0, y);
		if (x + w > 100) w = 100 - x;
		if (y + h > 100) h = 100 - y;

		livePositions[resizeRoomId] = { x, y, w, h };
	}

	function onResizePointerUp() {
		if (!resizeRoomId) return;
		resizeRoomId = null;
		resizeCorner = null;
	}

	let saving = $state(false);

	async function saveAllPositions() {
		const entries = Object.entries(livePositions);
		if (entries.length === 0) return;

		saving = true;
		try {
			const positions = entries.map(([roomId, pos]) => ({
				roomId,
				posX: Math.round(pos.x * 100) / 100,
				posY: Math.round(pos.y * 100) / 100,
				posWidth: Math.round(pos.w * 100) / 100,
				posHeight: Math.round(pos.h * 100) / 100
			}));

			const formData = new FormData();
			formData.set('positions', JSON.stringify(positions));
			await fetch('?/saveAllPositions', { method: 'POST', body: formData });
		} finally {
			saving = false;
		}
	}

	async function handleCreateSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!uploadFile || uploading) return;

		uploading = true;
		try {
			const imgDims = await getImageDimensions(uploadFile);

			const uploadFormData = new FormData();
			uploadFormData.set('file', uploadFile);
			uploadFormData.set('title', (e.target as HTMLFormElement).querySelector<HTMLInputElement>('[name="name"]')?.value ?? 'Floor Plan');
			uploadFormData.set('type', 'plan');

			const uploadRes = await fetch('/api/upload', { method: 'POST', body: uploadFormData });
			if (!uploadRes.ok) {
				uploading = false;
				return;
			}

			const uploadData = await uploadRes.json();

			const createFormData = new FormData();
			createFormData.set('name', (e.target as HTMLFormElement).querySelector<HTMLInputElement>('[name="name"]')?.value ?? '');
			createFormData.set('description', (e.target as HTMLFormElement).querySelector<HTMLTextAreaElement>('[name="description"]')?.value ?? '');
			createFormData.set('floor', (e.target as HTMLFormElement).querySelector<HTMLInputElement>('[name="floor"]')?.value ?? '0');
			createFormData.set('imagePath', uploadData.id);
			createFormData.set('imageWidth', String(imgDims.width));
			createFormData.set('imageHeight', String(imgDims.height));

			await fetch('?/createFloorPlan', { method: 'POST', body: createFormData });

			createOpen = false;
			uploadFile = null;
			window.location.reload();
		} finally {
			uploading = false;
		}
	}

	function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => {
				resolve({ width: img.naturalWidth, height: img.naturalHeight });
				URL.revokeObjectURL(img.src);
			};
			img.onerror = () => resolve({ width: 800, height: 600 });
			img.src = URL.createObjectURL(file);
		});
	}

	async function handleRemoveRoom(roomId: string) {
		const formData = new FormData();
		formData.set('roomId', roomId);
		await fetch('?/removeRoom', { method: 'POST', body: formData });
		window.location.reload();
	}

	function getCursorForCorner(corner: string): string {
		if (corner === 'nw' || corner === 'se') return 'cursor-nwse-resize';
		return 'cursor-nesw-resize';
	}
</script>

<svelte:window
	onpointermove={(e) => { if (resizeRoomId) onResizePointerMove(e); }}
	onpointerup={() => { if (resizeRoomId) onResizePointerUp(); }}
/>

<Dialog.Root bind:open={createOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{$t.rooms.newFloorPlan}</Dialog.Title>
		</Dialog.Header>
		<form onsubmit={handleCreateSubmit} class="space-y-4 pt-2">
			<div class="space-y-2">
				<Label for="fp-name">{$t.common.name} <span class="text-destructive">*</span></Label>
				<Input id="fp-name" name="name" required />
			</div>
			<div class="space-y-2">
				<Label for="fp-description">{$t.common.description}</Label>
				<Textarea id="fp-description" name="description" rows={2} />
			</div>
			<div class="space-y-2">
				<Label for="fp-floor">{$t.rooms.floorLevel}</Label>
				<Input id="fp-floor" name="floor" type="number" value="0" />
			</div>
			<div class="space-y-2">
				<Label for="fp-image">{$t.rooms.uploadImage} <span class="text-destructive">*</span></Label>
				<input
					id="fp-image"
					type="file"
					accept="image/*"
					required
					class={selectClass}
					onchange={(e) => { uploadFile = (e.target as HTMLInputElement).files?.[0] ?? null; }}
				/>
			</div>
			<Dialog.Footer>
				<Dialog.Close>
					<Button type="button" variant="outline">{$t.common.cancel}</Button>
				</Dialog.Close>
				<Button type="submit" disabled={uploading}>{uploading ? $t.common.loading : $t.common.create}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

{#if activePlan}
	<Dialog.Root bind:open={editPlanOpen}>
		<Dialog.Content class="sm:max-w-lg">
			<Dialog.Header>
				<Dialog.Title>{$t.rooms.editFloorPlan}</Dialog.Title>
			</Dialog.Header>
			<form
				method="POST"
				action="?/updateFloorPlan"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success') editPlanOpen = false;
						await update();
					};
				}}
				class="space-y-4 pt-2"
			>
				<input type="hidden" name="id" value={activePlan.id} />
				<div class="space-y-2">
					<Label for="edit-fp-name">{$t.common.name} <span class="text-destructive">*</span></Label>
					<Input id="edit-fp-name" name="name" required value={activePlan.name} />
				</div>
				<div class="space-y-2">
					<Label for="edit-fp-desc">{$t.common.description}</Label>
					<Textarea id="edit-fp-desc" name="description" rows={2} value={activePlan.description ?? ''} />
				</div>
				<div class="space-y-2">
					<Label for="edit-fp-floor">{$t.rooms.floorLevel}</Label>
					<Input id="edit-fp-floor" name="floor" type="number" value={String(activePlan.floor)} />
				</div>
				<Dialog.Footer>
					<Dialog.Close>
						<Button type="button" variant="outline">{$t.common.cancel}</Button>
					</Dialog.Close>
					<Button type="submit">{$t.common.save}</Button>
				</Dialog.Footer>
			</form>
		</Dialog.Content>
	</Dialog.Root>

	<AlertDialog.Root bind:open={deletePlanOpen}>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>{$t.rooms.deleteFloorPlan}</AlertDialog.Title>
				<AlertDialog.Description>{$t.rooms.deleteFloorPlanConfirm}</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel>{$t.common.cancel}</AlertDialog.Cancel>
				<form method="POST" action="?/deleteFloorPlan">
					<input type="hidden" name="id" value={activePlan.id} />
					<AlertDialog.Action type="submit" class="bg-destructive text-destructive-foreground hover:bg-destructive/90">
						{$t.common.delete}
					</AlertDialog.Action>
				</form>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>

	<Dialog.Root bind:open={assignRoomOpen}>
		<Dialog.Content class="sm:max-w-md">
			<Dialog.Header>
				<Dialog.Title>{$t.rooms.assignRoom}</Dialog.Title>
			</Dialog.Header>
			{#if data.unassignedRooms.length > 0}
				<form
					method="POST"
					action="?/assignRoom"
					use:enhance={() => {
						return async ({ result, update }) => {
							if (result.type === 'success') assignRoomOpen = false;
							await update();
						};
					}}
				>
					<input type="hidden" name="floorPlanId" value={activePlan.id} />
					<div class="space-y-4 py-4">
						<div class="space-y-2">
							<Label for="assign-room-select">{$t.rooms.title}</Label>
							<select id="assign-room-select" name="roomId" required class={selectClass}>
								<option value="">{$t.common.selectRoom}</option>
								{#each data.unassignedRooms as room}
									<option value={room.id}>{room.name} ({$t.rooms.type[room.type]})</option>
								{/each}
							</select>
						</div>
					</div>
					<Dialog.Footer>
						<Dialog.Close><Button type="button" variant="outline">{$t.common.cancel}</Button></Dialog.Close>
						<Button type="submit">{$t.common.link}</Button>
					</Dialog.Footer>
				</form>
			{:else}
				<p class="py-4 text-sm text-muted-foreground">{$t.common.noAvailable}</p>
			{/if}
		</Dialog.Content>
	</Dialog.Root>
{/if}

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<Button href="/rooms" variant="outline" size="icon"><ArrowLeft class="size-4" /></Button>
			<h1 class="text-2xl font-semibold">{$t.rooms.floorPlans}</h1>
		</div>
		<div class="flex items-center gap-2">
			{#if activePlan && hasModuleAccess(userRole, 'rooms', 'edit')}
				<Button
					variant={editMode ? 'default' : 'outline'}
					disabled={saving}
					onclick={async () => {
						if (editMode) {
							await saveAllPositions();
							editMode = false;
							livePositions = {};
						} else {
							editMode = true;
						}
					}}
				>
					{saving ? $t.common.loading : editMode ? $t.rooms.doneEditing : $t.rooms.editLayout}
				</Button>
			{/if}
			{#if hasModuleAccess(userRole, 'rooms', 'create')}
				<Button onclick={() => (createOpen = true)}><Plus class="size-4" />{$t.rooms.newFloorPlan}</Button>
			{/if}
		</div>
	</div>

	{#if data.plans.length === 0}
		<Card.Root>
			<Card.Content class="flex flex-col items-center justify-center gap-4 py-16">
				<p class="text-muted-foreground">{$t.rooms.noFloorPlans}</p>
				{#if hasModuleAccess(userRole, 'rooms', 'create')}
					<Button onclick={() => (createOpen = true)}><Plus class="size-4" />{$t.rooms.newFloorPlan}</Button>
				{/if}
			</Card.Content>
		</Card.Root>
	{:else}
		{#if floors.length > 1}
			<div class="flex flex-wrap gap-2">
				{#each floors as floor}
					<Button
						variant={selectedFloor === floor ? 'default' : 'outline'}
						size="sm"
						onclick={() => { selectedFloor = floor; editMode = false; livePositions = {}; }}
					>
						{floorLabel(floor)}
					</Button>
				{/each}
			</div>
		{/if}

		{#if activePlan}
			<Card.Root>
				<Card.Content class="space-y-4 pt-6">
					<div class="flex items-center justify-between">
						<div>
							<h2 class="text-lg font-medium">{activePlan.name}</h2>
							{#if activePlan.description}
								<p class="text-sm text-muted-foreground">{activePlan.description}</p>
							{/if}
						</div>
						<div class="flex items-center gap-1">
							{#if editMode && hasModuleAccess(userRole, 'rooms', 'edit')}
								<Button size="sm" variant="outline" onclick={() => (assignRoomOpen = true)}>
									<Plus class="size-4" />{$t.rooms.assignRoom}
								</Button>
							{/if}
							{#if hasModuleAccess(userRole, 'rooms', 'edit')}
								<Button variant="ghost" size="icon" onclick={() => (editPlanOpen = true)}>
									<Pencil class="size-4" />
								</Button>
							{/if}
							{#if hasModuleAccess(userRole, 'rooms', 'delete')}
								<Button variant="ghost" size="icon" class="text-destructive hover:text-destructive" onclick={() => (deletePlanOpen = true)}>
									<Trash2 class="size-4" />
								</Button>
							{/if}
						</div>
					</div>

					<div
						class="relative w-full overflow-hidden rounded-lg border bg-muted"
						style={activePlan.imageWidth && activePlan.imageHeight
							? `aspect-ratio: ${activePlan.imageWidth} / ${activePlan.imageHeight}`
							: 'aspect-ratio: 4 / 3'}
						bind:this={containerEl}
					>
						<img
							src="/api/download?documentId={activePlan.imagePath}"
							alt={activePlan.name}
							class="absolute inset-0 h-full w-full object-contain"
							draggable="false"
						/>

						{#each planRooms as room (room.id)}
							{@const pos = getRoomPos(room)}
							{@const color = room.color ?? '#a1a1aa'}
							{@const isHovered = hoveredRoom === room.id}
							<div
								class="absolute border-2 transition-shadow {editMode ? 'cursor-move' : 'cursor-pointer'} {isHovered ? 'shadow-lg z-20' : 'z-10'}"
								style="left: {pos.x}%; top: {pos.y}%; width: {pos.w}%; height: {pos.h}%; background-color: {color}33; border-color: {color}; touch-action: none;"
								role="button"
								tabindex="0"
								onpointerdown={(e) => { if (editMode && !resizeRoomId) onOverlayPointerDown(e, room.id); }}
								onpointermove={(e) => { if (dragRoomId === room.id) onOverlayPointerMove(e, room.id); }}
								onpointerup={() => { if (dragRoomId === room.id) onOverlayPointerUp(room.id); }}
								onclick={() => { if (!editMode && !dragRoomId) goto(`/rooms/${room.id}`); }}
								onmouseenter={() => { hoveredRoom = room.id; }}
								onmouseleave={() => { hoveredRoom = null; }}
								onkeydown={(e) => { if (e.key === 'Enter' && !editMode) goto(`/rooms/${room.id}`); }}
							>
								<span
									class="absolute inset-0 flex items-center justify-center text-xs font-medium drop-shadow-sm"
									style="color: {color}"
								>
									{room.name}
								</span>

								{#if isHovered && !editMode}
									<div class="pointer-events-none absolute -top-20 left-1/2 z-30 w-40 -translate-x-1/2 rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md">
										<p class="font-semibold">{room.name}</p>
										<p class="text-muted-foreground">{$t.rooms.type[room.type]}</p>
										<p class="text-muted-foreground">{translate('rooms.assetsInRoom', { count: String(data.assetCountMap[room.id] ?? 0) })}</p>
									</div>
								{/if}

								{#if editMode}
									<button
										class="absolute -right-2 -top-2 z-30 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm"
										onclick={(e) => { e.stopPropagation(); handleRemoveRoom(room.id); }}
										type="button"
									>
										<X class="size-3" />
									</button>

									{#each ['nw', 'ne', 'sw', 'se'] as corner}
										<div
											class="absolute z-30 size-2 rounded-sm bg-primary shadow-sm {getCursorForCorner(corner)}"
											style={corner === 'nw' ? 'top: -4px; left: -4px;'
												: corner === 'ne' ? 'top: -4px; right: -4px;'
												: corner === 'sw' ? 'bottom: -4px; left: -4px;'
												: 'bottom: -4px; right: -4px;'}
											role="slider"
											tabindex="-1"
											aria-label="Resize {corner}"
											onpointerdown={(e) => onResizePointerDown(e, room.id, corner)}
										></div>
									{/each}
								{/if}
							</div>
						{/each}
					</div>
				</Card.Content>
			</Card.Root>
		{/if}
	{/if}
</div>
