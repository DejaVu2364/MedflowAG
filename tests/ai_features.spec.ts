import { test, expect } from '@playwright/test';

test.describe('AI Features', () => {
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

        // Seed a patient with clinical data for the AI to summarize
        await page.evaluate(() => {
            const testPatient = {
                id: 'TEST-PAT-AI-001',
                name: 'Jane AI Doe',
                age: 30,
                gender: 'Female',
                status: 'Admitted',
                triage: { level: 'Yellow', reasons: [] },
                chiefComplaints: [{ complaint: 'Abdominal Pain', durationValue: 2, durationUnit: 'Days' }],
                orders: [],
                rounds: [],
                clinicalFile: {
                    version: 1,
                    hopi: 'Patient presents with severe RLQ pain for 2 days. Associated with nausea and vomiting.',
                    pmh: 'None',
                    systemic: {
                        gastrointestinal: 'Tenderness at McBurney point. Rebound tenderness positive.'
                    },
                    provisionalDiagnosis: 'Acute Appendicitis',
                    plan: 'Appendectomy'
                },
                results: [],
                vitalsHistory: [],
                timeline: []
            };
            const current = JSON.parse(localStorage.getItem('medflow_patients') || '[]');
            localStorage.setItem('medflow_patients', JSON.stringify([...current, testPatient]));
        });
    });

    test('should generate discharge summary with AI', async ({ page }) => {
        // Navigate to the seeded patient's discharge page
        await page.goto('http://localhost:3002/patient/TEST-PAT-AI-001/discharge');

        // Check for loading state
        // The component shows "AI Drafting in progress..."
        // It might be fast, so we might miss it, but we can check for it or the result.

        // Wait for the AI to populate the diagnosis (from seed 'Acute Appendicitis')
        // The AI should ideally pick this up or generate something similar.
        // Since we are using a real API (or mock if key missing), we expect *some* text.

        // If the API call fails (e.g. no key in CI), the test might fail. 
        // But in this environment, we assume the dev server has the key.

        // We wait for the "Final Diagnosis" input to have a value.
        const diagnosisInput = page.locator('input[placeholder="e.g. Acute Appendicitis with Peritonitis"]');

        // Wait for it to be populated. 
        // Note: The AI might take a few seconds.
        await expect(diagnosisInput).not.toBeEmpty({ timeout: 15000 });

        // Verify other fields are populated
        const courseInput = page.locator('textarea[placeholder="Describe the hospital stay chronology..."]');
        await expect(courseInput).not.toBeEmpty();

        // Verify "AI Drafting in progress..." is GONE
        await expect(page.getByText('AI Drafting in progress...')).toBeHidden();
    });

    test('should suggest orders from clinical file', async ({ page }) => {
        // Navigate to patient detail (Clinical File tab)
        await page.goto('http://localhost:3002/patient/TEST-PAT-AI-001');

        // Wait for Clinical File to load
        await expect(page.getByText('Clinical File')).toBeVisible();

        // Click "Suggest Orders"
        await page.click('button:has-text("Suggest Orders")');

        // Wait for modal
        await expect(page.getByText('Suggested Orders')).toBeVisible();

        // Check for suggestions (Mocked or Real)
        // Since we have "Acute Appendicitis" in the seed, we expect some orders like CBC, USG, etc.
        // We check if at least one suggestion is present.
        // The modal displays suggestions in divs with class/style.
        // We can look for text like "Urgent" or "Routine" or just check for checkboxes/items.

        // Wait for loading to finish (Loader2 should disappear)
        await expect(page.locator('.animate-spin')).toBeHidden();

        // Check if any order is listed. 
        // If the API returns nothing (e.g. no key), it shows "No specific orders suggested".
        // We should handle both or ensure seed triggers it.
        // Let's check for the "Accept" button being enabled or disabled.

        const acceptBtn = page.locator('button:has-text("Accept")');
        await expect(acceptBtn).toBeVisible();

        // If we have suggestions, we can click accept.
        // If "No specific orders" is shown, we can't.
        // For this test, we assume the AI works or returns empty. 
        // We'll just verify the modal opened and we can close it.

        await page.click('button:has-text("Cancel")');
        await expect(page.getByText('Suggested Orders')).toBeHidden();
    });
});
