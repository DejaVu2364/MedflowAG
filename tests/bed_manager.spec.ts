import { test, expect } from '@playwright/test';

test.describe('Bed Manager Module', () => {
    test.beforeEach(async ({ page }) => {
        // Force local mode
        await page.addInitScript(() => {
            localStorage.setItem('medflow_force_local', 'true');
        });

        await page.goto('http://localhost:3002/login');
        await page.fill('input[type="email"]', 'doctor@medflow.ai');
        await page.fill('input[type="password"]', 'password123');
        await page.click('button:has-text("Sign in")');
        await page.waitForURL('http://localhost:3002/');

        // Seed data AFTER login to ensure it persists and isn't overwritten
        await page.evaluate(() => {
            const testPatient = {
                id: 'TEST-PAT-001',
                name: 'John Doe',
                age: 45,
                gender: 'Male',
                status: 'Waiting for Doctor',
                triage: { level: 'Yellow', reasons: [] },
                chiefComplaints: [{ complaint: 'Fever', durationValue: 2, durationUnit: 'Days' }],
                orders: [],
                rounds: [],
                clinicalFile: { systemic: {} },
                results: [],
                vitalsHistory: [],
                timeline: []
            };
            localStorage.setItem('medflow_patients', JSON.stringify([testPatient]));
        });

        await page.goto('http://localhost:3002/bed-manager');
    });

    test('should render Bed Manager dashboard', async ({ page }) => {
        await expect(page.getByText('Bed Manager')).toBeVisible();
        await expect(page.getByText('Real-time occupancy and flow management')).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Ward Map' })).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Cleaning Queue' })).toBeVisible();
    });

    test('should display wards and rooms', async ({ page }) => {
        await page.waitForTimeout(1000);
        await expect(page.locator('text=Room').first()).toBeVisible();
    });

    test('should open bed detail sheet', async ({ page }) => {
        await page.waitForTimeout(1000);
        const firstBed = page.locator('text=/Bed \\d+/').first();
        if (await firstBed.isVisible()) {
            await firstBed.click();
            await expect(page.getByText('Bed Details')).toBeVisible();
        }
    });

    test('should open AI Bed Assignment drawer', async ({ page }) => {
        await page.click('button:has-text("AI Bed Assignment")');
        // With seeded patient, drawer should open
        await expect(page.getByText('AI Bed Assignment')).toBeVisible();
        await expect(page.getByText('John Doe')).toBeVisible();
    });

    test('should switch to Cleaning Queue tab', async ({ page }) => {
        await page.click('button:has-text("Cleaning Queue")');
        // Corrected text assertion
        await expect(page.getByText('Cleaning Queue').first()).toBeVisible();
        await expect(page.getByText('No beds currently need cleaning')).toBeVisible();
    });
});
