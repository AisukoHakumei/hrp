<script lang="ts">
	import { ChevronLeft, ChevronRight } from "@lucide/svelte";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Card from "$lib/components/ui/card/index.js";
	import { t } from "$lib/i18n/index.js";

	type CalendarEvent = {
		id: string;
		name: string;
		date: string;
		type: "task" | "maintenance" | "project";
	};

	let { data } = $props<{
		data: {
			events: CalendarEvent[];
			view: "month" | "week";
			month: number;
			year: number;
			week: number;
		};
	}>();

	const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

	function generateCalendarDays(year: number, month: number) {
		const firstDay = new Date(year, month - 1, 1);
		const dayOfWeek = firstDay.getDay();
		const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
		const startDate = new Date(firstDay);
		startDate.setDate(startDate.getDate() - offset);
		const today = new Date();
		const days = [];
		for (let i = 0; i < 42; i++) {
			const d = new Date(startDate);
			d.setDate(startDate.getDate() + i);
			days.push({
				day: d.getDate(),
				isCurrentMonth: d.getMonth() === month - 1 && d.getFullYear() === year,
				isToday: d.toDateString() === today.toDateString(),
				dateStr: d.toISOString().split("T")[0],
			});
		}
		return days;
	}

	function getAdjacentMonth(month: number, year: number, delta: number) {
		const d = new Date(year, month - 1 + delta, 1);
		return {
			month: d.getMonth() + 1,
			year: d.getFullYear(),
		};
	}

	function getWeekDates(year: number, weekNumber: number): Date[] {
		const jan4 = new Date(year, 0, 4);
		const dayOfWeek = jan4.getDay() || 7;
		const mondayOfWeek1 = new Date(jan4);
		mondayOfWeek1.setDate(jan4.getDate() - dayOfWeek + 1);
		const targetMonday = new Date(mondayOfWeek1);
		targetMonday.setDate(mondayOfWeek1.getDate() + (weekNumber - 1) * 7);
		const dates: Date[] = [];
		for (let i = 0; i < 7; i++) {
			const d = new Date(targetMonday);
			d.setDate(targetMonday.getDate() + i);
			dates.push(d);
		}
		return dates;
	}

	function getISOWeekClient(date: Date): number {
		const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
		const dayNum = d.getUTCDay() || 7;
		d.setUTCDate(d.getUTCDate() + 4 - dayNum);
		const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
		return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
	}

	function getISOWeekYear(date: Date): number {
		const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
		const dayNum = d.getUTCDay() || 7;
		d.setUTCDate(d.getUTCDate() + 4 - dayNum);
		return d.getUTCFullYear();
	}

	function getAdjacentWeek(year: number, week: number, delta: number) {
		const dates = getWeekDates(year, week);
		const targetDate = new Date(dates[0]);
		targetDate.setDate(targetDate.getDate() + delta * 7);
		return {
			week: getISOWeekClient(targetDate),
			year: getISOWeekYear(targetDate),
		};
	}

	function getEventClass(type: CalendarEvent["type"]) {
		if (type === "task") return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
		if (type === "maintenance") return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
		return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
	}

	function getEventTypeLabel(type: CalendarEvent["type"]) {
		if (type === "task") return $t.calendar.task;
		if (type === "maintenance") return $t.calendar.maintenance;
		return $t.calendar.project;
	}

	const calendarDays = $derived(generateCalendarDays(data.year, data.month));
	const prevMonth = $derived(getAdjacentMonth(data.month, data.year, -1));
	const nextMonth = $derived(getAdjacentMonth(data.month, data.year, 1));
	const prevWeek = $derived(getAdjacentWeek(data.year, data.week, -1));
	const nextWeek = $derived(getAdjacentWeek(data.year, data.week, 1));
	const weekDates = $derived(getWeekDates(data.year, data.week));
	const weekDateKeys = $derived(weekDates.map((date) => date.toISOString().split("T")[0]));
	const currentWeekEvents = $derived(
		data.events
			.filter((event: CalendarEvent) => weekDateKeys.includes(event.date.split("T")[0]))
			.sort((a: CalendarEvent, b: CalendarEvent) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name)),
	);
	const weekTitle = $derived(
		`${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(weekDates[0])} - ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(weekDates[6])}, ${new Intl.DateTimeFormat(undefined, { year: "numeric" }).format(weekDates[6])}`,
	);
	const todayLink = $derived.by(() => {
		const now = new Date();
		if (data.view === "week") {
			return `?view=week&week=${getISOWeekClient(now)}&year=${getISOWeekYear(now)}`;
		}
		return `?view=month&month=${now.getMonth() + 1}&year=${now.getFullYear()}`;
	});
	const monthTitle = $derived(new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(data.year, data.month - 1, 1)));

	const eventsByDate = $derived(
		data.events.reduce(
			(acc: Record<string, CalendarEvent[]>, event: CalendarEvent) => {
				if (event.date) {
					const key = event.date.split("T")[0];
					if (!acc[key]) acc[key] = [];
					acc[key].push(event);
				}
				return acc;
			},
			{} as Record<string, CalendarEvent[]>,
		),
	);

	const currentMonthKey = $derived(`${data.year}-${String(data.month).padStart(2, "0")}`);
	const currentMonthEvents = $derived(data.events.filter((event: CalendarEvent) => event.date.startsWith(currentMonthKey)).sort((a: CalendarEvent, b: CalendarEvent) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name)));
</script>

<div class="space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h1 class="text-2xl font-semibold">{$t.calendar.title}</h1>
		<div class="flex items-center gap-2">
			<Button href={`?view=month&month=${data.month}&year=${data.year}`} variant={data.view === "month" ? "default" : "outline"} size="sm">
				{$t.calendar.month}
			</Button>
			<Button href={`?view=week&week=${data.week}&year=${data.year}`} variant={data.view === "week" ? "default" : "outline"} size="sm">
				{$t.calendar.week}
			</Button>
		</div>
		<Button href={todayLink} variant="outline" size="sm">{$t.calendar.today}</Button>
	</div>

	<Card.Root>
		<Card.Content class="space-y-6 pt-6">
			{#if data.view === "week"}
				<div class="flex items-center justify-between gap-3">
					<Button href={`?view=week&week=${prevWeek.week}&year=${prevWeek.year}`} variant="outline" size="icon" aria-label={$t.calendar.prevWeek}>
						<ChevronLeft class="size-4" />
					</Button>
					<h2 class="text-lg font-semibold">{weekTitle}</h2>
					<Button href={`?view=week&week=${nextWeek.week}&year=${nextWeek.year}`} variant="outline" size="icon" aria-label={$t.calendar.nextWeek}>
						<ChevronRight class="size-4" />
					</Button>
				</div>

				<div class="grid grid-cols-7 gap-2">
					{#each weekDates as weekDate, index}
						{@const dayKey = weekDate.toISOString().split("T")[0]}
						{@const dayEvents = eventsByDate[dayKey] ?? []}
						<div class={`min-h-[200px] rounded-lg border bg-card p-2 ${weekDate.toDateString() === new Date().toDateString() ? "ring-2 ring-primary" : ""}`}>
							<p class="text-xs font-semibold text-foreground">
								{weekdayLabels[index]} {weekDate.getDate()}
							</p>
							<div class="mt-2 space-y-1">
								{#each dayEvents as event}
									<Badge class={`w-full justify-start truncate border-transparent px-2 py-0.5 text-[11px] font-medium ${getEventClass(event.type)}`}>
										{event.name}
									</Badge>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="flex items-center justify-between gap-3">
					<Button href={`?view=month&month=${prevMonth.month}&year=${prevMonth.year}`} variant="outline" size="icon" aria-label={$t.calendar.prevMonth}>
						<ChevronLeft class="size-4" />
					</Button>
					<h2 class="text-lg font-semibold capitalize">{monthTitle}</h2>
					<Button href={`?view=month&month=${nextMonth.month}&year=${nextMonth.year}`} variant="outline" size="icon" aria-label={$t.calendar.nextMonth}>
						<ChevronRight class="size-4" />
					</Button>
				</div>

				<div class="grid grid-cols-7 gap-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
					{#each weekdayLabels as dayName}
						<div class="py-1">{dayName}</div>
					{/each}
				</div>

				<div class="grid grid-cols-7 gap-2">
					{#each calendarDays as day}
						{@const dayEvents = eventsByDate[day.dateStr] ?? []}
						<div class={`min-h-[80px] rounded-lg border bg-card p-2 md:min-h-[100px] ${day.isCurrentMonth ? "" : "bg-muted/20"} ${day.isToday ? "ring-2 ring-primary" : ""}`}>
							<p class={`text-xs font-semibold ${day.isCurrentMonth ? "text-foreground" : "text-muted-foreground"}`}>
								{day.day}
							</p>
							<div class="mt-2 space-y-1">
								{#each dayEvents.slice(0, 3) as event}
									<Badge class={`w-full justify-start truncate border-transparent px-2 py-0.5 text-[11px] font-medium ${getEventClass(event.type)}`}>
										{event.name}
									</Badge>
								{/each}
								{#if dayEvents.length > 3}
									<p class="text-[11px] text-muted-foreground">+{dayEvents.length - 3} more</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<div class="flex flex-wrap items-center gap-2 text-xs">
				<Badge class={`border-transparent ${getEventClass("task")}`}>{$t.calendar.task}</Badge>
				<Badge class={`border-transparent ${getEventClass("maintenance")}`}>{$t.calendar.maintenance}</Badge>
				<Badge class={`border-transparent ${getEventClass("project")}`}>{$t.calendar.project}</Badge>
			</div>

			<div class="space-y-2">
				<h3 class="text-sm font-semibold">{$t.calendar.events}</h3>
				{#if data.view === "week"}
					{#if currentWeekEvents.length === 0}
						<p class="text-sm text-muted-foreground">{$t.calendar.noEventsThisWeek}</p>
					{:else}
					<div class="space-y-2">
						{#each currentWeekEvents as event (event.id)}
								<div class="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
									<div class="min-w-0">
										<p class="truncate font-medium">{event.name}</p>
										<p class="text-xs text-muted-foreground">{event.date.split("T")[0]}</p>
									</div>
									<Badge class={`shrink-0 border-transparent ${getEventClass(event.type)}`}>
										{getEventTypeLabel(event.type)}
									</Badge>
								</div>
							{/each}
						</div>
					{/if}
				{:else}
					{#if currentMonthEvents.length === 0}
						<p class="text-sm text-muted-foreground">{$t.calendar.noEvents}</p>
					{:else}
					<div class="space-y-2">
						{#each currentMonthEvents as event (event.id)}
								<div class="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
									<div class="min-w-0">
										<p class="truncate font-medium">{event.name}</p>
										<p class="text-xs text-muted-foreground">{event.date.split("T")[0]}</p>
									</div>
									<Badge class={`shrink-0 border-transparent ${getEventClass(event.type)}`}>
										{getEventTypeLabel(event.type)}
									</Badge>
								</div>
							{/each}
						</div>
					{/if}
				{/if}
			</div>
		</Card.Content>
	</Card.Root>
</div>
