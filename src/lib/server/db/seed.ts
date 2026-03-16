import { hash } from '@node-rs/argon2';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema/index';

const DB_PATH = process.env.DATABASE_PATH ?? './data/hrp.db';

function createId(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
	return Array.from(crypto.getRandomValues(new Uint8Array(21)))
		.map((b) => chars[b % 64])
		.join('');
}

async function seed() {
	console.log(`Seeding database at ${DB_PATH}...`);
	mkdirSync(dirname(DB_PATH), { recursive: true });

	const sqlite = new Database(DB_PATH);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	sqlite.pragma('synchronous = NORMAL');
	sqlite.pragma('cache_size = -64000');

	const db = drizzle(sqlite, { schema });
	console.log('Connected. Assuming schema is already applied (run pnpm db:push first).');

	const householdId = createId();
	const adminUserId = createId();
	const adultUserId = createId();

	const kitchenRoomId = createId();
	const livingRoomId = createId();
	const masterBedroomId = createId();
	const bathroomRoomId = createId();
	const garageRoomId = createId();

	const dishwasherAssetId = createId();
	const washingMachineAssetId = createId();
	const lawnMowerAssetId = createId();
	const sofaAssetId = createId();

	const kitchenProjectId = createId();
	const gardenProjectId = createId();

	const kitchenTaskPlanId = createId();
	const kitchenTaskInstallId = createId();
	const gardenTaskDesignId = createId();
	const gardenTaskQuoteId = createId();

	const materialsCategoryId = createId();
	const laborCategoryId = createId();

	const kitchenBudgetId = createId();
	const materialsLineId = createId();
	const laborLineId = createId();

	const expenseCabinetsId = createId();
	const expenseTilesId = createId();
	const expensePlumberId = createId();

	const dishwasherMaintenanceId = createId();
	const lawnMowerMaintenanceId = createId();

	const automationRuleProjectCompletionId = createId();
	const automationRuleBudgetWarningId = createId();
	const automationRuleMaintenanceDueId = createId();

	console.log('Hashing passwords...');
	const [adminPasswordHash, userPasswordHash] = await Promise.all([
		hash('admin123'),
		hash('user123')
	]);

	console.log('Clearing existing data...');
	db.delete(schema.automationLogs).run();
	db.delete(schema.automationRules).run();
	db.delete(schema.notifications).run();
	db.delete(schema.maintenanceLogs).run();
	db.delete(schema.maintenanceSchedules).run();
	db.delete(schema.expenses).run();
	db.delete(schema.budgetLines).run();
	db.delete(schema.budgets).run();
	db.delete(schema.expenseCategories).run();
	db.delete(schema.tasks).run();
	db.delete(schema.projectAssets).run();
	db.delete(schema.projectRooms).run();
	db.delete(schema.projectPhases).run();
	db.delete(schema.projects).run();
	db.delete(schema.assets).run();
	db.delete(schema.rooms).run();
	db.delete(schema.floorPlans).run();
	db.delete(schema.sessions).run();
	db.delete(schema.users).run();
	db.delete(schema.households).run();

	console.log('Inserting household and users...');
	db.insert(schema.households)
		.values({
			id: householdId,
			name: 'Morgan Family Home',
			currency: 'EUR',
			timezone: 'Europe/Paris',
			locale: 'en'
		})
		.run();

	db.insert(schema.users)
		.values([
			{
				id: adminUserId,
				householdId,
				email: 'admin@hrp.local',
				name: 'Alex Morgan',
				displayName: 'Alex',
				role: 'admin',
				passwordHash: adminPasswordHash,
				isActive: true
			},
			{
				id: adultUserId,
				householdId,
				email: 'jordan@hrp.local',
				name: 'Jordan Morgan',
				displayName: 'Jordan',
				role: 'adult',
				passwordHash: userPasswordHash,
				isActive: true
			}
		])
		.run();

	console.log('Inserting rooms and assets...');
	db.insert(schema.rooms)
		.values([
			{
				id: kitchenRoomId,
				householdId,
				name: 'Kitchen',
				type: 'kitchen',
				createdBy: adminUserId
			},
			{
				id: livingRoomId,
				householdId,
				name: 'Living Room',
				type: 'room',
				createdBy: adminUserId
			},
			{
				id: masterBedroomId,
				householdId,
				name: 'Master Bedroom',
				type: 'room',
				createdBy: adminUserId
			},
			{
				id: bathroomRoomId,
				householdId,
				name: 'Bathroom',
				type: 'bathroom',
				createdBy: adminUserId
			},
			{
				id: garageRoomId,
				householdId,
				name: 'Garage',
				type: 'garage',
				createdBy: adminUserId
			}
		])
		.run();

	db.insert(schema.assets)
		.values([
			{
				id: dishwasherAssetId,
				householdId,
				roomId: kitchenRoomId,
				name: 'Dishwasher',
				category: 'appliance',
				status: 'active',
				createdBy: adminUserId
			},
			{
				id: washingMachineAssetId,
				householdId,
				roomId: bathroomRoomId,
				name: 'Washing Machine',
				category: 'appliance',
				status: 'active',
				createdBy: adminUserId
			},
			{
				id: lawnMowerAssetId,
				householdId,
				roomId: garageRoomId,
				name: 'Lawn Mower',
				category: 'tool',
				status: 'active',
				createdBy: adminUserId
			},
			{
				id: sofaAssetId,
				householdId,
				roomId: livingRoomId,
				name: 'Sofa',
				category: 'furniture',
				status: 'active',
				createdBy: adminUserId
			}
		])
		.run();

	console.log('Inserting projects and tasks...');
	db.insert(schema.projects)
		.values([
			{
				id: kitchenProjectId,
				householdId,
				name: 'Kitchen Renovation',
				description: 'Upgrade cabinets, backsplash, and appliances.',
				type: 'renovation',
				status: 'in_progress',
				priority: 'high',
				startDate: '2025-02-10',
				endDate: '2025-06-15',
				budgetAmount: 15000,
				budgetCurrency: 'EUR',
				progressPercent: 45,
				createdBy: adminUserId
			},
			{
				id: gardenProjectId,
				householdId,
				name: 'Garden Landscaping',
				description: 'Plan and prepare landscaping for the back garden.',
				type: 'landscaping',
				status: 'planning',
				priority: 'medium',
				startDate: '2025-04-01',
				endDate: '2025-08-30',
				progressPercent: 10,
				createdBy: adminUserId
			}
		])
		.run();

	db.insert(schema.projectRooms)
		.values({
			projectId: kitchenProjectId,
			roomId: kitchenRoomId
		})
		.run();

	db.insert(schema.projectAssets)
		.values([
			{ projectId: kitchenProjectId, assetId: dishwasherAssetId, relationship: 'affected' },
			{ projectId: kitchenProjectId, assetId: washingMachineAssetId, relationship: 'affected' }
		])
		.run();

	db.insert(schema.tasks)
		.values([
			{
				id: kitchenTaskPlanId,
				householdId,
				projectId: kitchenProjectId,
				roomId: kitchenRoomId,
				title: 'Finalize cabinet design',
				description: 'Confirm dimensions and finish with contractor.',
				status: 'in_progress',
				priority: 'high',
				assigneeId: adminUserId,
				dueDate: '2025-03-15',
				createdBy: adminUserId
			},
			{
				id: kitchenTaskInstallId,
				householdId,
				projectId: kitchenProjectId,
				roomId: kitchenRoomId,
				title: 'Schedule appliance installation',
				description: 'Coordinate installation date for dishwasher and washer.',
				status: 'todo',
				priority: 'medium',
				assigneeId: adultUserId,
				dueDate: '2025-04-05',
				createdBy: adminUserId
			},
			{
				id: gardenTaskDesignId,
				householdId,
				projectId: gardenProjectId,
				title: 'Draft garden layout',
				description: 'Create planting zones and pathway plan.',
				status: 'todo',
				priority: 'medium',
				assigneeId: adultUserId,
				dueDate: '2025-04-20',
				createdBy: adminUserId
			},
			{
				id: gardenTaskQuoteId,
				householdId,
				projectId: gardenProjectId,
				title: 'Request landscaping quote',
				description: 'Gather at least two contractor estimates.',
				status: 'blocked',
				priority: 'low',
				assigneeId: adminUserId,
				dueDate: '2025-05-01',
				createdBy: adminUserId
			}
		])
		.run();

	console.log('Inserting finance data...');
	db.insert(schema.expenseCategories)
		.values([
			{
				id: materialsCategoryId,
				householdId,
				name: 'Materials',
				icon: 'package',
				color: '#4f46e5'
			},
			{
				id: laborCategoryId,
				householdId,
				name: 'Labor',
				icon: 'wrench',
				color: '#dc2626'
			}
		])
		.run();

	db.insert(schema.budgets)
		.values({
			id: kitchenBudgetId,
			householdId,
			projectId: kitchenProjectId,
			name: 'Kitchen Renovation Budget',
			description: 'Overall budget for the kitchen renovation project.',
			totalAmount: 15000,
			currency: 'EUR',
			startDate: '2025-02-01',
			endDate: '2025-06-30',
			warningThresholdPercent: 80,
			criticalThresholdPercent: 100,
			createdBy: adminUserId
		})
		.run();

	db.insert(schema.budgetLines)
		.values([
			{
				id: materialsLineId,
				budgetId: kitchenBudgetId,
				categoryId: materialsCategoryId,
				name: 'Materials Allocation',
				plannedAmount: 9000,
				sortOrder: 1
			},
			{
				id: laborLineId,
				budgetId: kitchenBudgetId,
				categoryId: laborCategoryId,
				name: 'Labor Allocation',
				plannedAmount: 6000,
				sortOrder: 2
			}
		])
		.run();

	db.insert(schema.expenses)
		.values([
			{
				id: expenseCabinetsId,
				householdId,
				projectId: kitchenProjectId,
				budgetId: kitchenBudgetId,
				budgetLineId: materialsLineId,
				categoryId: materialsCategoryId,
				description: 'Custom cabinet order',
				amount: 5200,
				currency: 'EUR',
				date: '2025-02-22',
				paymentMethod: 'transfer',
				vendor: 'Nordic Kitchens',
				createdBy: adminUserId
			},
			{
				id: expenseTilesId,
				householdId,
				projectId: kitchenProjectId,
				budgetId: kitchenBudgetId,
				budgetLineId: materialsLineId,
				categoryId: materialsCategoryId,
				description: 'Backsplash tiles',
				amount: 1900,
				currency: 'EUR',
				date: '2025-03-05',
				paymentMethod: 'card',
				vendor: 'Maison Ceramics',
				createdBy: adminUserId
			},
			{
				id: expensePlumberId,
				householdId,
				projectId: kitchenProjectId,
				budgetId: kitchenBudgetId,
				budgetLineId: laborLineId,
				categoryId: laborCategoryId,
				description: 'Plumbing installation labor',
				amount: 2400,
				currency: 'EUR',
				date: '2025-03-18',
				paymentMethod: 'transfer',
				vendor: 'Rivera Plumbing',
				createdBy: adminUserId
			}
		])
		.run();

	console.log('Inserting maintenance schedules...');
	db.insert(schema.maintenanceSchedules)
		.values([
			{
				id: dishwasherMaintenanceId,
				householdId,
				assetId: dishwasherAssetId,
				name: 'Dishwasher annual service',
				description: 'Run annual inspection and descaling service.',
				frequency: 'yearly',
				nextDueDate: '2025-11-15',
				reminderDaysBefore: 14,
				estimatedCost: 120,
				assigneeId: adultUserId,
				createdBy: adminUserId
			},
			{
				id: lawnMowerMaintenanceId,
				householdId,
				assetId: lawnMowerAssetId,
				name: 'Lawn mower seasonal maintenance',
				description: 'Sharpen blade and replace air filter before spring.',
				frequency: 'quarterly',
				nextDueDate: '2025-04-10',
				reminderDaysBefore: 7,
				estimatedCost: 60,
				assigneeId: adminUserId,
				createdBy: adminUserId
			}
		])
		.run();

	console.log('Inserting default automation rules...');
	db.insert(schema.automationRules)
		.values([
			{
				id: automationRuleProjectCompletionId,
				householdId,
				name: 'Project completion creates maintenance schedules',
				description:
					'When a project is completed, automatically create recurring maintenance schedules for linked assets.',
				trigger: 'project_completed',
				conditions: JSON.stringify({ entityType: 'project' }),
				actions: JSON.stringify([
					{
						type: 'create_maintenance_schedule',
						params: {
							frequency: 'yearly',
							description: 'Created automatically after project completion.'
						}
					}
				]),
				isEnabled: true,
				createdBy: adminUserId
			},
			{
				id: automationRuleBudgetWarningId,
				householdId,
				name: 'Budget threshold warning notification',
				description: 'Notify household admins when project expenses exceed warning threshold.',
				trigger: 'budget_threshold_exceeded',
				conditions: JSON.stringify({ entityType: 'budget' }),
				actions: JSON.stringify([
					{
						type: 'create_notification',
						params: {
							notificationType: 'budget_warning',
							title: 'Budget warning threshold reached',
							message: 'A budget has reached the configured warning threshold.'
						}
					}
				]),
				isEnabled: true,
				createdBy: adminUserId
			},
			{
				id: automationRuleMaintenanceDueId,
				householdId,
				name: 'Maintenance due reminder',
				description: 'Notify assignees when a maintenance schedule reaches its due date.',
				trigger: 'maintenance_due',
				conditions: JSON.stringify({ entityType: 'maintenance' }),
				actions: JSON.stringify([
					{
						type: 'create_notification',
						params: {
							notificationType: 'maintenance_due',
							title: 'Maintenance due',
							message: 'A maintenance schedule is due today.'
						}
					}
				]),
				isEnabled: true,
				createdBy: adminUserId
			}
		])
		.run();

	sqlite.close();
	console.log('Seed complete!');
}

seed().catch((error) => {
	console.error('Seed failed:', error);
	process.exitCode = 1;
});
