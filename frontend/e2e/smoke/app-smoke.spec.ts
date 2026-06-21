import { test, expect } from '@playwright/test'

const API_URL = 'http://127.0.0.1:8081'

test.beforeAll(async ({ request }) => {
  const response = await request.post(`${API_URL}/test/seed`)
  expect(response.ok()).toBeTruthy()
})

test.describe('smoke', () => {
  test('page loads without critical errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/')
    await expect(page.getByTestId('playlist-home')).toBeVisible({ timeout: 15000 })
    const critical = errors.filter((e) => !e.includes('youtube'))
    expect(critical).toEqual([])
  })

  test('shows seeded playlist cards', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('playlist-library-card')).toBeVisible({ timeout: 15000 })
    await page.getByTestId('playlist-library-card').click()
    await expect(page.getByTestId('video-list')).toBeVisible({ timeout: 15000 })
    const cards = page.locator('[data-testid="video-card"], [data-testid="video-card-active"]')
    await expect(cards.first()).toBeVisible({ timeout: 15000 })
    await expect(cards).toHaveCount(3)
  })

  test('search filters by transcript term', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('playlist-library-card').click()
    await page.getByTestId('search-input').fill('kubernetes')
    await page.waitForTimeout(400)
    const cards = page.locator('[data-testid="video-card"], [data-testid="video-card-active"]')
    await expect(cards).toHaveCount(1)
    await expect(page.getByText('Introdução ao Docker')).toBeVisible()
  })

  test('clicking card highlights it', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('playlist-library-card').click()
    await page.getByText('Python para iniciantes').click()
    await expect(page.getByTestId('video-card-active')).toBeVisible()
    await expect(page.getByText('Python para iniciantes')).toBeVisible()
  })

  test('player container is visible', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('playlist-library-card').click()
    await expect(page.getByTestId('video-player')).toBeVisible()
    await expect(page.locator('#player')).toBeVisible()
  })
})
